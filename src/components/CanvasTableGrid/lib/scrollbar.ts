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

// ---------------------------------------------------------------------------
// pane ごとのスクロールバー
// ---------------------------------------------------------------------------

/** どのスクロール量を動かすバーか（x: 右 pane の横 / y: 下 pane の縦 / lx: 左 pane の横 / ty: 上 pane の縦） */
export type ScrollKey = "x" | "y" | "lx" | "ty";

export interface ScrollbarBar {
  orientation: "v" | "h";
  /** このバーが動かすスクロール量 */
  scrollKey: ScrollKey;
  /** トラック（スクロールバーの描画される帯）の矩形（canvas ローカル座標） */
  track: { x: number; y: number; w: number; h: number };
  /** その pane の、スクロールする方向の見えているサイズ(px) */
  viewport: number;
  /** その pane のコンテンツ全体のサイズ(px) */
  content: number;
  /** 現在のスクロール量 */
  scroll: number;
  /**
   * 操作できるか。内容が pane からはみ出していれば true。
   * false は、分割している場合に限り、見た目をそろえるために場所だけ確保した「無効な（つまみのない）バー」。
   */
  enabled: boolean;
}

/**
 * 表示すべきスクロールバーを求める。
 *
 *   縦: 画面の右端に、下 pane 用（縦スクロール y）と、上 pane 用（ty。上下に分割しているときだけ）が並ぶ
 *   横: 画面の下端に、右 pane 用（横スクロール x）と、左 pane 用（lx。左右に分割しているときだけ）が並ぶ
 *   分割していなければ、従来どおり縦横1本ずつ（内容が収まっていれば出さない）。
 *   返す順は 縦（下 → 上）、横（右 → 左）。
 *
 *   分割している軸では、ペア（縦なら下・上、横なら右・左）のどちらか一方でもバーが必要なら、
 *   もう一方は「無効なバー」（enabled: false。つまみのないグレーのトラック）として場所分を確保する
 *   （片方にだけバーがあると、境界の左右・上下で見た目がずれるため）。どちらも不要なら、ペアとも出さない。
 */
export function computeScrollbars(input: {
  width: number;
  height: number;
  headerWidth: number;
  headerHeight: number;
  /** 左 pane の表示幅・上 pane の表示高さ（分割していなければ 0） */
  leftW: number;
  topH: number;
  splitCols: number;
  splitRows: number;
  /** 分割バーの隙間(px)。右・下の pane（とそのスクロールバー）はその分だけずれる（省略時 0。固定モードでは使わない） */
  gapW?: number;
  gapH?: number;
  /** 各 pane のコンテンツ全体のサイズ */
  content: { left: number; right: number; top: number; bottom: number };
  scroll: { x: number; y: number; lx?: number; ty?: number };
  /**
   * 通常の固定モード。左・上の pane はスクロールしないので、スクロールバーは縦横1本ずつで、
   * トラックは全長（ヘッダの下〜端）。つまみの大きさは「スクロールする側」の内容と見えている大きさで決まる。
   * （pane ごとのバーも、無効なバーもない）
   */
  freeze?: boolean;
}): ScrollbarBar[] {
  const { width, height, headerWidth: hw, headerHeight: hh, leftW, topH, splitCols, splitRows, content, scroll } = input;
  const S = SCROLLBAR_SIZE;
  const gapW = splitCols > 0 ? (input.gapW ?? 0) : 0;
  const gapH = splitRows > 0 ? (input.gapH ?? 0) : 0;

  if (input.freeze) {
    const v: ScrollbarBar = {
      orientation: "v",
      scrollKey: "y",
      track: { x: width - S, y: hh, w: S, h: height - hh - S },
      viewport: Math.max(0, height - hh - S - topH),
      content: content.bottom,
      scroll: scroll.y,
      enabled: true,
    };
    const h: ScrollbarBar = {
      orientation: "h",
      scrollKey: "x",
      track: { x: hw, y: height - S, w: width - hw - S, h: S },
      viewport: Math.max(0, width - hw - S - leftW),
      content: content.right,
      scroll: scroll.x,
      enabled: true,
    };
    return [v, h].filter((b) => needsScrollbar(b));
  }

  const bars: Array<Omit<ScrollbarBar, "enabled">> = [];

  // 縦: 下 pane
  const bottomTrackH = height - hh - topH - gapH - S;
  bars.push({
    orientation: "v",
    scrollKey: "y",
    track: { x: width - S, y: hh + topH + gapH, w: S, h: bottomTrackH },
    viewport: Math.max(0, bottomTrackH),
    content: content.bottom,
    scroll: scroll.y,
  });
  // 縦: 上 pane
  if (splitRows > 0) {
    bars.push({
      orientation: "v",
      scrollKey: "ty",
      track: { x: width - S, y: hh, w: S, h: topH },
      viewport: Math.max(0, topH),
      content: content.top,
      scroll: scroll.ty ?? 0,
    });
  }
  // 横: 右 pane
  const rightTrackW = width - hw - leftW - gapW - S;
  bars.push({
    orientation: "h",
    scrollKey: "x",
    track: { x: hw + leftW + gapW, y: height - S, w: rightTrackW, h: S },
    viewport: Math.max(0, rightTrackW),
    content: content.right,
    scroll: scroll.x,
  });
  // 横: 左 pane
  if (splitCols > 0) {
    bars.push({
      orientation: "h",
      scrollKey: "lx",
      track: { x: hw, y: height - S, w: leftW, h: S },
      viewport: Math.max(0, leftW),
      content: content.left,
      scroll: scroll.lx ?? 0,
    });
  }
  // 縦・横それぞれのペアで、どちらか一方でも必要なら両方を含める（必要でない側は無効なバー）
  const result: ScrollbarBar[] = [];
  for (const orientation of ["v", "h"] as const) {
    const pair = bars.filter((b) => b.orientation === orientation);
    if (!pair.some((b) => needsScrollbar(b))) continue;
    for (const b of pair) result.push({ ...b, enabled: needsScrollbar(b) });
  }
  return result;
}

/** 指定したローカル座標 (px, py) が、どのスクロールバーの上か（なければ null）。 */
export function hitScrollbar(bars: ScrollbarBar[], px: number, py: number): ScrollbarBar | null {
  for (const b of bars) {
    const t = b.track;
    if (b.orientation === "v") {
      if (px > t.x && py >= t.y && py < t.y + t.h) return b;
    } else if (py > t.y && px >= t.x && px < t.x + t.w) return b;
  }
  return null;
}

/** バー b のつまみの大きさ・位置（トラックの長さを基準にする） */
export function barThumb(b: ScrollbarBar): ScrollbarThumb {
  return computeScrollbarThumb({ viewport: b.viewport, content: b.content, scroll: b.scroll, track: b.orientation === "v" ? b.track.h : b.track.w });
}

/** バー b をドラッグしたとき、つまみの移動量(px)をスクロール量に直す比率 */
export function barDragRatio(b: ScrollbarBar): number {
  return scrollbarDragRatio({ viewport: b.viewport, content: b.content, scroll: b.scroll, track: b.orientation === "v" ? b.track.h : b.track.w });
}
