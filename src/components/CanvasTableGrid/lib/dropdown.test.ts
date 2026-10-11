import { describe, expect, it } from "vitest";
import { cycleHighlightIndex, filterDropdownOptions, optionLabel } from "./dropdown";

const options = [
  { value: "todo", label: "未着手" },
  { value: "doing", label: "対応中" },
  { value: "done", label: "完了" },
];

describe("filterDropdownOptions", () => {
  it("空クエリなら全件返す", () => {
    expect(filterDropdownOptions(options, "")).toEqual(options);
  });

  it("labelの部分一致で絞り込む", () => {
    expect(filterDropdownOptions(options, "中")).toEqual([options[1]]);
  });

  it("大文字小文字を無視する", () => {
    const opts = [{ value: "A", label: "Apple" }, { value: "B", label: "banana" }];
    expect(filterDropdownOptions(opts, "APP")).toEqual([opts[0]]);
  });

  it("labelが無ければvalueの文字列表現で絞り込む", () => {
    const opts = [{ value: 1000 }, { value: 2000 }];
    expect(filterDropdownOptions(opts, "1000")).toEqual([opts[0]]);
  });
});

describe("optionLabel", () => {
  it("labelがあればそれを使う", () => {
    expect(optionLabel({ value: "x", label: "ラベル" })).toBe("ラベル");
  });
  it("labelが無ければvalueの文字列表現", () => {
    expect(optionLabel({ value: 42 })).toBe("42");
  });
  it("valueがnullなら空文字", () => {
    expect(optionLabel({ value: null })).toBe("");
  });
});

describe("cycleHighlightIndex", () => {
  it("下方向は+1、末尾から先頭へ循環する", () => {
    expect(cycleHighlightIndex(0, 3, 1)).toBe(1);
    expect(cycleHighlightIndex(2, 3, 1)).toBe(0);
  });
  it("上方向は-1、先頭(または-1)から末尾へ循環する", () => {
    expect(cycleHighlightIndex(1, 3, -1)).toBe(0);
    expect(cycleHighlightIndex(0, 3, -1)).toBe(2);
    expect(cycleHighlightIndex(-1, 3, -1)).toBe(2);
  });
  it("要素数0なら-1", () => {
    expect(cycleHighlightIndex(0, 0, 1)).toBe(-1);
  });
});
