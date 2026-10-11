import { describe, expect, it } from "vitest";
import { defaultTheme } from "./rendering/drawGrid";
import { dropdownItemStyle, editableInputStyle, rootStyle } from "./styles";

describe("rootStyle", () => {
  it("テーマのフォントを反映する", () => {
    const s = rootStyle(defaultTheme);
    expect(s["font-family"]).toBe(defaultTheme.fontFamily);
  });

  it("overrideStyle を後から重ねる（上書きできる）", () => {
    const s = rootStyle(defaultTheme, { width: "500px" });
    expect(s.width).toBe("500px");
  });
});

describe("editableInputStyle", () => {
  it("編集中はクリックを受け取り、テキストが見える色になる", () => {
    const s = editableInputStyle(true, defaultTheme);
    expect(s.pointerEvents).toBe("auto");
    expect(s.color).toBe(defaultTheme.textColor);
    expect(s.background).toBe("#ffffff");
  });

  it("非編集時はクリックを透過し、文字は透明", () => {
    const s = editableInputStyle(false, defaultTheme);
    expect(s.pointerEvents).toBe("none");
    expect(s.color).toBe("transparent");
  });
});

describe("dropdownItemStyle", () => {
  it("ハイライト中はテーマの強調色を背景にする", () => {
    const s = dropdownItemStyle(defaultTheme, true);
    expect(s.background).toBe(defaultTheme.headerActiveBackground);
  });
  it("非ハイライト時は透明", () => {
    const s = dropdownItemStyle(defaultTheme, false);
    expect(s.background).toBe("transparent");
  });
});
