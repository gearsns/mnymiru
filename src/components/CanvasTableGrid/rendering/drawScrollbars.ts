import { barThumb, SCROLLBAR_SIZE, type ScrollbarBar } from "../lib/scrollbar";
import type { GridTheme } from "../types";
import { defaultTheme } from "./theme";

export interface DrawScrollbarsOptions {
  dpr: number;
  /** 表示するスクロールバー（lib/scrollbar.ts の computeScrollbars で求める。内容が収まっている pane のバーは含まれない） */
  bars: ScrollbarBar[];
  theme?: GridTheme;
}

/**
 * カスタムスクロールバーを canvas に描画する。分割していれば、pane ごとに1本ずつ描かれる
 * （片方の pane にバーが必要なときは、もう一方もグレーのトラックだけ描いて見た目をそろえる）。
 * サイズ・位置の計算は `../lib/scrollbar` の純粋関数に委譲している
 * （drawGrid.ts が座標計算を lib/geometry に委譲しているのと同じ考え方）。
 */
export function drawScrollbars(ctx: CanvasRenderingContext2D, opts: DrawScrollbarsOptions) {
  const theme = opts.theme ?? defaultTheme;

  ctx.save();
  ctx.scale(opts.dpr, opts.dpr);
  for (const bar of opts.bars) {
    const t = bar.track;
    ctx.fillStyle = theme.scrollbarTrackColor;
    ctx.fillRect(t.x, t.y, t.w, t.h);
    // 無効なバー（内容が収まっている pane。見た目をそろえるために場所だけ確保したもの）は、トラックだけでつまみは描かない
    if (!bar.enabled) continue;
    const thumb = barThumb(bar);
    ctx.fillStyle = theme.scrollbarThumbColor;
    if (bar.orientation === "v") ctx.fillRect(t.x + 2, t.y + thumb.offset, SCROLLBAR_SIZE - 4, thumb.size);
    else ctx.fillRect(t.x + thumb.offset, t.y + 2, thumb.size, SCROLLBAR_SIZE - 4);
  }
  ctx.restore();
}
