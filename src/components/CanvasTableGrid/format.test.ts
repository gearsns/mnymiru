import { describe, expect, it } from "vitest";
import {
  formatNumber,
  formatDate,
  formatCellValue,
  defaultAlign,
  defaultColumnHeaderLabel,
  defaultRowHeaderLabel,
} from "./format";

describe("formatNumber", () => {
  it("#,##0 は3桁区切りにする", () => {
    expect(formatNumber(1000, "#,##0")).toBe("1,000");
    expect(formatNumber(1234567, "#,##0")).toBe("1,234,567");
  });

  it("#,##0.00 は小数2桁にする", () => {
    expect(formatNumber(1000.5, "#,##0.00")).toBe("1,000.50");
  });

  it("0.0% はパーセント表示にする", () => {
    expect(formatNumber(0.125, "0.0%")).toBe("12.5%");
  });

  it("負の数にも対応する", () => {
    expect(formatNumber(-1000, "#,##0")).toBe("-1,000");
  });

  it("NaN は空文字を返す", () => {
    expect(formatNumber(NaN, "#,##0")).toBe("");
  });
});

describe("formatDate", () => {
  // タイムゾーン依存を避けるため、時刻付きのローカル日時文字列を使う
  const sep1 = "2024-09-01T12:00:00"; // 2024年9月1日は日曜日

  it("YYYY/MM/DD 形式にする", () => {
    expect(formatDate(sep1, "YYYY/MM/DD")).toBe("2024/09/01");
  });

  it("M/D(ddd) 形式にする（曜日は日本語1文字）", () => {
    expect(formatDate(sep1, "M/D(ddd)")).toBe("9/1(日)");
  });

  it("dddd で曜日フルネームにする", () => {
    expect(formatDate(sep1, "dddd")).toBe("日曜日");
  });

  it("null は空文字を返す", () => {
    expect(formatDate(null, "YYYY/MM/DD")).toBe("");
  });

  it("日付として解釈できない文字列はそのまま返す", () => {
    expect(formatDate("not a date", "YYYY/MM/DD")).toBe("not a date");
  });
});

describe("formatCellValue", () => {
  it("formatter が最優先される", () => {
    const result = formatCellValue(1000, { formatter: (v) => `¥${v}` });
    expect(result).toBe("¥1000");
  });

  it("null は空文字", () => {
    expect(formatCellValue(null)).toBe("");
  });

  it("type:number は数値書式を適用する", () => {
    expect(formatCellValue(1000, { type: "number" })).toBe("1,000");
  });

  it("type:date は日付書式を適用する", () => {
    expect(formatCellValue("2024-09-01T12:00:00", { type: "date", pattern: "M/D" })).toBe("9/1");
  });

  it("書式なしは String(value) と同じ", () => {
    expect(formatCellValue(42)).toBe("42");
    expect(formatCellValue("hello")).toBe("hello");
  });
});

describe("defaultAlign", () => {
  it("format.align が指定されていればそれを優先する", () => {
    expect(defaultAlign(1000, { align: "center" })).toBe("center");
  });

  it("数値は右寄せがデフォルト", () => {
    expect(defaultAlign(1000)).toBe("right");
    expect(defaultAlign("1000", { type: "number" })).toBe("right");
  });

  it("それ以外は左寄せがデフォルト", () => {
    expect(defaultAlign("hello")).toBe("left");
  });
});

describe("defaultColumnHeaderLabel", () => {
  it("A, B, C ... を返す", () => {
    expect(defaultColumnHeaderLabel(0)).toBe("A");
    expect(defaultColumnHeaderLabel(1)).toBe("B");
    expect(defaultColumnHeaderLabel(25)).toBe("Z");
  });

  it("26列目以降は AA, AB ... になる", () => {
    expect(defaultColumnHeaderLabel(26)).toBe("AA");
    expect(defaultColumnHeaderLabel(27)).toBe("AB");
    expect(defaultColumnHeaderLabel(51)).toBe("AZ");
    expect(defaultColumnHeaderLabel(52)).toBe("BA");
  });
});

describe("defaultRowHeaderLabel", () => {
  it("1始まりの連番を返す", () => {
    expect(defaultRowHeaderLabel(0)).toBe("1");
    expect(defaultRowHeaderLabel(9)).toBe("10");
  });
});
