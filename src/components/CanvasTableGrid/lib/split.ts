/**
 * 分割（左右・上下の pane）の境界のバーに関する純粋関数。DOM・Solid・store には依存しない。
 * バーは pane の境界に SPLIT_BAR_SIZE の幅の隙間として入り、右・下の pane はその分だけずれる（lib/geometry.ts の paneGap）。
 * 隙間は左・上の pane の直後（左 pane の右端 = バーの左端、バーの右端 = 右 pane の左端）にある。
 */
import { SCROLLBAR_SIZE } from "./scrollbar";

/** 境界のバーの太さ(px)。描画・当たり判定で共有する */
export const SPLIT_BAR_SIZE = 4;
/** バーの当たり判定の余裕(px)。太さの外側にこれだけ広げて、つかみやすくする */
export const SPLIT_HIT_SLOP = 3;
/**
 * 最小サイズ(px)の基準。
 *   - 右・下の pane には、常にこれだけの大きさを残す（左・上の pane の上限を決める）
 *   - 左・上の pane は、先頭の列（行）がこれより小さければ、その先頭の列（行）が全部見える大きさまで縮められる
 *     （minPaneSize 参照）
 */
export const MIN_PANE_SIZE = 40;
/** どんなに小さい列（行）でも、左・上の pane をこれより小さくはしない（スクロールバーのつまみが使えなくなるため） */
export const MIN_PANE_FLOOR = 16;

/**
 * ドラッグで縮められる、左・上の pane の最小サイズ。
 * 先頭の列（行）の大きさ firstSize が MIN_PANE_SIZE より小さければ、その大きさ（先頭の列・行がちょうど全部見える）、
 * 大きければ MIN_PANE_SIZE（広い列を、狭い pane の中でスクロールして見られる）。下限は MIN_PANE_FLOOR。
 * 例: 高さ 28px の1行だけを上 pane にしたとき、28px まで縮められる（それ以上は縮まらないが、広がりもしない）。
 */
export function minPaneSize(firstSize: number): number {
  return Math.min(MIN_PANE_SIZE, Math.max(firstSize, MIN_PANE_FLOOR));
}

/**
 * 座標 (px, py) が、分割の境界のバーの上か。縦のバー（左右 pane の境界）・横のバー（上下 pane の境界）のどちらか、
 * または交点（両方）のとき、その向きを返す。どちらでもなければ null。
 * バーはヘッダの下・右から、キャンバスの端（スクロールバーの帯の中まで）にある。
 * 列ヘッダの上にはない（列ヘッダの境界は列幅の変更に使うため）。
 * スクロールバーの継ぎ目の付近は、スクロールバーよりバーを優先してつかめる（呼び出し側で先に判定する）。
 */
export function hitSplitBar(params: {
  px: number;
  py: number;
  width: number;
  height: number;
  headerWidth: number;
  headerHeight: number;
  /** 左 pane の表示幅・上 pane の表示高さ */
  leftW: number;
  topH: number;
  splitCols: number;
  splitRows: number;
  /** 分割バーの隙間(px)（= paneGap。省略時 SPLIT_BAR_SIZE） */
  gapW?: number;
  gapH?: number;
}): { v: boolean; h: boolean } | null {
  const { px, py, width, height, headerWidth: hw, headerHeight: hh } = params;
  const reach = SPLIT_BAR_SIZE / 2 + SPLIT_HIT_SLOP;
  // バーの中心 = 左（上）pane の端 + 隙間の半分
  const cx = hw + params.leftW + (params.gapW ?? SPLIT_BAR_SIZE) / 2;
  const cy = hh + params.topH + (params.gapH ?? SPLIT_BAR_SIZE) / 2;
  const v = params.splitCols > 0 && Math.abs(px - cx) <= reach && py >= hh && py < height;
  const h = params.splitRows > 0 && Math.abs(py - cy) <= reach && px >= hw && px < width;
  return v || h ? { v, h } : null;
}

/**
 * 左 pane の幅の上限。右 pane にも最低 MIN_PANE_SIZE は残す（分割バーの隙間 SPLIT_BAR_SIZE の分も差し引く）
 * （画面が小さくて収まらない場合は、左 pane の最小幅を優先する）。
 */
export function maxPaneWidth(canvasWidth: number, headerWidth: number): number {
  return Math.max(MIN_PANE_SIZE, canvasWidth - headerWidth - SCROLLBAR_SIZE - SPLIT_BAR_SIZE - MIN_PANE_SIZE);
}

/** 上 pane の高さの上限（maxPaneWidth と同じ考え方） */
export function maxPaneHeight(canvasHeight: number, headerHeight: number): number {
  return Math.max(MIN_PANE_SIZE, canvasHeight - headerHeight - SCROLLBAR_SIZE - SPLIT_BAR_SIZE - MIN_PANE_SIZE);
}

/** ドラッグなどで指定された左 pane の幅を、最小幅（既定 MIN_PANE_SIZE。minPaneSize で求めた値を渡す）〜上限に収める */
export function clampPaneWidth(requested: number, canvasWidth: number, headerWidth: number, min = MIN_PANE_SIZE): number {
  return Math.min(Math.max(requested, min), maxPaneWidth(canvasWidth, headerWidth));
}

/** ドラッグなどで指定された上 pane の高さを、最小高さ（既定 MIN_PANE_SIZE）〜上限に収める */
export function clampPaneHeight(requested: number, canvasHeight: number, headerHeight: number, min = MIN_PANE_SIZE): number {
  return Math.min(Math.max(requested, min), maxPaneHeight(canvasHeight, headerHeight));
}
