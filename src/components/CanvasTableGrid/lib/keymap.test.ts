import { describe, expect, it } from "vitest";
import { bindingMatches, defaultKeyBindings, matchesAction, mergeKeyBindings, type KeyLike } from "./keymap";

function key(k: string, opts: Partial<Omit<KeyLike, "key">> = {}): KeyLike {
  return { key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...opts };
}

describe("bindingMatches", () => {
  it("キーが一致し、mod/shift/altの要求も満たせば true", () => {
    expect(bindingMatches(key("z", { ctrlKey: true }), { key: "z", mod: true, shift: false })).toBe(true);
  });

  it("キーが違えば false", () => {
    expect(bindingMatches(key("y", { ctrlKey: true }), { key: "z", mod: true })).toBe(false);
  });

  it("大文字小文字を区別しない", () => {
    expect(bindingMatches(key("Z", { ctrlKey: true }), { key: "z", mod: true, shift: false })).toBe(true);
  });

  it("modが必要なのに押されていなければ false（Cmdでも代用可）", () => {
    expect(bindingMatches(key("z"), { key: "z", mod: true })).toBe(false);
    expect(bindingMatches(key("z", { metaKey: true }), { key: "z", mod: true })).toBe(true);
  });

  it("mod不要指定なのに押されていれば false", () => {
    expect(bindingMatches(key("Home", { ctrlKey: true }), { key: "Home" })).toBe(false);
  });

  it("shift省略時はshiftの状態を問わない", () => {
    expect(bindingMatches(key("ArrowUp"), { key: "ArrowUp" })).toBe(true);
    expect(bindingMatches(key("ArrowUp", { shiftKey: true }), { key: "ArrowUp" })).toBe(true);
  });

  it("shift明示時はその状態が必須", () => {
    const b = { key: "z", mod: true, shift: true };
    expect(bindingMatches(key("z", { ctrlKey: true, shiftKey: true }), b)).toBe(true);
    expect(bindingMatches(key("z", { ctrlKey: true, shiftKey: false }), b)).toBe(false);
  });
});

describe("defaultKeyBindings の曖昧さ回避", () => {
  it("Ctrl+Z は undo にマッチし、redo にはマッチしない", () => {
    const e = key("z", { ctrlKey: true });
    expect(matchesAction(e, "undo", defaultKeyBindings)).toBe(true);
    expect(matchesAction(e, "redo", defaultKeyBindings)).toBe(false);
  });

  it("Ctrl+Shift+Z は redo にマッチし、undo にはマッチしない", () => {
    const e = key("z", { ctrlKey: true, shiftKey: true });
    expect(matchesAction(e, "redo", defaultKeyBindings)).toBe(true);
    expect(matchesAction(e, "undo", defaultKeyBindings)).toBe(false);
  });

  it("Ctrl+Y も redo にマッチする", () => {
    expect(matchesAction(key("y", { ctrlKey: true }), "redo", defaultKeyBindings)).toBe(true);
  });

  it("Ctrl+; は insertDate、Ctrl+Shift+; と Ctrl+: は insertTime", () => {
    expect(matchesAction(key(";", { ctrlKey: true }), "insertDate", defaultKeyBindings)).toBe(true);
    expect(matchesAction(key(";", { ctrlKey: true }), "insertTime", defaultKeyBindings)).toBe(false);
    expect(matchesAction(key(";", { ctrlKey: true, shiftKey: true }), "insertTime", defaultKeyBindings)).toBe(true);
    expect(matchesAction(key(";", { ctrlKey: true, shiftKey: true }), "insertDate", defaultKeyBindings)).toBe(false);
    expect(matchesAction(key(":", { ctrlKey: true }), "insertTime", defaultKeyBindings)).toBe(true);
  });

  it("Home は home、Ctrl+Home は documentHome", () => {
    expect(matchesAction(key("Home"), "home", defaultKeyBindings)).toBe(true);
    expect(matchesAction(key("Home"), "documentHome", defaultKeyBindings)).toBe(false);
    expect(matchesAction(key("Home", { ctrlKey: true }), "documentHome", defaultKeyBindings)).toBe(true);
    expect(matchesAction(key("Home", { ctrlKey: true }), "home", defaultKeyBindings)).toBe(false);
  });

  it("Delete と Backspace はどちらも deleteCell", () => {
    expect(matchesAction(key("Delete"), "deleteCell", defaultKeyBindings)).toBe(true);
    expect(matchesAction(key("Backspace"), "deleteCell", defaultKeyBindings)).toBe(true);
  });
});

describe("mergeKeyBindings", () => {
  it("指定しなければデフォルトのまま", () => {
    const merged = mergeKeyBindings();
    expect(merged).toEqual(defaultKeyBindings);
  });

  it("配列で指定したアクションはデフォルトを置き換える", () => {
    const merged = mergeKeyBindings({ undo: [{ key: "u", mod: true }] });
    expect(merged.undo).toEqual([{ key: "u", mod: true }]);
    expect(merged.redo).toEqual(defaultKeyBindings.redo); // 他は変わらない
  });

  it("null を指定するとそのアクションは無効化される（何にもマッチしない）", () => {
    const merged = mergeKeyBindings({ fillDown: null });
    expect(merged.fillDown).toEqual([]);
    expect(matchesAction(key("d", { ctrlKey: true }), "fillDown", merged)).toBe(false);
  });

  it("新しいキーでアクションを再割り当てできる", () => {
    const merged = mergeKeyBindings({ undo: [{ key: "u", mod: true }] });
    expect(matchesAction(key("z", { ctrlKey: true }), "undo", merged)).toBe(false);
    expect(matchesAction(key("u", { ctrlKey: true }), "undo", merged)).toBe(true);
  });
});
