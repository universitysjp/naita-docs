import {
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  InputRenderable,
  InputRenderableEvents,
} from "@opentui/core";
import type { CliRenderer, KeyEvent } from "@opentui/core";

export interface Choice {
  name: string;
  description?: string;
  action: () => void | Promise<void>;
}
interface Field {
  key: string;
  label: string;
  value?: string;
  optional?: boolean;
}

export class DiaryShell {
  private panel: BoxRenderable;
  private title: TextRenderable;
  private detail: TextRenderable;
  private menu: SelectRenderable;
  private input: InputRenderable;
  private feedback: TextRenderable;
  readonly renderer: CliRenderer;
  private choices: Choice[] = [];
  // Replaced by show() and form(); the no-op keeps a handler defined before
  // the first screen renders.
  /* oxlint-disable no-empty-function, class-methods-use-this --
     intentional no-op defaults, replaced by show() and form(). These are
     arrow properties rather than methods, so class-methods-use-this is a
     false positive here. */
  private onSubmit: (value: string) => void | Promise<void> = () => {};
  private back: () => void | Promise<void> = () => {};
  /* oxlint-enable no-empty-function, class-methods-use-this */
  private busy = false;

  constructor(renderer: CliRenderer) {
    this.renderer = renderer;
    this.panel = new BoxRenderable(renderer, {
      backgroundColor: "#10131a",
      border: true,
      borderColor: "#5f89c7",
      borderStyle: "rounded",
      flexDirection: "column",
      gap: 1,
      height: "100%",
      id: "diary-panel",
      padding: 1,
      width: "100%",
    });
    this.title = new TextRenderable(renderer, {
      content: "NAITA internship diary",
      fg: "#7fdbff",
      flexShrink: 0,
      id: "screen-title",
    });
    this.detail = new TextRenderable(renderer, {
      content: "",
      fg: "#c4cfdd",
      flexShrink: 0,
      id: "screen-detail",
      maxHeight: 7,
    });
    this.menu = new SelectRenderable(renderer, {
      descriptionColor: "#9daec4",
      flexGrow: 1,
      id: "screen-menu",
      minHeight: 3,
      options: [],
      selectedBackgroundColor: "#2b3850",
      selectedDescriptionColor: "#c4cfdd",
      selectedTextColor: "#ffffff",
      showDescription: true,
      showScrollIndicator: true,
      textColor: "#e5ecf4",
      wrapSelection: true,
    });
    this.input = new InputRenderable(renderer, {
      backgroundColor: "#202838",
      focusedBackgroundColor: "#2b3850",
      id: "screen-input",
      maxLength: 5000,
      textColor: "#ffffff",
      visible: false,
      width: "100%",
    });
    this.feedback = new TextRenderable(renderer, {
      content: "",
      fg: "#76d7a2",
      flexShrink: 0,
      id: "screen-feedback",
      maxHeight: 4,
    });
    const footer = new TextRenderable(renderer, {
      content: "Up/Down: choose   Enter: open/save   Esc: back   Ctrl+C: exit",
      fg: "#9daec4",
      flexShrink: 0,
      id: "screen-footer",
    });
    for (const child of [
      this.title,
      this.detail,
      this.menu,
      this.input,
      this.feedback,
      footer,
    ]) {
      this.panel.add(child);
    }
    renderer.root.add(this.panel);
    this.menu.on(SelectRenderableEvents.ITEM_SELECTED, (index: number) => {
      if (!this.busy) {
        void this.perform(() => this.choices[index]?.action());
      }
    });
    this.input.on(InputRenderableEvents.ENTER, (value: string) => {
      if (!this.busy) {
        void this.perform(() => this.onSubmit(value));
      }
    });
    const onKey = (key: KeyEvent) => {
      if (key.name === "escape" && !this.busy) {
        key.preventDefault();
        void this.perform(this.back);
      }
      if (key.ctrl && key.name === "c") {
        key.preventDefault();
        renderer.destroy();
      }
    };
    renderer.keyInput.on("keypress", onKey);
    renderer.once("destroy", () => renderer.keyInput.off("keypress", onKey));
  }
  async perform(action: () => void | Promise<void>) {
    if (this.busy || this.renderer.isDestroyed) {
      return;
    }
    this.busy = true;
    this.feedback.content = "Working...";
    try {
      await action();
      if (!this.renderer.isDestroyed) {
        this.feedback.content = "";
        this.feedback.fg = "#76d7a2";
      }
    } catch (error) {
      if (!this.renderer.isDestroyed) {
        this.feedback.content =
          error instanceof Error ? error.message : String(error);
        this.feedback.fg = "#ff8a8a";
      }
    } finally {
      this.busy = false;
    }
  }
  show(
    title: string,
    detail: string,
    choices: Choice[],
    back: () => void | Promise<void>
  ) {
    if (this.renderer.isDestroyed) {
      return;
    }
    this.title.content = title;
    this.detail.content = detail;
    this.choices = choices;
    this.back = back;
    this.input.visible = false;
    this.menu.visible = true;
    this.menu.options = choices.map((choice) => ({
      description: choice.description || "",
      name: choice.name,
    }));
    this.menu.setSelectedIndex(0);
    this.menu.focus();
  }
  form(
    title: string,
    fields: Field[],
    save: (values: Record<string, string>) => Promise<void>,
    back: () => void | Promise<void>
  ) {
    let index = 0;
    const values: Record<string, string> = {};
    const showField = () => {
      const field = fields[index];
      this.title.content = `${title} (${index + 1}/${fields.length})`;
      this.detail.content = `${field.label}${field.optional ? "\nLeave blank if not needed; an existing value can be cleared." : ""}`;
      this.menu.visible = false;
      this.input.visible = true;
      this.input.value = values[field.key] ?? field.value ?? "";
      this.input.focus();
    };
    this.back = () => {
      if (index === 0) {
        return back();
      }
      values[fields[index].key] = this.input.value;
      index -= 1;
      showField();
    };
    this.onSubmit = async (value) => {
      const field = fields[index];
      if (!field.optional && !value.trim()) {
        throw new Error(`${field.label} is required.`);
      }
      values[field.key] = value.trim();
      if (index === fields.length - 1) {
        await save(values);
      } else {
        index += 1;
        showField();
      }
    };
    showField();
  }
}
