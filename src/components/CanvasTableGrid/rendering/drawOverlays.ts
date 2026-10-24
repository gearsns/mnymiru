/**
 * 【部品: rendering / 重ね描き】
 * セルの上に重ねる枠線：選択範囲の枠 → コピー中の点線枠 → アクティブセルの枠。
 * 領域（ペイン）ごとに呼ばれ、その領域に属する部分だけを描く。
 *
 * 範囲が複数の pane にまたがる場合は、pane ごとに範囲を切り分けて枠を描く。
 * このとき「隣の領域へ続いている辺」は枠をクリップの外へ押し出して見えなくし、
 * 本来の外枠（範囲の端）だけが線として残るようにしている。
 */
import type { SelectionRange } from "../types";
import { cellRect, colEdgeX, rangeRect, rowEndY, type Pane, type Rect } from "../lib/geometry";
import type { DrawFrame } from "./types";

/** 領域をまたぐ辺を、クリップの外へ押し出す量(px)。枠線の太さ(2px)より大きければよい */
const SPILL = 4;

/** range のうち pane に属する部分の矩形（属さなければ null）。続きがある辺は SPILL 分だけ外へ広げる */
function paneRangeRect(f: DrawFrame, pane: Pane, range: SelectionRange): Rect | null {
    const r1 = Math.max(range.r1, pane.rows.start);
    const r2 = Math.min(range.r2, pane.rows.end - 1);
    const c1 = Math.max(range.c1, pane.cols.start);
    const c2 = Math.min(range.c2, pane.cols.end - 1);
    if (r1 > r2 || c1 > c2) return null;

    const rect = rangeRect(f.source, f.metrics, f.scroll, { r1, c1, r2, c2 });
    if (c1 > range.c1) {
        rect.x -= SPILL;
        rect.w += SPILL;
    }
    if (c2 < range.c2) {
        rect.w = Math.max(colEdgeX(f.source, f.metrics, f.scroll, range.c2), rect.w + SPILL);
    }
    if (r1 > range.r1) {
        rect.y -= SPILL;
        rect.h += SPILL;
    }
    if (r2 < range.r2){
        rect.h = Math.max(rowEndY(f.source, f.metrics, f.scroll, range.r2), rect.h + SPILL);
    }
    return rect;
}

export function drawOverlays(f: DrawFrame, pane: Pane, copiedRange: SelectionRange | null | undefined): void {
    const { ctx, source, metrics, theme, scroll, sel, active, editing } = f;

    // --- 選択範囲の枠線 ---
    if (metrics.colOffsets[sel.range.c2 + 1] !== undefined) {
        const r = paneRangeRect(f, pane, sel.range);
        if (r) {
            ctx.strokeStyle = theme.selectionBorderColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(r.x + 1, r.y + 1, r.w - 1, r.h - 1);
        }
    }

    // --- コピー中の範囲（マーチングアンツ） ---
    if (copiedRange) {
        const r = paneRangeRect(f, pane, copiedRange);
        if (r) {
            ctx.save();
            ctx.strokeStyle = theme.selectionBorderColor;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(r.x + 1, r.y + 1, r.w - 1, r.h - 1);
            ctx.restore();
        }
    }

    // --- アクティブセルの枠線（そのセルが属する領域でだけ描く） ---
    const inPane =
        active.row >= pane.rows.start && active.row < pane.rows.end && active.col >= pane.cols.start && active.col < pane.cols.end;
    if (!editing && inPane) {
        const r = cellRect(source, metrics, scroll, active.row, active.col);
        ctx.strokeStyle = theme.activeCellBorderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x + 1, r.y + 1, r.w - 1, r.h - 1);
    }
}
