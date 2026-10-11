import { describe, expect, it } from "vitest";
import { spliceAtCursor } from "./textEdit";

describe("spliceAtCursor", () => {
  it("カーソル位置に挿入する(start===end)", () => {
    const r = spliceAtCursor("abcdef", 3, 3, "XY");
    expect(r.value).toBe("abcXYdef");
    expect(r.caret).toBe(5);
  });

  it("選択範囲を置き換える(start!==end)", () => {
    const r = spliceAtCursor("abcdef", 1, 4, "Z");
    expect(r.value).toBe("aZef");
    expect(r.caret).toBe(2);
  });

  it("空文字列の削除にも使える", () => {
    const r = spliceAtCursor("abcdef", 1, 4, "");
    expect(r.value).toBe("aef");
    expect(r.caret).toBe(1);
  });

  it("末尾への追加", () => {
    const r = spliceAtCursor("abc", 3, 3, "def");
    expect(r.value).toBe("abcdef");
    expect(r.caret).toBe(6);
  });
});
