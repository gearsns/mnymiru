/**
 * 【部品: rendering / 分割・固定の境界】
 * 左右・上下の pane の境界の表示。分割・固定していなければ何も描かない。
 *
 *   drawFreezeLines … 固定モード: 表の範囲までの細い境界線。列ヘッダ・行ヘッダまで貫いて描く。
 *                     ヘッダの上に重ねるため、drawHeaders の後に呼ぶ（drawGrid の中）
 *   drawSplitBars   … 分割モード: 太いバー（SPLIT_BAR_SIZE）。列ヘッダ・行ヘッダから**スクロールバーの上まで重ねて**、
 *                     キャンバスの端まで貫いて描く（スクロールバーも pane ごとに分かれているので、継ぎ目にバーが見えて、
 *                     範囲が分かりやすい）。スクロールバーの後に描く必要があるため drawGrid の外（controller/renderer.ts）から呼ぶ
 *
 * 分割モードのバーは、pane の境界に SPLIT_BAR_SIZE の幅の隙間として入る（lib/geometry.ts の paneGap）。
 * 右・下の pane はこの分だけずれるので、バーは左・上の pane の右端（下端）から SPLIT_BAR_SIZE の範囲に、
 * セルと重ならずに描かれる（太さは lib/split.ts と共有）。
 * 固定モードの線は隙間を取らず、左・上の pane の右端（下端）に引く。
 */
import { colEdgeX, paneExtent, rowEdgeY, type Metrics } from "../lib/geometry";
import { SPLIT_BAR_SIZE } from "../lib/split";
import type { GridTheme } from "../types";
import type { DrawFrame, GridRenderSource } from "./types";

/**
 * 固定モードの境界線（1px）。固定していなければ何も描かない。
 * 列ヘッダ（y = 0）・行ヘッダ（x = 0）から、表の端まで引く。ヘッダの上にも重なるので、drawHeaders の後に呼ぶこと。
 */
export function drawFreezeLines(f: DrawFrame): void {
    const { ctx, source, metrics, theme, width, height } = f;
    if (source.splitMode !== "freeze") return;
    const hasCols = source.splitCols > 0;
    const hasRows = source.splitRows > 0;
    if (!hasCols && !hasRows) return;

    const extent = paneExtent(source, metrics);
    // 線は表のある範囲までにとどめる（表より外の空白には引かない）
    const tableRight = Math.min(width, colEdgeX(source, metrics, f.scroll, source.cols));
    const tableBottom = Math.min(height, rowEdgeY(source, metrics, f.scroll, source.rows));
    ctx.save();
    ctx.strokeStyle = theme.frozenBorderColor ?? "#8c96a3";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (hasCols) {
        const x = source.headerWidth + extent.w + 0.5;
        ctx.moveTo(x, 0); // 列ヘッダの上端から
        ctx.lineTo(x, tableBottom);
    }
    if (hasRows) {
        const y = source.headerHeight + extent.h + 0.5;
        ctx.moveTo(0, y); // 行ヘッダの左端から
        ctx.lineTo(tableRight, y);
    }
    ctx.stroke();
    ctx.restore();
}

/**
 * 分割モードのバー（縦: 左右 pane の境界、横: 上下 pane の境界）。
 * 列ヘッダ・行ヘッダの端から、キャンバスの端（スクロールバーの帯の中）まで貫いて描く。何も描かなければ ctx には触れない。
 * バーは pane の境界の隙間（左・上の pane の端から SPLIT_BAR_SIZE）をちょうど埋める。
 */
export function drawSplitBars(
    ctx: CanvasRenderingContext2D,
    opts: { source: GridRenderSource; metrics: Metrics; theme: GridTheme; width: number; height: number; dpr: number }
): void {
    const { source, metrics, theme, width, height } = opts;
    if (source.splitMode !== "split") return;
    const hasCols = source.splitCols > 0;
    const hasRows = source.splitRows > 0;
    if (!hasCols && !hasRows) return;

    const extent = paneExtent(source, metrics);
    ctx.save();
    ctx.scale(opts.dpr, opts.dpr);
    ctx.fillStyle = theme.splitBarColor ?? "#b8c0cc";
    if (hasCols) ctx.fillRect(source.headerWidth + extent.w, 0, SPLIT_BAR_SIZE, height);
    if (hasRows) ctx.fillRect(0, source.headerHeight + extent.h, width, SPLIT_BAR_SIZE);
    ctx.restore();
}
