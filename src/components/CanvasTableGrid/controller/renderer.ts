/**
 * 【部品: controller / 再描画】
 * canvas への描画を呼び出し、状態が変わったら描き直す。
 * 描画の中身は rendering/（drawGrid, drawScrollbars）にあり、ここはいつ・何を渡すかだけを決める。
 *
 * セルの描き方は props.cellRenderer で差し替えられる（render() 内で読むので、変更されたら再描画される）。
 */
import { createEffect } from "solid-js";
import { drawGrid } from "../rendering/drawGrid";
import { drawScrollbars } from "../rendering/drawScrollbars";
import { drawSplitBars } from "../rendering/drawSplitBars";
import type { GridContext } from "./context";
import type { CopiedRange } from "./copiedRange";
import type { InputOverlay } from "./inputOverlay";
import type { RowDragState } from "./rowDragState";
import type { Viewport } from "./viewport";

export function createRenderer(
    ctx: GridContext,
    deps: { viewport: Viewport; copied: CopiedRange; overlay: InputOverlay; rowDragState: RowDragState }
) {
    const { props, store, theme, els } = ctx;
    const { viewport, copied, overlay, rowDragState } = deps;
    const dpr = () => window.devicePixelRatio || 1;

    function render() {
        const c2d = els.canvas.getContext("2d");
        if (!c2d) return;
        const s = viewport.size();
        drawGrid(c2d, store, viewport.metrics(), {
            width: s.width,
            height: s.height,
            dpr: dpr(),
            theme,
            copiedRange: props.dispCopiedRange ? copied.copiedRange() : null,
            getCellFormat: props.getCellFormat,
            cellRenderer: props.cellRenderer,
            rowDrag: rowDragState.dragState(),
        });
        drawScrollbars(c2d, { dpr: dpr(), bars: viewport.scrollbars(), theme });
        // 分割のバーは、スクロールバーの上に重ねて、キャンバスの端まで貫いて描く（pane ごとのスクロールバーの継ぎ目が分かる）
        drawSplitBars(c2d, { source: store, metrics: viewport.metrics(), theme, width: s.width, height: s.height, dpr: dpr() });
        overlay.positionInput();
    }

    /** 次のフレームで描き直す（イベント処理の後に呼ぶ） */
    function requestRender() {
        requestAnimationFrame(render);
    }

    /**
     * 再描画のトリガー（effect）を登録する。
     * onMount でサイズ(ResizeObserver)を設定した「後」に登録する必要がある
     * （先に登録すると、サイズ 0 のまま余分に1回描画してしまう）。
     */
    function startRedraw() {
        // サイズが変わったら canvas のピクセル数を合わせて描き直す
        createEffect(() => {
            const s = viewport.size();
            if (s.width === 0 || s.height === 0) return;
            els.canvas.width = s.width * dpr();
            els.canvas.height = s.height * dpr();
            els.canvas.style.width = `${s.width}px`;
            els.canvas.style.height = `${s.height}px`;
            render();
        });

        // data/selection/scroll の変化を購読して再描画
        createEffect(() => {
            store.data.cells;
            store.data.formats;
            store.selection();
            store.activeCell();
            store.editingCell();
            store.scroll();
            store.colWidths;
            store.rowHeights;
            copied.copiedRange();
            render();
        });
    }

    return { render, requestRender, startRedraw };
}

export type Renderer = ReturnType<typeof createRenderer>;
