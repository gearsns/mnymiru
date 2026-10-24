/**
 * 【部品: rendering / ヘッダ】
 * 列ヘッダ・行ヘッダ・左上コーナー。
 * 分割している場合は、左右・上下の pane ごとに別々のスクロール量でクリップして描く
 * （ある pane のヘッダが、隣の pane の上にはみ出して見えないようにする）。
 * 分割バーがある（分割モード）ときは、左・上の pane の最後の列（行）の右辺（下辺）を、pane の内側の端に引く
 * （この辺は隣の pane の先頭の境界線が担っていたが、バーの分だけ離れてクリップの外になるため。drawCells と同じ）。
 */
import { colEdgeX, rowEdgeY } from "../lib/geometry";
import type { DrawFrame } from "./types";

export function drawHeaders(f: DrawFrame): void {
    const { ctx, source, metrics, theme, scroll, sel, width, height } = f;
    const { headerWidth, headerHeight } = source;

    const selX = colEdgeX(source, metrics, scroll, sel.range.c1);
    const selWidth = colEdgeX(source, metrics, scroll, sel.range.c2) + source.colWidths[sel.range.c2] - selX;
    const selY = rowEdgeY(source, metrics, scroll, sel.range.r1);
    const selHeight = rowEdgeY(source, metrics, scroll, sel.range.r2) + source.rowHeights[sel.range.r2] - selY;

    // --- 列ヘッダ ---
    ctx.fillStyle = theme.headerBackground;
    ctx.fillRect(headerWidth, 0, width - headerWidth, headerHeight);
    for (const seg of f.view.cols) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(seg.clipStart, 0, seg.clipSize, headerHeight + 1);
        ctx.clip();
        ctx.textAlign = "center";
        for (let c = seg.first; c < seg.end && metrics.colOffsets[c] < seg.lastOffset; c++) {
            const x = colEdgeX(source, metrics, scroll, c);
            const cw = source.colWidths[c];
            const isActive = sel.mode !== "row" && c >= sel.range.c1 && c <= sel.range.c2;
            if (isActive) {
                ctx.fillStyle = theme.headerActiveBackground;
                ctx.fillRect(x, 0, cw, headerHeight);
            }
            ctx.fillStyle = theme.headerTextColor;
            ctx.fillText(source.columnHeaderLabel(c), x + cw / 2, headerHeight / 2 + 1);
        }
        ctx.strokeStyle = theme.gridLineColor;
        ctx.beginPath();
        ctx.rect(seg.clipStart, 0, seg.clipSize, headerHeight + 1);
        ctx.rect(selX, selY, selWidth, selHeight);
        ctx.clip('evenodd');
        ctx.moveTo(seg.clipStart, headerHeight + 0.5);
        ctx.lineTo(seg.clipStart + seg.clipSize, headerHeight + 0.5);
        // 右端ボーダー
        for (let c = seg.first; c < seg.end && metrics.colOffsets[c] < seg.lastOffset; c++) {
            const x = Math.round(colEdgeX(source, metrics, scroll, c)) + 0.5 + source.colWidths[c];
            ctx.moveTo(x, 0);
            ctx.lineTo(x, headerHeight);
        }
        ctx.stroke();
        ctx.restore();
    }

    // --- 行ヘッダ ---
    ctx.fillStyle = theme.headerBackground;
    ctx.fillRect(0, headerHeight, headerWidth, height - headerHeight);
    for (const seg of f.view.rows) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, seg.clipStart, headerWidth + 1, seg.clipSize);
        ctx.clip();
        ctx.textAlign = "center";
        for (let r = seg.first; r < seg.end && metrics.rowOffsets[r] < seg.lastOffset; r++) {
            const y = rowEdgeY(source, metrics, scroll, r);
            const rh = source.rowHeights[r];
            const isActive = sel.mode !== "col" && r >= sel.range.r1 && r <= sel.range.r2;
            if (isActive) {
                ctx.fillStyle = theme.headerActiveBackground;
                ctx.fillRect(0, y, headerWidth, rh);
            }
            ctx.fillStyle = theme.headerTextColor;
            ctx.fillText(source.rowHeaderLabel(r), headerWidth / 2, y + rh / 2 + 1);
        }
        ctx.strokeStyle = theme.gridLineColor;
        ctx.beginPath();
        ctx.rect(0, seg.clipStart, headerWidth + 1, seg.clipSize);
        ctx.rect(selX, selY, selWidth, selHeight);
        ctx.clip('evenodd');
        ctx.moveTo(headerWidth + 0.5, seg.clipStart);
        ctx.lineTo(headerWidth + 0.5, seg.clipStart + seg.clipSize);
        for (let r = seg.first; r < seg.end && metrics.rowOffsets[r] < seg.lastOffset; r++) {
            const y = Math.round(rowEdgeY(source, metrics, scroll, r)) + 0.5 + source.rowHeights[r];
            ctx.moveTo(0, y);
            ctx.lineTo(headerWidth, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    // --- 左上コーナー ---
    ctx.fillStyle = theme.headerBackground;
    ctx.fillRect(0, 0, headerWidth, headerHeight);
    ctx.strokeStyle = theme.gridLineColor;
    ctx.strokeRect(0.5, 0.5, headerWidth, headerHeight);
}
