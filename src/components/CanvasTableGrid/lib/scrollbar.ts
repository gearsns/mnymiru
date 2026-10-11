/** スクロールバーの太さ(px)。描画・当たり判定の両方でこの値を共有する。 */
export const SCROLLBAR_SIZE = 12;
/** スクロールバーのつまみ(thumb)の最小サイズ(px)。短すぎてつまめなくなるのを防ぐ。 */
export const MIN_THUMB_SIZE = 24;

export interface ScrollbarLayout {
  /** 表示領域（ヘッダを除く実際にセルが見えている部分）のサイズ */
  viewport: number;
  /** コンテンツ全体のサイズ（全行 or 全列の合計） */
  content: number;
  /** 現在のスクロール位置 */
  scroll: number;
  /** トラック（スクロールバーの描画される帯）の長さ(px) */
  track: number;
}

export interface ScrollbarThumb {
  /** つまみのサイズ(px) */
  size: number;
  /** トラック上でのつまみの位置(px)、トラックの開始位置からのオフセット */
  offset: number;
}

/** スクロールバーを表示する必要があるか（コンテンツが表示領域よりはみ出しているか） */
export function needsScrollbar(layout: Pick<ScrollbarLayout, "viewport" | "content">): boolean {
  return layout.content > layout.viewport;
}

/** つまみのサイズと位置を求める */
export function computeScrollbarThumb(layout: ScrollbarLayout): ScrollbarThumb {
  const size = Math.max(MIN_THUMB_SIZE, (layout.viewport / layout.content) * layout.track);
  const maxScroll = Math.max(1, layout.content - layout.viewport);
  const offset = (layout.scroll / maxScroll) * (layout.track - size);
  return { size, offset };
}

/**
 * つまみをドラッグした距離(px)から、対応するスクロール量への変換比率を求める。
 * つまみを1px動かすとコンテンツが何px分スクロールするか。
 */
export function scrollbarDragRatio(layout: ScrollbarLayout): number {
  const thumb = computeScrollbarThumb(layout);
  const maxScroll = Math.max(1, layout.content - layout.viewport);
  return maxScroll / Math.max(1, layout.track - thumb.size);
}

/** 指定したローカル座標がスクロールバー（実際に表示されている場合のみ）の上かどうかを判定する */
export function scrollbarHitTest(params: {
  px: number;
  py: number;
  width: number;
  height: number;
  headerWidth: number;
  headerHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  scrollbarSize?: number;
}): { overVertical: boolean; overHorizontal: boolean } {
  const size = params.scrollbarSize ?? SCROLLBAR_SIZE;
  const overVertical =
    needsScrollbar({ viewport: params.viewportHeight, content: params.contentHeight }) &&
    params.px > params.width - size &&
    params.py >= params.headerHeight &&
    params.py < params.height - size;
  const overHorizontal =
    needsScrollbar({ viewport: params.viewportWidth, content: params.contentWidth }) &&
    params.py > params.height - size &&
    params.px >= params.headerWidth &&
    params.px < params.width - size;
  return { overVertical, overHorizontal };
}
