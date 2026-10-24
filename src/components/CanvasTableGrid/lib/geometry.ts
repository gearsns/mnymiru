import type { SelectionRange } from "../types";
import { SPLIT_BAR_SIZE } from "./split";

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
  /** 左の pane に入れる列数（先頭から。省略時 0 = 左右に分割しない） */
  splitCols?: number;
  /** 上の pane に入れる行数（先頭から。省略時 0 = 上下に分割しない） */
  splitRows?: number;
  /** 左 pane の表示幅(px)。省略時は左 pane の列の合計幅（= スクロール不要で、従来の「固定」と同じ見た目） */
  leftWidth?: number;
  /** 上 pane の表示高さ(px)。省略時は上 pane の行の合計高さ */
  topHeight?: number;
  /**
   * 分割・固定のモード。"split" のときだけ、pane の境界に分割バー（SPLIT_BAR_SIZE）の幅の隙間ができ、
   * 右・下の pane がその分だけずれる。省略時・"freeze" では隙間なし。
   */
  splitMode?: "freeze" | "split";
}

/**
 * スクロール位置。pane ごとに独立しているが、同じ軸を共有する pane は同じ値を使う（= スクロールが同期する）。
 *   x  … 右 pane（右上・右下）の横スクロール量。分割しなければ表全体の横スクロール量
 *   y  … 下 pane（左下・右下）の縦スクロール量。分割しなければ表全体の縦スクロール量
 *   lx … 左 pane（左上・左下）の横スクロール量（省略時 0）
 *   ty … 上 pane（左上・右上）の縦スクロール量（省略時 0）
 * いずれも「その pane のコンテンツの先頭を 0 とした」量。
 */
export interface ScrollPosition {
  x: number;
  y: number;
  lx?: number;
  ty?: number;
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

// ---------------------------------------------------------------------------
// 分割（pane）
//
// 先頭 splitCols 列を「左 pane」、先頭 splitRows 行を「上 pane」とし、残りと合わせて最大4つの pane に分ける。
//   左上 | 右上
//   ─────┼─────
//   左下 | 右下 （= 分割しなければ表全体）
// 各 pane はそれぞれのサイズ（leftWidth / topHeight）で表示され、内容がはみ出せば自分でスクロールする。
// 横方向は「左上と左下」「右上と右下」、縦方向は「左上と右上」「左下と右下」が同じスクロール量を共有する（同期）。
// 画面座標への変換は colEdgeX / colEndX / rowEdgeY / rowEndY に集約し、
// 「どの pane の座標か」の判定はここだけで行う。
// ---------------------------------------------------------------------------

function splitColsOf(layout: GridLayout): number {
  return layout.splitCols ?? 0;
}
function splitRowsOf(layout: GridLayout): number {
  return layout.splitRows ?? 0;
}

/** 左 pane の表示幅(px)。分割していなければ 0 */
function leftWidthOf(layout: GridLayout, metrics: Metrics): number {
  const k = splitColsOf(layout);
  return k > 0 ? (layout.leftWidth ?? metrics.colOffsets[k] ?? 0) : 0;
}
/** 上 pane の表示高さ(px)。分割していなければ 0 */
function topHeightOf(layout: GridLayout, metrics: Metrics): number {
  const n = splitRowsOf(layout);
  return n > 0 ? (layout.topHeight ?? metrics.rowOffsets[n] ?? 0) : 0;
}

/**
 * 分割バーの隙間(px)。分割モードで、その軸を分割しているときだけ SPLIT_BAR_SIZE（それ以外は 0）。
 * 左 pane と右 pane の間（w）、上 pane と下 pane の間（h）に入り、右・下の pane をその分だけずらす。
 */
export function paneGap(layout: GridLayout): { w: number; h: number } {
  const split = layout.splitMode === "split";
  return {
    w: split && splitColsOf(layout) > 0 ? SPLIT_BAR_SIZE : 0,
    h: split && splitRowsOf(layout) > 0 ? SPLIT_BAR_SIZE : 0,
  };
}

/** 左 pane の幅 w・上 pane の高さ h（px）。分割していない軸は 0 */
export function paneExtent(layout: GridLayout, metrics: Metrics): { w: number; h: number } {
  return { w: leftWidthOf(layout, metrics), h: topHeightOf(layout, metrics) };
}

/**
 * ピクセル座標 -> セル位置。ヘッダ領域内なら null を返す。
 * 左・上の pane の中ではその pane のスクロール量、右・下の pane の中では右・下のスクロール量を加えて判定する。
 */
export function pixelToCell(
  layout: GridLayout,
  metrics: Metrics,
  scroll: ScrollPosition,
  px: number,
  py: number
): { row: number; col: number } | null {
  if (px < layout.headerWidth || py < layout.headerHeight) return null;
  const k = splitColsOf(layout);
  const n = splitRowsOf(layout);
  const w = leftWidthOf(layout, metrics);
  const h = topHeightOf(layout, metrics);
  const dx = px - layout.headerWidth;
  const dy = py - layout.headerHeight;
  const gap = paneGap(layout);
  const inLeft = k > 0 && dx < w;
  const inTop = n > 0 && dy < h;
  // pane の中の位置を、コンテンツ座標（colOffsets / rowOffsets と同じ座標）に直す
  // 分割バーの上（隙間）は、右・下の pane の先頭として扱う
  const gx = inLeft
    ? dx + (scroll.lx ?? 0)
    : k > 0
      ? metrics.colOffsets[k] + Math.max(0, dx - w - gap.w) + scroll.x
      : dx + scroll.x;
  const gy = inTop
    ? dy + (scroll.ty ?? 0)
    : n > 0
      ? metrics.rowOffsets[n] + Math.max(0, dy - h - gap.h) + scroll.y
      : dy + scroll.y;

  let col = -1;
  for (let c = 0; c < layout.cols; c++) {
    if (gx >= metrics.colOffsets[c] && gx < metrics.colOffsets[c + 1]) {
      col = c;
      break;
    }
  }
  if (col === -1) col = layout.cols - 1;
  if (inLeft && col >= k) col = k - 1; // 左 pane の内容より広い余白は、左 pane の最後の列とみなす

  let row = -1;
  for (let r = 0; r < layout.rows; r++) {
    if (gy >= metrics.rowOffsets[r] && gy < metrics.rowOffsets[r + 1]) {
      row = r;
      break;
    }
  }
  if (row === -1) row = layout.rows - 1;
  if (inTop && row >= n) row = n - 1;

  return { row, col };
}

/**
 * 列ヘッダ上で、境界線付近(px)にいるかを判定し、あればその左側の列番号を返す。
 * リサイズハンドルの当たり判定に使う。
 * 左 pane の境界（左 pane のスクロールを反映）→ 右 pane の境界（右のスクロールを反映）の順に調べる。
 * 自分の pane からはみ出して隠れている列の境界には反応しない。
 */
export function findColumnBorderNear(params: {
  metrics: Metrics;
  cols: number;
  headerWidth: number;
  /** 右 pane（分割しなければ表全体）の横スクロール量 */
  scrollX: number;
  px: number;
  resizeHandlePx: number;
  /** 左 pane の列数（省略時 0） */
  splitCols?: number;
  /** 左 pane の表示幅(px)。splitCols > 0 のとき必要 */
  leftWidth?: number;
  /** 左 pane の横スクロール量（省略時 0） */
  leftScrollX?: number;
  /** 左 pane と右 pane の間の分割バーの隙間(px)（省略時 0） */
  gap?: number;
}): number | null {
  const { metrics, cols, headerWidth, scrollX, px, resizeHandlePx } = params;
  const k = params.splitCols ?? 0;
  const w = k > 0 ? (params.leftWidth ?? metrics.colOffsets[k] ?? 0) : 0;
  const lx = params.leftScrollX ?? 0;
  const gap = k > 0 ? (params.gap ?? 0) : 0;

  // 左 pane の境界（c = 1..k。c = k は左 pane の最後の列の右端）
  if (k > 0) {
    for (let c = 1; c <= k; c++) {
      const sx = headerWidth + metrics.colOffsets[c] - lx;
      if (sx > headerWidth + w + resizeHandlePx) break; // これより右は左 pane からはみ出して見えない
      if (sx >= headerWidth - resizeHandlePx && Math.abs(sx - px) <= resizeHandlePx) return c - 1;
    }
    // 左 pane の内側（と分割バーの上）にいるなら、右 pane の境界は調べない（隠れているため）
    if (px < headerWidth + w + gap) return null;
  }

  const base = k > 0 ? metrics.colOffsets[k] : 0;
  const contentX = k > 0 ? px - headerWidth - w - gap + base + scrollX : px - headerWidth + scrollX;
  let first = findFirstVisible(metrics.colOffsets, base + scrollX);
  if (k > 0) first = Math.max(first, k + 1);
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

/**
 * 列 col の左端 x（canvas ローカル座標。ヘッダ幅と、その列が属する pane のスクロールを反映済み）。
 * 左 pane の列は左のスクロール量（lx）、右 pane の列は右のスクロール量（x）で動く。
 * 右 pane の先頭列は、左 pane の右端（= ヘッダ幅 + 左 pane の幅）から始まる。
 * col に cols を渡すと表の右端になる。
 */
export function colEdgeX(layout: GridLayout, metrics: Metrics, scroll: ScrollPosition, col: number): number {
  const k = splitColsOf(layout);
  if (k === 0) return layout.headerWidth + metrics.colOffsets[col] - scroll.x;
  if (col < k) return layout.headerWidth + metrics.colOffsets[col] - (scroll.lx ?? 0);
  return layout.headerWidth + leftWidthOf(layout, metrics) + paneGap(layout).w + (metrics.colOffsets[col] - metrics.colOffsets[k]) - scroll.x;
}

/** 列 col の右端 x（col が属する pane のスクロールを反映済み） */
export function colEndX(layout: GridLayout, metrics: Metrics, scroll: ScrollPosition, col: number): number {
  const k = splitColsOf(layout);
  if (k === 0) return layout.headerWidth + metrics.colOffsets[col + 1] - scroll.x;
  if (col < k) return layout.headerWidth + metrics.colOffsets[col + 1] - (scroll.lx ?? 0);
  return layout.headerWidth + leftWidthOf(layout, metrics) + paneGap(layout).w + (metrics.colOffsets[col + 1] - metrics.colOffsets[k]) - scroll.x;
}

/** 行 row の上端 y（canvas ローカル座標。上 pane の行は ty、下 pane の行は y で動く）。row に rows を渡すと表の下端になる。 */
export function rowEdgeY(layout: GridLayout, metrics: Metrics, scroll: ScrollPosition, row: number): number {
  const n = splitRowsOf(layout);
  if (n === 0) return layout.headerHeight + metrics.rowOffsets[row] - scroll.y;
  if (row < n) return layout.headerHeight + metrics.rowOffsets[row] - (scroll.ty ?? 0);
  return layout.headerHeight + topHeightOf(layout, metrics) + paneGap(layout).h + (metrics.rowOffsets[row] - metrics.rowOffsets[n]) - scroll.y;
}

/** 行 row の下端 y */
export function rowEndY(layout: GridLayout, metrics: Metrics, scroll: ScrollPosition, row: number): number {
  const n = splitRowsOf(layout);
  if (n === 0) return layout.headerHeight + metrics.rowOffsets[row + 1] - scroll.y;
  if (row < n) return layout.headerHeight + metrics.rowOffsets[row + 1] - (scroll.ty ?? 0);
  return layout.headerHeight + topHeightOf(layout, metrics) + paneGap(layout).h + (metrics.rowOffsets[row + 1] - metrics.rowOffsets[n]) - scroll.y;
}

/** セル(row,col)の、canvas ローカル座標での矩形（ヘッダ分のオフセットとスクロールを反映済み） */
export function cellRect(layout: GridLayout, metrics: Metrics, scroll: ScrollPosition, row: number, col: number): Rect {
  return {
    x: colEdgeX(layout, metrics, scroll, col),
    y: rowEdgeY(layout, metrics, scroll, row),
    w: layout.colWidths[col],
    h: layout.rowHeights[row],
  };
}

/**
 * 選択範囲（r1..r2, c1..c2 のセル全体）を囲む、canvas ローカル座標での矩形。
 * 範囲が複数の pane にまたがる場合は実際の見た目とずれるので、
 * その場合は呼び出し側で pane ごとに範囲を分けてから渡すこと（drawOverlays.ts 参照）。
 */
export function rangeRect(layout: GridLayout, metrics: Metrics, scroll: ScrollPosition, range: SelectionRange): Rect {
  const x1 = colEdgeX(layout, metrics, scroll, range.c1);
  const y1 = rowEdgeY(layout, metrics, scroll, range.r1);
  const x2 = colEndX(layout, metrics, scroll, range.c2);
  const y2 = rowEndY(layout, metrics, scroll, range.r2);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// ---------------------------------------------------------------------------
// 描画領域（ペイン）
// ---------------------------------------------------------------------------

/** 1つの軸（行 or 列）の区間。先頭側の pane（左・上）と、残りの pane（右・下）の2種類がある */
export interface AxisSegment {
  /** この区間に属する行（列）のインデックス範囲。end は含まない */
  start: number;
  end: number;
  /** 実際に描画を始める最初のインデックス（その pane のスクロール位置で、見えている最初の行・列） */
  first: number;
  /** この値より小さいオフセットの行（列）だけを描画する（コンテンツ座標） */
  lastOffset: number;
  /** この区間が画面上で占める範囲（canvas ローカル座標）。この外にははみ出させない */
  clipStart: number;
  clipSize: number;
  /** 先頭側の pane（左・上）か */
  leading: boolean;
}

/** 左右・上下の分割の組み合わせで決まる、描画の単位（左上、右上、左下、右下） */
export interface Pane {
  rows: AxisSegment;
  cols: AxisSegment;
  /** この領域のクリップ矩形（canvas ローカル座標） */
  clip: Rect;
}

export interface ViewLayout {
  /** 描画順は [右・下の区間, 先頭側（左・上）の区間(あれば)] */
  rows: AxisSegment[];
  cols: AxisSegment[];
  /** rows × cols の組み合わせ。先頭は右下（分割しなければ表全体で1つだけ） */
  panes: Pane[];
}

function axisSegments(params: {
  offsets: number[];
  count: number;
  /** 先頭側の pane に入れる行（列）数 */
  split: number;
  /** 先頭側の pane の表示サイズ(px) */
  leadSize: number;
  /** 先頭側 pane のスクロール量 */
  scrollLead: number;
  /** 残りの pane のスクロール量 */
  scrollMain: number;
  headerSize: number;
  canvasSize: number;
  /** 先頭側 pane と残りの pane の間の分割バーの隙間(px)。残りの pane はその分だけずれて、小さくなる */
  gap: number;
}): AxisSegment[] {
  const { offsets, count, split, scrollLead, scrollMain, headerSize, canvasSize } = params;
  const avail = Math.max(0, canvasSize - headerSize);
  const leadSize = split > 0 ? params.leadSize : 0;
  const gap = split > 0 ? params.gap : 0;
  const base = split > 0 ? (offsets[split] ?? 0) : 0; // 残りの pane のコンテンツの先頭（コンテンツ座標）

  let first = findFirstVisible(offsets, base + scrollMain);
  if (split > 0) first = Math.max(first, split);
  const mainSeg: AxisSegment = {
    start: split,
    end: count,
    first,
    lastOffset: base + scrollMain + (canvasSize - headerSize - leadSize - gap),
    clipStart: headerSize + leadSize + gap,
    clipSize: Math.max(0, avail - leadSize - gap),
    leading: false,
  };
  if (split <= 0) return [mainSeg];

  const leadSeg: AxisSegment = {
    start: 0,
    end: split,
    first: Math.min(split - 1, findFirstVisible(offsets, scrollLead)),
    lastOffset: scrollLead + leadSize + 1,
    clipStart: headerSize,
    clipSize: Math.min(leadSize, avail),
    leading: true,
  };
  return [mainSeg, leadSeg];
}

/** スクロール位置と canvas サイズから、描画すべき領域（ペイン）を求める */
export function computeViewLayout(
  layout: GridLayout,
  metrics: Metrics,
  scroll: ScrollPosition,
  canvas: { width: number; height: number }
): ViewLayout {
  const extent = paneExtent(layout, metrics);
  const gap = paneGap(layout);
  const rows = axisSegments({
    offsets: metrics.rowOffsets,
    count: layout.rows,
    split: splitRowsOf(layout),
    leadSize: extent.h,
    scrollLead: scroll.ty ?? 0,
    scrollMain: scroll.y,
    headerSize: layout.headerHeight,
    canvasSize: canvas.height,
    gap: gap.h,
  });
  const cols = axisSegments({
    offsets: metrics.colOffsets,
    count: layout.cols,
    split: splitColsOf(layout),
    leadSize: extent.w,
    scrollLead: scroll.lx ?? 0,
    scrollMain: scroll.x,
    headerSize: layout.headerWidth,
    canvasSize: canvas.width,
    gap: gap.w,
  });
  const panes: Pane[] = [];
  for (const r of rows) {
    for (const c of cols) {
      panes.push({ rows: r, cols: c, clip: { x: c.clipStart, y: r.clipStart, w: c.clipSize, h: r.clipSize } });
    }
  }
  return { rows, cols, panes };
}

/** 各 pane の、スクロールする領域の見えているサイズ(px)（スクロールバーの分を除く） */
export interface PaneViewport {
  leftW: number;
  rightW: number;
  topH: number;
  bottomH: number;
}

/**
 * 指定したセル(row,col)が表示領域内に収まるよう、必要なら補正した新しいスクロール位置を返す。
 * すでに見えている場合はそのままのスクロール位置を返す。
 * セルが属する pane のスクロールだけを動かす（左の列なら lx、右の列なら x、上の行なら ty、下の行なら y）。
 * 同じ軸を共有する pane は同じスクロール量を使うので、動かすと同期して動く。
 */
export function computeEnsureVisibleScroll(
  metrics: Metrics,
  scroll: ScrollPosition,
  view: PaneViewport,
  row: number,
  col: number,
  split: { rows: number; cols: number } = { rows: 0, cols: 0 }
): Required<ScrollPosition> {
  let { x, y } = scroll;
  let lx = scroll.lx ?? 0;
  let ty = scroll.ty ?? 0;

  if (col < split.cols) {
    const x0 = metrics.colOffsets[col];
    const x1 = metrics.colOffsets[col + 1];
    if (x0 < lx) lx = x0;
    else if (x1 > lx + view.leftW) lx = x1 - view.leftW;
  } else {
    const base = split.cols > 0 ? metrics.colOffsets[split.cols] : 0;
    const x0 = metrics.colOffsets[col] - base;
    const x1 = metrics.colOffsets[col + 1] - base;
    if (x0 < x) x = x0;
    else if (x1 > x + view.rightW) x = x1 - view.rightW;
  }

  if (row < split.rows) {
    const y0 = metrics.rowOffsets[row];
    const y1 = metrics.rowOffsets[row + 1];
    if (y0 < ty) ty = y0;
    else if (y1 > ty + view.topH) ty = y1 - view.topH;
  } else {
    const base = split.rows > 0 ? metrics.rowOffsets[split.rows] : 0;
    const y0 = metrics.rowOffsets[row] - base;
    const y1 = metrics.rowOffsets[row + 1] - base;
    if (y0 < y) y = y0;
    else if (y1 > y + view.bottomH) y = y1 - view.bottomH;
  }
  return { x, y, lx, ty };
}
