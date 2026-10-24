/**
 * 【部品: rendering / セル領域】
 * 1つの領域（ペイン）に属するセルのうち、見えている範囲を走査し、
 * 各セルの描画を CellRenderer に任せ、罫線を引く。
 * （分割していなければ、領域は表全体で1つだけ。）
 *
 * 罫線はセルごとに「上」と「左」だけを描画する（右・下は隣のセルの左・上として描かれる）。
 * こうすることで、getCellFormat の border:{top:false} 等でその1本だけを個別に消せる。
 * ※ テキスト描画のクリップ処理が ctx.beginPath() を呼ぶため、ループ中に直接
 *   moveTo/lineTo で罫線パスを組み立てると毎回リセットされてしまう
 *  （現在のパスは save()/restore() で保存されない状態のため）。
 *   そのため座標だけ配列に貯めておき、ループが終わってからまとめて1回で描く。
 */
import type { CellFormatProvider } from "../types";
import { cellRect, colEdgeX, colEndX, inRange, paneGap, rowEdgeY, rowEndY, type Pane } from "../lib/geometry";
import { resolveCellFormat } from "./cellFormat";
import type { CellRenderContext, CellRenderer } from "./cellRenderer";
import type { DrawFrame } from "./types";

export function drawCells(
    f: DrawFrame,
    pane: Pane,
    opts: {
        cellRenderer: CellRenderer;
        getCellFormat?: CellFormatProvider;
        /**
         * cellRenderer が利用者の独自レンダラーか。true のときは、セルの矩形でクリップし、
         * 描画状態を呼び出しの前後で保存・復元し、例外を握りつぶして他のセルの描画を続ける。
         */
        isolate?: boolean;
    }
): void {
    const { ctx, source, metrics, theme, scroll, sel, editing } = f;
    const { rows, cols } = pane;
    const borderSegments: Array<[number, number, number, number]> = [];
    let reportedError = false; // 独自レンダラーの例外は、1回の描画につき1度だけ報告する

    for (let r = rows.first; r < rows.end && metrics.rowOffsets[r] < rows.lastOffset; r++) {
        for (let c = cols.first; c < cols.end && metrics.colOffsets[c] < cols.lastOffset; c++) {
            const rect = cellRect(source, metrics, scroll, r, c);
            const value = source.getCell(r, c);
            const format = resolveCellFormat(source, opts.getCellFormat, r, c, value);

            const cellContext: CellRenderContext = {
                ctx,
                theme,
                row: r,
                col: c,
                dataRow: source.dataRowOf(r),
                rect,
                value,
                format,
                selected: inRange(sel.range, r, c),
                editing: !!editing && editing.row === r && editing.col === c,
                tree:
                    c === source.treeColumn
                        ? {
                            level: source.rowLevel(r),
                            hasChildren: source.rowHasChildren(r),
                            expanded: source.rowExpanded(r),
                            indent: source.treeIndent,
                        }
                        : undefined,
            };

            if (opts.isolate) {
                ctx.save();
                try {
                    ctx.beginPath();
                    ctx.rect(rect.x, rect.y, rect.w, rect.h);
                    ctx.clip();
                    opts.cellRenderer(cellContext);
                } catch (err) {
                    if (!reportedError) {
                        reportedError = true;
                        console.error("[canvas-table-grid] cellRenderer でエラーが発生しました:", err);
                    }
                } finally {
                    ctx.restore();
                }
            } else {
                opts.cellRenderer(cellContext);
            }

            // このセル自身の上辺・左辺の罫線（border.xxx !== false ならデフォルトで表示）
            if (format?.border?.top !== false) {
                if (rows.leading || r !== rows.first || source.splitRows === 0) {
                    const ly = Math.round(rect.y) + 0.5;
                    borderSegments.push([rect.x, ly, rect.x + rect.w, ly]);
                }
            }
            if (format?.border?.left !== false) {
                if (cols.leading || c !== cols.first || source.splitCols === 0) {
                    const lx = Math.round(rect.x) + 0.5;
                    borderSegments.push([lx, rect.y, lx, rect.y + rect.h]);
                }
            }
        }
    }

    // 表全体の外枠（最終行の下辺・最終列の右辺は、どのセルの「上」「左」にも属さないため個別に追加）。
    // 最終列・最終行を含む領域だけが引く（他の領域では範囲外になるため）。
    const outerRightX = Math.round(colEdgeX(source, metrics, scroll, source.cols)) + 0.5;
    const outerBottomY = Math.round(rowEdgeY(source, metrics, scroll, source.rows)) + 0.5;
    if (cols.end === source.cols) borderSegments.push([outerRightX, source.headerHeight, outerRightX, outerBottomY]);
    if (rows.end === source.rows) borderSegments.push([source.headerWidth, outerBottomY, outerRightX, outerBottomY]);

    // 分割モードの左・上の pane の「閉じる辺」（右端・下端）。
    // セルは上辺・左辺しか描かないので、この辺は本来、隣の pane の先頭セルの左辺・上辺が担う。
    // 分割バーの分だけ隣がずれているため、隣の線とは別に、pane の内側の端に引いてバーを線で挟む。
    const gap = paneGap(source);
    if (cols.leading && gap.w > 0 && cols.end > cols.start) {
        const x = Math.min(colEndX(source, metrics, scroll, cols.end - 1), cols.clipStart + cols.clipSize);
        const y2 = Math.min(rowEndY(source, metrics, scroll, rows.end - 1), rows.clipStart + rows.clipSize);
        if (x < cols.clipStart + cols.clipSize) {
            borderSegments.push([
                Math.round(x) + 0.5, rows.clipStart,
                Math.round(x) + 0.5, y2 + 1
            ]);
        }
    }
    if (rows.leading && gap.h > 0 && rows.end > rows.start) {
        const y = Math.min(rowEndY(source, metrics, scroll, rows.end - 1), rows.clipStart + rows.clipSize);
        const x2 = Math.min(colEndX(source, metrics, scroll, cols.end - 1), cols.clipStart + cols.clipSize);
        if (y < rows.clipStart + rows.clipSize) {
            borderSegments.push([
                cols.clipStart, Math.round(y) + 0.5,
                x2 + 1, Math.round(y) + 0.5
            ]);
        }
    }

    ctx.beginPath();
    for (const [x1, y1, x2, y2] of borderSegments) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    }
    ctx.strokeStyle = theme.gridLineColor;
    ctx.lineWidth = 1;
    ctx.stroke();
}
