/**
 * Report content model.
 *
 * A report is a tree of chapters, sections, and subsections. Numbering is
 * derived from the tree, never typed by hand, so a heading can be inserted or
 * moved without renumbering anything. The sample report numbers front sections
 * as `1.0`, `1.1`, `1.1.1`, and `1.1.1.1`, which this module reproduces: a
 * chapter's own heading is `N.0` and each level below appends one more index.
 *
 * Figures, tables, and drawings are blocks inside a section, so the renderer
 * can place each one next to the text that explains it rather than collecting
 * every image at the end of the chapter.
 */

export type Block =
  | { kind: "bullets"; items: string[]; marker?: BulletMarker }
  | { kind: "callout"; text: string; title?: string }
  | { kind: "drawing"; drawing: Drawing; caption: string }
  | { kind: "figure"; caption: string; height?: number; image: FigureSource }
  | { kind: "keyValue"; rows: KeyValueRow[] }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "pageBreak" }
  | { bold?: boolean; kind: "paragraph"; text: string }
  | { kind: "placeholder"; note: string }
  | { kind: "table"; caption: string; columns: TableColumn[]; rows: string[][] }
  | { kind: "spacer"; size?: number };

export type BulletMarker = "arrow" | "dot";

export interface TableColumn {
  align?: "center" | "left" | "right";
  header: string;
  weight?: number;
}

export interface KeyValueRow {
  label: string;
  value: string;
}

export interface FigureSource {
  height: number;
  kind: "jpg" | "png";
  path: string;
  width: number;
}

export interface BarSeries {
  color?: number;
  name: string;
  values: number[];
}

export type Drawing =
  | {
      categories: string[];
      height?: number;
      kind: "bar";
      series: BarSeries[];
      title: string;
      valueLabel?: string;
    }
  | {
      categories: string[];
      height?: number;
      kind: "line";
      series: BarSeries[];
      title: string;
      valueLabel?: string;
    }
  | {
      height?: number;
      kind: "pie";
      slices: PieSlice[];
      title: string;
    }
  | { height?: number; kind: "orgTree"; title: string; tree: OrgNode }
  | { height?: number; kind: "flow"; steps: FlowStep[]; title: string }
  | { height?: number; kind: "layers"; layers: LayerRow[]; title: string }
  | {
      height?: number;
      kind: "timeline";
      milestones: Milestone[];
      title: string;
    }
  | {
      height?: number;
      kind: "stackedBar";
      categories: string[];
      series: BarSeries[];
      title: string;
      valueLabel?: string;
    };

export interface PieSlice {
  color?: number;
  label: string;
  value: number;
}

export interface OrgNode {
  children: OrgNode[];
  label: string;
  role?: string;
}

export interface FlowStep {
  detail?: string;
  label: string;
}

export interface LayerRow {
  items: string[];
  name: string;
}

export interface Milestone {
  label: string;
  period: string;
  summary: string;
}

export interface Section {
  blocks?: Block[];
  children?: Section[];
  /** Anchor used by later passes, for example to drop a week's screenshots in. */
  id?: string;
  title: string;
}

export interface Chapter extends Section {
  label?: string;
  /** Heading text for the chapter's own `N.0` section, when it differs from `title`. */
  introTitle?: string;
}

export interface Reference {
  author: string;
  detail: string;
  title: string;
  url: string;
}

export interface Abbreviation {
  expansion: string;
  term: string;
}

export interface CoverFields {
  category?: string;
  course?: string;
  establishment: string;
  establishmentAddress?: string;
  field?: string;
  /** One line per part, so a long faculty and university name cannot overflow. */
  instituteLines?: string[];
  name: string;
  naitaRegistration?: string;
  studentNumber?: string;
  trainingEnd: string;
  trainingLocation?: string;
  trainingStart: string;
}

export interface ReportDocument {
  abbreviations?: Abbreviation[];
  acknowledgement?: string[];
  appendices?: Section[];
  certification?: {
    declaration?: string;
    fields?: KeyValueRow[];
  };
  chapters: Chapter[];
  cover: CoverFields;
  frontMatterOrder?: FrontMatterKind[];
  preface?: string[];
  references?: Reference[];
  title: string;
}

export type FrontMatterKind =
  | "abbreviations"
  | "acknowledgement"
  | "listOfFigures"
  | "listOfTables"
  | "preface"
  | "tableOfContents";

export interface NumberedHeading {
  depth: number;
  label: string;
  page: number;
  title: string;
}
