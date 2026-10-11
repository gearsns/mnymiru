import { describe, expect, it } from "vitest";
import { computeCaretIndex } from "./caret";

// 等幅フォントを想定した簡易 measureText（1文字10px）
const monospace = (text: string) => text.length * 10;

describe("computeCaretIndex", () => {
  it("表示文字列が空なら0を返す", () => {
    const index = computeCaretIndex({
      rawText: "",
      displayText: "",
      align: "left",
      cellX: 0,
      cellWidth: 100,
      clickX: 50,
      measureText: monospace,
    });
    expect(index).toBe(0);
  });

  it("左寄せ・書式なし: クリック位置に応じた文字境界を返す（先頭付近）", () => {
    const index = computeCaretIndex({
      rawText: "abc",
      displayText: "abc",
      align: "left",
      cellX: 0,
      cellWidth: 200,
      clickX: 0, // パディング分左なので、限りなく先頭
      textPadding: 0,
      measureText: monospace,
    });
    expect(index).toBe(0);
  });

  it("左寄せ・書式なし: 文字の途中をクリックすると近い境界に丸める", () => {
    const index = computeCaretIndex({
      rawText: "abc",
      displayText: "abc",
      align: "left",
      cellX: 0,
      cellWidth: 200,
      clickX: 16, // 2文字目(10-20px)の範囲内、中間点(15px)より右
      textPadding: 0,
      measureText: monospace,
    });
    expect(index).toBe(2);
  });

  it("左寄せ・書式なし: 末尾より右をクリックすると末尾になる", () => {
    const index = computeCaretIndex({
      rawText: "abc",
      displayText: "abc",
      align: "left",
      cellX: 0,
      cellWidth: 200,
      clickX: 9999,
      textPadding: 0,
      measureText: monospace,
    });
    expect(index).toBe(3);
  });

  it("書式あり（表示文字列と生文字列が異なる）場合は比例配分した位置になる", () => {
    // rawText="1000"(4文字) に対して displayText="1,000"(5文字) というカンマ区切り表示を想定
    const index = computeCaretIndex({
      rawText: "1000",
      displayText: "1,000",
      align: "left",
      cellX: 0,
      cellWidth: 200,
      clickX: 20, // displayText上では3文字目("1,0"の右端寄り)に相当する位置
      textPadding: 0,
      measureText: monospace,
    });
    // displayIndex=2 (5文字中) -> ratio 0.4 -> 生文字列(4文字)換算で round(0.4*4)=2
    expect(index).toBe(2);
  });

  it("右寄せ: セル右端付近をクリックすると末尾寄りの位置になる", () => {
    const index = computeCaretIndex({
      rawText: "abc",
      displayText: "abc",
      align: "right",
      cellX: 0,
      cellWidth: 100,
      clickX: 100,
      textPadding: 0,
      measureText: monospace,
    });
    expect(index).toBe(3);
  });

  it("中央寄せ: セル中央をクリックすると中間あたりの位置になる", () => {
    // textWidth=30, center of 100px cell -> leftX = 50 - 15 = 35, text spans 35..65
    const index = computeCaretIndex({
      rawText: "abc",
      displayText: "abc",
      align: "center",
      cellX: 0,
      cellWidth: 100,
      clickX: 50, // ほぼ中央
      textPadding: 0,
      measureText: monospace,
    });
    expect(index).toBeGreaterThanOrEqual(1);
    expect(index).toBeLessThanOrEqual(2);
  });
});
