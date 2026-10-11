import type { CellFormat, CellValue } from "../types";

/**
 * 入力欄のテキストを、セルに保存する値（CellValue）に変換する。
 * - 書式が number 指定なら、カンマを除去して数値化を試みる（失敗時は文字列のまま）
 * - 書式が無く、数値らしい文字列なら数値として保持する（Excel等からの貼り付けと挙動を合わせるため）
 * - それ以外はそのまま文字列として扱う
 */
export function coerceValue(text: string, format?: CellFormat): CellValue {
  if (format?.type === "number") {
    const n = Number(text.replace(/,/g, ""));
    return Number.isNaN(n) ? text : n;
  }
  if (!format && text.trim() !== "" && !Number.isNaN(Number(text))) {
    return Number(text);
  }
  return text;
}
