import { describe, expect, it } from "vitest";
import { buildClipboardText, computePasteRange, parseClipboardText } from "./clipboard";

describe("buildClipboardText", () => {
  it("範囲をタブ区切り・改行区切りのテキストに変換する", () => {
    const data: Record<string, string> = {
      "0,0": "a",
      "0,1": "b",
      "1,0": "c",
      "1,1": "d",
    };
    const getCellText = (r: number, c: number) => data[`${r},${c}`] ?? "";
    const text = buildClipboardText({ r1: 0, c1: 0, r2: 1, c2: 1 }, getCellText);
    expect(text).toBe("a\tb\nc\td");
  });

  it("1x1の範囲なら改行やタブを含まない", () => {
    const text = buildClipboardText({ r1: 2, c1: 3, r2: 2, c2: 3 }, () => "value");
    expect(text).toBe("value");
  });
});

describe("parseClipboardText", () => {
  it("タブと改行で2次元配列に分解する", () => {
    expect(parseClipboardText("a\tb\nc\td")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("Excel由来のCRLFも正しく扱う", () => {
    expect(parseClipboardText("a\tb\r\nc\td")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("末尾の空行（コピー時に付与されがち）は除去する", () => {
    expect(parseClipboardText("a\tb\n")).toEqual([["a", "b"]]);
  });

  it("1行だけの末尾改行なしはそのまま", () => {
    expect(parseClipboardText("single")).toEqual([["single"]]);
  });
});

describe("computePasteRange", () => {
  it("growRows=false のとき行・列とも現在の範囲に収める", () => {
    const range = computePasteRange({
      start: { row: 8, col: 2 },
      pastedRows: 5,
      pastedCols: 3,
      totalRows: 10,
      totalCols: 4,
      growRows: false,
    });
    expect(range).toEqual({ r1: 8, c1: 2, r2: 9, c2: 3 });
  });

  it("growRows=true のとき行は切り詰めない（呼び出し側で行を確保する前提）", () => {
    const range = computePasteRange({
      start: { row: 8, col: 0 },
      pastedRows: 5,
      pastedCols: 2,
      totalRows: 10,
      totalCols: 4,
      growRows: true,
    });
    expect(range).toEqual({ r1: 8, c1: 0, r2: 12, c2: 1 });
  });

  it("列は growRows に関わらず常に切り詰める", () => {
    const range = computePasteRange({
      start: { row: 0, col: 2 },
      pastedRows: 1,
      pastedCols: 5,
      totalRows: 10,
      totalCols: 4,
      growRows: true,
    });
    expect(range).toEqual({ r1: 0, c1: 2, r2: 0, c2: 3 });
  });

  it("範囲内に収まる貼り付けはそのまま", () => {
    const range = computePasteRange({
      start: { row: 0, col: 0 },
      pastedRows: 2,
      pastedCols: 2,
      totalRows: 10,
      totalCols: 10,
      growRows: false,
    });
    expect(range).toEqual({ r1: 0, c1: 0, r2: 1, c2: 1 });
  });
});
