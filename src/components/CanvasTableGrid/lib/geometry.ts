import type { SelectionRange } from "../types";

/**
 * 座標計算に必要な最小限のグリッドの形状情報。
 * GridStore はこれらのフィールドをすべて持つため、そのまま渡せる
 * （このモジュール自体は GridStore に依存しない）。
 */
export interface GridLayout {
  rows: number;
  cols: number;
  colWidths: ArrayLike<number>;
  rowHeights: ArrayLike<number>;
  headerWidth: number;
  headerHeight: number;
}

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface Metrics {
  /** colOffsets[c] = セルcの左端x（ヘッダ除くスクロール座標） */
  colOffsets: number[];
  rowOffsets: number[];
}

/** セル内テキストの左右パディング(px)。編集開始時のカーソル位置計算でも同じ値を使う。 */
export const TEXT_PADDING = 6;

/** 列幅・行高から、各列・各行の開始オフセット(px)を求める */
export function computeMetrics(layout: GridLayout): Metrics {
  const colOffsets: number[] = [0];
  for (let c = 0; c < layout.cols; c++) colOffsets.push(colOffsets[c] + layout.colWidths[c]);
  const rowOffsets: number[] = [0];
  for (let r = 0; r < layout.rows; r++) rowOffsets.push(rowOffsets[r] + layout.rowHeights[r]);
  return { colOffsets, rowOffsets };
}

/** ソート済みオフセット配列の中から、スクロール位置以降で最初に表示されるインデックスを二分探索で求める */
export function findFirstVisible(offsets: number[], scroll: number): number {
  let lo = 0;
  let hi = offsets.length - 2;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid + 1] <= scroll) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, lo);
}

/** ピクセル座標 -> セル位置。ヘッダ領域内なら null を返す */
export function pixelToCell(
  layout: GridLayout,
  metrics: Metrics,
  scroll: ScrollPosition,
  px: number,
  py: number
): { row: number; col: number } | null {
  if (px < layout.headerWidth || py < layout.headerHeight) return null;
  const gx = px - layout.headerWidth + scroll.x;
  const gy = py - layout.headerHeight + scroll.y;

  let col = -1;
  for (let c = 0; c < layout.cols; c++) {
    if (gx >= metrics.colOffsets[c] && gx < metrics.colOffsets[c + 1]) {
      col = c;
      break;
    }
  }
  if (col === -1) col = layout.cols - 1;

  let row = -1;
  for (let r = 0; r < layout.rows; r++) {
    if (gy >= metrics.rowOffsets[r] && gy < metrics.rowOffsets[r + 1]) {
      row = r;
      break;
    }
  }
  if (row === -1) row = layout.rows - 1;

  return { row, col };
}

/**
 * 列ヘッダ上で、境界線付近(px)にいるかを判定し、あればその左側の列番号を返す。
 * リサイズハンドルの当たり判定に使う。
 */
export function findColumnBorderNear(params: {
  metrics: Metrics;
  cols: number;
  headerWidth: number;
  scrollX: number;
  px: number;
  resizeHandlePx: number;
}): number | null {
  const { metrics, cols, headerWidth, scrollX, px, resizeHandlePx } = params;
  const contentX = px - headerWidth + scrollX;
  const first = findFirstVisible(metrics.colOffsets, scrollX);
  for (let c = first; c <= cols; c++) {
    const offset = metrics.colOffsets[c];
    if (offset - contentX > resizeHandlePx) break;
    if (Math.abs(offset - contentX) <= resizeHandlePx) {
      return c - 1 >= 0 ? c - 1 : null;
    }
  }
  return null;
}

/** 指定したセル(row,col)が選択範囲に含まれるか */
export function inRange(range: SelectionRange, row: number, col: number): boolean {
  return row >= range.r1 && row <= range.r2 && col >= range.c1 && col <= range.c2;
}

/** 数値を [lo, hi] の範囲に収める */
export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** セル(row,col)の、canvas ローカル座標での矩形（ヘッダ分のオフセットとスクロールを反映済み） */
export function cellRect(layout: GridLayout, metrics: Metrics, scroll: ScrollPosition, row: number, col: number): Rect {
  return {
    x: layout.headerWidth + metrics.colOffsets[col] - scroll.x,
    y: layout.headerHeight + metrics.rowOffsets[row] - scroll.y,
    w: layout.colWidths[col],
    h: layout.rowHeights[row],
  };
}

/**
 * 指定したセル(row,col)が表示領域内に収まるよう、必要なら補正した新しいスクロール位置を返す。
 * すでに見えている場合はそのままのスクロール位置を返す。
 */
export function computeEnsureVisibleScroll(
  metrics: Metrics,
  scroll: ScrollPosition,
  viewport: { w: number; h: number },
  row: number,
  col: number
): ScrollPosition {
  let { x, y } = scroll;
  const cellX0 = metrics.colOffsets[col];
  const cellX1 = metrics.colOffsets[col + 1];
  const cellY0 = metrics.rowOffsets[row];
  const cellY1 = metrics.rowOffsets[row + 1];
  if (cellX0 < x) x = cellX0;
  else if (cellX1 > x + viewport.w) x = cellX1 - viewport.w;
  if (cellY0 < y) y = cellY0;
  else if (cellY1 > y + viewport.h) y = cellY1 - viewport.h;
  return { x, y };
}

