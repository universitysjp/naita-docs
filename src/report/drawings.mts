/**
 * Vector drawings for the report: bar, grouped bar, stacked bar, line, pie,
 * organisation tree, flow, layered stack, and a work timeline.
 *
 * Charts are drawn as PDF vectors rather than embedded images so they stay
 * sharp at any zoom, remain searchable in the exported text, add no binary
 * dependency, and print cleanly in black and white. The grayscale-friendly
 * palette keeps a chart readable when a supervisor prints it monochrome.
 */

import { rgb } from "pdf-lib";

import { printable, wrap } from "../pdf/layout.mts";

const AXIS = 0.35;
const GRID = 0.78;
const TICK_SIZE = 8;
const LEGEND_SIZE = 8.5;

/**
 * Lightens a packed 0xRRGGBB colour toward white. Charts ask for a tint of the
 * series colour instead of a separate palette entry, so one colour works in
 * greyscale and in colour.
 */
const colorOf = (hex, amount) => {
  const channel = (shift) => {
    const base = Math.floor(hex / 2 ** shift) % 256;
    return Math.round(base + (255 - base) * amount) / 255;
  };
  return rgb(channel(16), channel(8), channel(0));
};

/**
 * Charts are authored in a top-left origin box, which is how the layout code
 * thinks about vertical space, then flipped into PDF's bottom-left coordinates.
 */
const makeCanvas = (page, box, fonts) => {
  const { bottom, height, left, width } = box;
  const toY = (y) => bottom + height - y;
  return {
    bottom,
    fonts,
    height,
    left,
    line(from, to, thickness = 0.6, hex = AXIS) {
      page.drawLine({
        color: colorOf(hex, 0),
        end: { x: from[0], y: toY(from[1]) },
        start: { x: to[0], y: toY(to[1]) },
        thickness,
      });
    },
    rect(x, y, w, h, options = {}) {
      page.drawRectangle({
        borderColor: options.border === false ? undefined : rgb(0, 0, 0),
        borderWidth: options.border === false ? 0 : (options.thickness ?? 0.6),
        color: options.fill
          ? colorOf(options.fill, options.light ?? 0)
          : undefined,
        height: Math.max(0, h),
        width: Math.max(0, w),
        x,
        y: toY(y + h),
      });
    },
    text(value, x, y, options = {}) {
      const size = options.size ?? TICK_SIZE;
      const font = options.bold ? fonts.bold : fonts.regular;
      const text = printable(value);
      const textWidth = font.widthOfTextAtSize(text, size);
      const align = options.align ?? "left";
      let drawX = x;
      if (align === "center") {
        drawX = x - textWidth / 2;
      } else if (align === "right") {
        drawX = x - textWidth;
      }
      page.drawText(text, {
        color: rgb(0, 0, 0),
        font,
        size,
        x: drawX,
        y: toY(y) - size * 0.82,
      });
      return textWidth;
    },
    width,
  };
};

const niceCeiling = (value) => {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const steps = [1, 2, 5, 10];
  const step = steps.find((candidate) => normalized <= candidate) ?? 10;
  return step * magnitude;
};

const AXIS_TICKS = 4;
const CATEGORY_LABEL_LINES = 2;

/**
 * Reserves room for the axis, the category labels, and the legend, then
 * returns the plot rectangle. Coordinates stay in the top-left origin space, so
 * `top` is the highest gridline and `top + height` is the category axis.
 */
const axisBox = (box, fonts) => {
  const canvas = makeCanvas(box.page, box, fonts ?? box.fonts);
  const legendRows = Math.ceil(
    (box.series || []).filter((series) => series.name).length / 2
  );
  const paddingTop = 10;
  const paddingLeft = 36;
  const paddingRight = 10;
  const labelHeight = CATEGORY_LABEL_LINES * 9 + 8;
  const legendHeight = legendRows ? legendRows * 11 + 10 : 0;
  const height = Math.max(
    30,
    box.height - paddingTop - labelHeight - legendHeight
  );
  return {
    canvas,
    legendTop: box.height - legendRows * 11,
    plot: {
      height,
      left: box.left + paddingLeft,
      top: paddingTop,
      width: box.width - paddingLeft - paddingRight,
    },
  };
};

/** Maps a value to a y coordinate; larger values sit higher on the page. */
const yFor = (plot, max, value) =>
  plot.top + plot.height - (value / max) * plot.height;

const drawGridAndAxis = (canvas, plot, max, ticks = AXIS_TICKS) => {
  for (let index = 0; index <= ticks; index += 1) {
    const value = (max / ticks) * index;
    const y = yFor(plot, max, value);
    canvas.line(
      [plot.left, y],
      [plot.left + plot.width, y],
      index === 0 ? 0.9 : 0.4,
      index === 0 ? AXIS : GRID
    );
    canvas.text(String(Math.round(value * 10) / 10), plot.left - 5, y - 3, {
      align: "right",
    });
  }
};

const drawLegend = (canvas, left, width, entries, top) => {
  if (!entries.length) {
    return;
  }
  const columnWidth = width / 2;
  for (const [index, entry] of entries.entries()) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = left + column * columnWidth;
    const y = top + row * 11;
    canvas.rect(x, y, 7, 7, { fill: entry.color, light: 0.3, thickness: 0.4 });
    canvas.text(entry.name, x + 11, y, { size: LEGEND_SIZE });
  }
};

const drawCategoryLabels = (canvas, fonts, categories, plot) => {
  const slot = plot.width / categories.length;
  const baseline = plot.top + plot.height;
  for (const [index, category] of categories.entries()) {
    const x = plot.left + slot * (index + 0.5);
    const lines = wrap(category, fonts.regular, 8, Math.max(20, slot - 3));
    if (lines.length > CATEGORY_LABEL_LINES) {
      throw new Error(
        `Chart category label needs ${lines.length} lines but only ${CATEGORY_LABEL_LINES} fit: ${category}`
      );
    }
    for (const [lineIndex, line] of lines.entries()) {
      canvas.text(line, x, baseline + 6 + lineIndex * 9, {
        align: "center",
        size: 8,
      });
    }
  }
};

const barGeometry = (plot, categories, series, stacked) => {
  const slot = plot.width / categories.length;
  const groupPad = slot * 0.2;
  const usable = slot - groupPad * 2;
  const barWidth = stacked ? usable : usable / Math.max(1, series.length);
  const max = niceCeiling(
    stacked
      ? Math.max(
          ...categories.map((_, index) =>
            series.reduce((sum, item) => sum + (item.values[index] || 0), 0)
          )
        )
      : Math.max(
          ...series.flatMap((item) => item.values.map((value) => value || 0))
        )
  );
  return { barWidth, groupPad, max, slot };
};

const drawBarFamily = (kind) => (page, box, fonts) => {
  const stacked = kind === "stackedBar";
  const chart = { ...box, fonts: fonts ?? box.fonts, page };
  const { canvas, legendTop, plot } = axisBox(chart, chart.fonts);
  const { barWidth, groupPad, max, slot } = barGeometry(
    plot,
    chart.categories,
    chart.series,
    stacked
  );
  drawGridAndAxis(canvas, plot, max);
  for (const index of chart.categories.keys()) {
    let stackTop = plot.top + plot.height;
    for (const [seriesIndex, series] of chart.series.entries()) {
      const value = series.values[index] || 0;
      const barHeight = (value / max) * plot.height;
      const x = stacked
        ? plot.left + slot * index + groupPad
        : plot.left + slot * index + groupPad + barWidth * seriesIndex;
      const top = stackTop - barHeight;
      canvas.rect(x, top, Math.max(1, barWidth - 2), barHeight, {
        fill: series.color ?? 0x4a_4a_4a,
        light: 0.12 + seriesIndex * 0.16,
      });
      if (!stacked && barHeight > 9) {
        canvas.text(
          String(Math.round(value)),
          x + (barWidth - 2) / 2,
          top - 8,
          {
            align: "center",
            size: 7.5,
          }
        );
      }
      stackTop = top;
    }
  }
  drawCategoryLabels(canvas, chart.fonts, chart.categories, plot);
  drawLegend(
    canvas,
    plot.left,
    chart.left + chart.width - plot.left,
    chart.series.map((series) => ({
      color: series.color ?? 0x4a_4a_4a,
      name: series.name,
    })),
    legendTop
  );
  return chart.height;
};

const drawLine = (page, box, fonts) => {
  const chart = { ...box, fonts: fonts ?? box.fonts, page };
  const { canvas, legendTop, plot } = axisBox(chart, chart.fonts);
  const max = niceCeiling(
    Math.max(
      ...chart.series.flatMap((series) =>
        series.values.map((value) => value || 0)
      )
    )
  );
  drawGridAndAxis(canvas, plot, max);
  const slot = plot.width / Math.max(1, chart.categories.length - 1);
  const toPdfY = (value) => canvas.bottom + chart.height - value;
  for (const [seriesIndex, series] of chart.series.entries()) {
    const points = series.values.map((value, index) => [
      plot.left + slot * index,
      yFor(plot, max, value),
    ]);
    for (let index = 1; index < points.length; index += 1) {
      page.drawLine({
        color: colorOf(series.color ?? 0x2f_4f_6f, seriesIndex * 0.18),
        end: { x: points[index][0], y: toPdfY(points[index][1]) },
        start: { x: points[index - 1][0], y: toPdfY(points[index - 1][1]) },
        thickness: 1.1,
      });
    }
    for (const [x, y] of points) {
      canvas.rect(x - 2.5, y - 2.5, 5, 5, {
        fill: series.color ?? 0x2f_4f_6f,
        thickness: 0.4,
      });
    }
  }
  drawCategoryLabels(canvas, chart.fonts, chart.categories, plot);
  drawLegend(
    canvas,
    plot.left,
    chart.left + chart.width - plot.left,
    chart.series.map((series) => ({
      color: series.color ?? 0x2f_4f_6f,
      name: series.name,
    })),
    legendTop
  );
  return chart.height;
};

const drawPie = (page, box, fonts) => {
  const canvas = makeCanvas(page, { ...box, page }, fonts ?? box.fonts);
  const total = box.slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const legendWidth = box.width * 0.44;
  const radius = Math.min(
    (box.width - legendWidth) / 2 - 8,
    box.height / 2 - 10
  );
  const centerX = box.left + (box.width - legendWidth) / 2;
  const centerY = box.height / 2;
  let angle = Math.PI / 2;
  for (const slice of box.slices) {
    const sweep = (slice.value / total) * Math.PI * 2;
    const end = angle - sweep;
    // Every wedge keeps a black rim so adjacent greys stay distinguishable.
    page.drawSvgPath(
      `M ${centerX} ${canvas.bottom + box.height - centerY} L ${
        centerX + radius * Math.cos(angle)
      } ${canvas.bottom + box.height - centerY - radius * Math.sin(angle)} A ${radius} ${radius} 0 ${
        sweep > Math.PI ? 1 : 0
      } 0 ${centerX + radius * Math.cos(end)} ${
        canvas.bottom + box.height - centerY - radius * Math.sin(end)
      } Z`,
      {
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.6,
        color: colorOf(slice.color ?? 0x66_66, 0.2),
      }
    );
    angle = end;
  }
  for (const [index, slice] of box.slices.entries()) {
    const y = 6 + index * 13;
    canvas.rect(box.left + box.width - legendWidth, y, 7, 7, {
      fill: slice.color ?? 0x66_66,
      light: 0.3,
      thickness: 0.4,
    });
    const share = `${slice.label} (${Math.round((slice.value / total) * 100)}%)`;
    canvas.text(share, box.left + box.width - legendWidth + 11, y, {
      size: LEGEND_SIZE,
    });
  }
  return box.height;
};

const ORG_GAP = 14;
const ORG_STEM = 12;
const ORG_MIN_SCALE = 0.75;
const ORG_LABEL_SIZE = 9.5;
const ORG_ROLE_SIZE = 8;
const ORG_PADDING = 18;
const ORG_MIN_BOX = 76;
const ORG_MAX_BOX = 96;

/**
 * Measures a subtree. A box is never wider than `ORG_MAX_BOX`, and a long label
 * wraps inside it, so a tree with many branches stays inside the page instead of
 * forcing the whole chart to shrink. Sizes scale together, so a scaled tree
 * shrinks its text along with its boxes.
 */
const orgBoxLines = (node, fonts, scale) => {
  const maxInner = (ORG_MAX_BOX - ORG_PADDING / 2) * scale;
  const label = wrap(
    node.label,
    fonts.regular,
    ORG_LABEL_SIZE * scale,
    maxInner
  );
  const role = node.role
    ? wrap(node.role, fonts.regular, ORG_ROLE_SIZE * scale, maxInner)
    : [];
  return { label, role };
};

const orgBoxHeight = (node, fonts, scale) => {
  const lines = orgBoxLines(node, fonts, scale);
  return (
    6 * scale +
    lines.label.length * (ORG_LABEL_SIZE + 2) * scale +
    lines.role.length * (ORG_ROLE_SIZE + 2) * scale +
    5 * scale
  );
};

const measureOrgTree = (node, fonts, scale = 1) => {
  const lines = orgBoxLines(node, fonts, scale);
  const own = Math.max(
    ORG_MIN_BOX * scale,
    ...lines.label.map(
      (line) =>
        fonts.regular.widthOfTextAtSize(line, ORG_LABEL_SIZE * scale) +
        ORG_PADDING * scale
    ),
    ...lines.role.map(
      (line) =>
        fonts.regular.widthOfTextAtSize(line, ORG_ROLE_SIZE * scale) +
        ORG_PADDING * scale
    )
  );
  const height = orgBoxHeight(node, fonts, scale);
  if (!node.children.length) {
    return { height, scale, width: own };
  }
  const children = node.children.map((child) =>
    measureOrgTree(child, fonts, scale)
  );
  const span = children.reduce(
    (sum, child) => sum + child.width + ORG_GAP * scale,
    -ORG_GAP * scale
  );
  return {
    height:
      height +
      ORG_STEM * scale +
      Math.max(...children.map((child) => child.height)),
    scale,
    width: Math.max(own, span),
  };
};

/**
 * Shrinks the tree until it fits the printable width, then measures it again.
 * The search is by measurement rather than by ratio, because a box's minimum
 * width does not scale linearly with the font, so a single division is not
 * enough to guarantee the result fits.
 */
const fitOrgTree = (node, fonts, available) => {
  const natural = measureOrgTree(node, fonts);
  if (natural.width <= available) {
    return { measured: natural, scale: 1 };
  }
  let best = null;
  for (let scale = 1; scale >= ORG_MIN_SCALE; scale -= 0.01) {
    const measured = measureOrgTree(node, fonts, scale);
    best = { measured, scale };
    if (measured.width <= available) {
      return { measured, scale };
    }
  }
  if (best.measured.width > available) {
    throw new Error(
      `Organisation chart "${node.label}" needs ${Math.round(best.measured.width)}pt but only ${Math.round(available)}pt is available, even at the smallest readable scale. Reduce the number of boxes on the widest row, or shorten the labels.`
    );
  }
  return best;
};

const layoutOrgTree = (canvas, node, left, top, scale) => {
  const { fonts } = canvas;
  const size = measureOrgTree(node, fonts, scale);
  const boxWidth = Math.min(size.width, canvas.width);
  const boxX = left + (size.width - boxWidth) / 2;
  const height = orgBoxHeight(node, fonts, scale);
  const gap = ORG_GAP * scale;
  const stem = ORG_STEM * scale;
  canvas.rect(boxX, top, boxWidth, height, {
    fill: 0x4a_4a_4a,
    light: 0.72,
    thickness: 0.7,
  });
  const lines = orgBoxLines(node, fonts, scale);
  const centerX = boxX + boxWidth / 2;
  let textY = top + 5 * scale;
  for (const line of lines.label) {
    canvas.text(line, centerX, textY, {
      align: "center",
      bold: true,
      size: ORG_LABEL_SIZE * scale,
    });
    textY += (ORG_LABEL_SIZE + 2) * scale;
  }
  for (const line of lines.role) {
    canvas.text(line, centerX, textY, {
      align: "center",
      size: ORG_ROLE_SIZE * scale,
    });
    textY += (ORG_ROLE_SIZE + 2) * scale;
  }
  if (!node.children.length) {
    return;
  }
  const childTop = top + height + stem;
  const total = node.children.reduce(
    (sum, child) => sum + measureOrgTree(child, fonts, scale).width + gap,
    -gap
  );
  const stemX = boxX + boxWidth / 2;
  canvas.line([stemX, top + height], [stemX, top + height + stem]);
  const busY = top + height + stem;
  let cursor = left + (size.width - total) / 2;
  canvas.line([cursor, busY], [cursor + total, busY], 0.5, 0x55);
  for (const child of node.children) {
    const childSize = measureOrgTree(child, fonts, scale);
    const childCenter = cursor + childSize.width / 2;
    canvas.line([childCenter, busY], [childCenter, childTop], 0.5, 0x55);
    layoutOrgTree(canvas, child, cursor, childTop, scale);
    cursor += childSize.width + gap;
  }
};

const drawOrgTree = (page, box, fonts) => {
  const family = fonts ?? box.fonts;
  const canvas = makeCanvas(page, box, family);
  const { measured, scale } = fitOrgTree(box.tree, family, box.width);
  layoutOrgTree(canvas, box.tree, box.left, 2, scale);
  return measured.height + 4;
};
/** Arrowheads point right, drawn as two short lines so no glyph is needed. */
const arrowHead = (page, tipX, tipY, canvasY) => {
  for (const offset of [-2.4, 2.4]) {
    page.drawLine({
      color: rgb(0, 0, 0),
      end: { x: tipX, y: canvasY },
      start: { x: tipX - 3.2, y: tipY + offset },
      thickness: 0.9,
    });
  }
};

const drawFlow = (page, box, fonts) => {
  const canvas = makeCanvas(page, { ...box, page }, fonts ?? box.fonts);
  const { steps } = box;
  const gap = 12;
  const width = (box.width - gap * (steps.length - 1)) / steps.length;
  const detailLines = Math.max(
    0,
    ...steps.map(
      (step) => wrap(step.detail ?? "", fonts.regular, 8, width - 12).length
    )
  );
  const height = 42 + detailLines * 9.5;
  for (const [index, step] of steps.entries()) {
    const x = box.left + index * (width + gap);
    canvas.rect(x, 4, width, height, {
      fill: 0x5a_5a,
      light: index % 2 ? 0.8 : 0.68,
      thickness: 0.7,
    });
    canvas.text(String(index + 1), x + 7, 11, { bold: true, size: 9 });
    const lines = wrap(step.label, fonts.regular, 9, width - 26);
    for (const [lineIndex, line] of lines.slice(0, 2).entries()) {
      canvas.text(line, x + 18, 10 + lineIndex * 10, { size: 9 });
    }
    for (const [lineIndex, line] of wrap(
      step.detail ?? "",
      fonts.regular,
      8,
      width - 12
    )
      .slice(0, detailLines)
      .entries()) {
      canvas.text(line, x + 6, 28 + lineIndex * 9.5, { size: 8 });
    }
    if (index < steps.length - 1) {
      const midY = 4 + height / 2;
      const tipX = x + width + gap - 1;
      canvas.line([x + width + 1, midY], [tipX - 3, midY], 0.9);
      arrowHead(page, tipX, midY, canvas.bottom + box.height - midY);
    }
  }
  return height + 4;
};

const drawLayers = (page, box, fonts) => {
  const canvas = makeCanvas(page, { ...box, page }, fonts ?? box.fonts);
  const rowHeight = 34;
  const nameWidth = box.width * 0.22;
  const total = box.layers.length * rowHeight;
  for (const [index, layer] of box.layers.entries()) {
    const y = index * rowHeight;
    canvas.rect(box.left, y, nameWidth, rowHeight - 4, {
      fill: 0x44_44,
      light: 0.55,
      thickness: 0.7,
    });
    const nameLines = wrap(layer.name, fonts.bold, 9, nameWidth - 12);
    for (const [lineIndex, line] of nameLines.slice(0, 3).entries()) {
      canvas.text(line, box.left + nameWidth / 2, y + 6 + lineIndex * 10, {
        align: "center",
        bold: true,
        size: 9,
      });
    }
    const cellWidth =
      (box.width - nameWidth - 8) / Math.max(1, layer.items.length);
    for (const [itemIndex, item] of layer.items.entries()) {
      const x = box.left + nameWidth + 8 + cellWidth * itemIndex;
      canvas.rect(x, y, cellWidth - 6, rowHeight - 4, {
        fill: 0x6a_6a,
        light: 0.86 - index * 0.05,
        thickness: 0.5,
      });
      for (const [lineIndex, line] of wrap(
        item,
        fonts.regular,
        8,
        cellWidth - 18
      )
        .slice(0, 2)
        .entries()) {
        canvas.text(line, x + (cellWidth - 6) / 2, y + 6 + lineIndex * 9.5, {
          align: "center",
          size: 8,
        });
      }
    }
  }
  return total + 6;
};

const drawTimeline = (page, box, fonts) => {
  const canvas = makeCanvas(page, { ...box, page }, fonts ?? box.fonts);
  const axisY = 34;
  const count = box.milestones.length;
  const width = box.width / Math.max(1, count);
  canvas.line([box.left, axisY], [box.left + box.width, axisY], 0.9);
  for (const [index, milestone] of box.milestones.entries()) {
    const x = box.left + width * (index + 0.5);
    canvas.rect(x - 3, axisY - 3, 6, 6, { fill: 0x33_33, thickness: 0.5 });
    canvas.rect(
      x - Math.min(width / 2 - 4, 54),
      0,
      Math.min(width - 8, 108),
      24,
      {
        fill: 0x6a_6a,
        light: index % 2 ? 0.88 : 0.78,
        thickness: 0.6,
      }
    );
    canvas.text(milestone.period, x, 3, {
      align: "center",
      bold: true,
      size: 8.5,
    });
    for (const [lineIndex, line] of wrap(
      milestone.label,
      fonts.regular,
      8.5,
      Math.min(width - 10, 150)
    )
      .slice(0, 2)
      .entries()) {
      canvas.text(line, x, axisY + 10 + lineIndex * 9.5, {
        align: "center",
        size: 8.5,
      });
    }
  }
  return axisY + 36;
};

/**
 * The height a drawing needs, measured from its content so a small tree does
 * not leave a large empty band on the page. Cartesian charts share a fixed
 * plot height because their axes should line up between them.
 */
export const drawingHeight = (drawing, fonts) => {
  if (drawing.height) {
    return drawing.height;
  }
  const measured = {
    bar: () => 215,
    flow: () => 128,
    layers: () => drawing.layers.length * 40 + 10,
    line: () => 215,
    orgTree: () =>
      fitOrgTree(drawing.tree, fonts, drawing.width ?? 451.28).measured.height +
      8,
    pie: () => 40 + drawing.slices.length * 13,
    stackedBar: () => 215,
    timeline: () => 76,
  }[drawing.kind];
  return measured ? measured() : 215;
};

const RENDERERS = {
  bar: drawBarFamily("bar"),
  flow: drawFlow,
  layers: drawLayers,
  line: drawLine,
  orgTree: drawOrgTree,
  pie: drawPie,
  stackedBar: drawBarFamily("stackedBar"),
  timeline: drawTimeline,
};

export const drawDrawing = (page, drawing, box) => {
  const renderer = RENDERERS[drawing.kind];
  if (!renderer) {
    throw new Error(`Unsupported drawing: ${drawing.kind}`);
  }
  const required = drawingHeight(drawing, box.fonts);
  if (required > box.height) {
    throw new Error(
      `Drawing "${drawing.title}" needs ${Math.round(required)}pt but only ${Math.round(box.height)}pt is available.`
    );
  }
  // Renderers read their data from the box, so the drawing's own fields are
  // merged in; geometry from the caller always wins.
  return renderer(page, { ...drawing, ...box, page }, box.fonts);
};
