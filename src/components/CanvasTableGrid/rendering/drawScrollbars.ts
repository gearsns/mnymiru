import { computeScrollbarThumb, needsScrollbar, SCROLLBAR_SIZE } from "../lib/scrollbar";
import type { GridTheme } from "../types";
import { defaultTheme } from "./drawGrid";

export interface DrawScrollbarsOptions {
  width: number;
  height: number;
  dpr: number;
  headerWidth: number;
  headerHeight: number;
  scroll: { x: number; y: number };
  /** 表示領域（ヘッダを除く実際にセルが見えている部分）のサイズ */
  viewport: { w: number; h: number };
  /** コンテンツ全体のサイズ（全行・全列の合計） */
  content: { w: number; h: number };
  theme?: GridTheme;
}

/**
 * カスタムスクロールバー（縦・横）を canvas に描画する。
 * コンテンツが表示領域に収まっている軸は描画しない。
 * サイズ・位置の計算は `../lib/geometry` ではなく `../lib/scrollbar` の純粋関数に委譲している
 * （drawGrid.ts が座標計算を lib/geometry に委譲しているのと同じ考え方）。
 */
export function drawScrollbars(ctx: CanvasRenderingContext2D, opts: DrawScrollbarsOptions) {
  const theme = opts.theme ?? defaultTheme;
  const { width, height, dpr, headerWidth, headerHeight, scroll, viewport, content } = opts;

  ctx.save();
  ctx.scale(dpr, dpr);

  if (needsScrollbar({ viewport: viewport.h, content: content.h })) {
    const trackH = height - headerHeight - SCROLLBAR_SIZE;
    const thumb = computeScrollbarThumb({ viewport: viewport.h, content: content.h, scroll: scroll.y, track: trackH });
    ctx.fillStyle = theme.scrollbarTrackColor;
    ctx.fillRect(width - SCROLLBAR_SIZE, headerHeight, SCROLLBAR_SIZE, trackH);
    ctx.fillStyle = theme.scrollbarThumbColor;
    ctx.fillRect(width - SCROLLBAR_SIZE + 2, headerHeight + thumb.offset, SCROLLBAR_SIZE - 4, thumb.size);
  }

  if (needsScrollbar({ viewport: viewport.w, content: content.w })) {
    const trackW = width - headerWidth - SCROLLBAR_SIZE;
    const thumb = computeScrollbarThumb({ viewport: viewport.w, content: content.w, scroll: scroll.x, track: trackW });
    ctx.fillStyle = theme.scrollbarTrackColor;
    ctx.fillRect(headerWidth, height - SCROLLBAR_SIZE, trackW, SCROLLBAR_SIZE);
    ctx.fillStyle = theme.scrollbarThumbColor;
    ctx.fillRect(headerWidth + thumb.offset, height - SCROLLBAR_SIZE + 2, thumb.size, SCROLLBAR_SIZE - 4);
  }

  ctx.restore();
}
