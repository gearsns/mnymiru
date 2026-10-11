import type { SelectionRange } from "../types";

/**
 * 貼り付けたテキストの行列数と貼り付け開始位置から、貼り付け先の範囲を求める。
 * growRows が false の場合、現在の行数・列数を超える分は切り詰める（従来のExcel的な挙動）。
 * growRows が true の場合、行方向は切り詰めずそのまま（呼び出し側が事前に行数を確保する前提）。
 * 列方向は常にグリッドの列数までに収める（列の自動追加は非対応のため）。
 */
export function computePasteRange(params: {
  start: { row: number; col: number };
  pastedRows: number;
  pastedCols: number;
  totalRows: number;
  totalCols: number;
  growRows: boolean;
}): SelectionRange {
  const { start, pastedRows, pastedCols, totalRows, totalCols, growRows } = params;
  const rawEndRow = start.row + pastedRows - 1;
  const rawEndCol = start.col + pastedCols - 1;
  const r2 = growRows ? rawEndRow : Math.min(rawEndRow, Math.max(start.row, totalRows - 1));
  const c2 = Math.min(rawEndCol, Math.max(start.col, totalCols - 1));
  return { r1: start.row, c1: start.col, r2, c2 };
}


/**
 * 選択範囲を Excel 互換のタブ区切りテキスト(TSV)に変換する。
 * getCellText(row, col) はそのセルの「生の値」を文字列で返す関数を渡す
 * （フォーマット適用後の表示文字列ではなく、貼り付け先で正しく数値等として
 * 解釈されるよう生の値を使う）。
 */
export function buildClipboardText(range: SelectionRange, getCellText: (row: number, col: number) => string): string {
  const lines: string[] = [];
  for (let r = range.r1; r <= range.r2; r++) {
    const cols: string[] = [];
    for (let c = range.c1; c <= range.c2; c++) cols.push(getCellText(r, c));
    lines.push(cols.join("\t"));
  }
  return lines.join("\n");
}

/**
 * Excel/スプレッドシートなどからのタブ区切り・改行区切りテキストを2次元配列に変換する。
 * コピー時に付与されがちな末尾の空行は取り除く。
 */
export function parseClipboardText(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((line) => line.split("\t"));
}
