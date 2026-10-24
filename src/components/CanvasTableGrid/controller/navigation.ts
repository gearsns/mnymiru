/**
 * 【部品: controller / セル移動】
 * アクティブセルの移動（相対・絶対・ジャンプ）。移動したら画面内に表示されるようスクロールする。
 */
import { clamp } from "../lib/geometry";
import type { GridContext } from "./context";
import type { Viewport } from "./viewport";

export function createNavigation(ctx: GridContext, viewport: Viewport, requestRender: () => void) {
    const { props, store, els } = ctx;

    /** アクティブセル（または拡張時は選択の可動端）を絶対位置(row,col)に移動する */
    function moveActiveTo(row: number, col: number, extend: boolean) {
        const r = clamp(row, 0, store.rows - 1);
        const c = clamp(col, 0, store.cols - 1);
        store.selectCell(r, c, extend);
        props.onActiveCellChange?.(store.activeCell().row, store.activeCell().col);
        viewport.ensureVisible(r, c);
    }

    function moveActive(dRow: number, dCol: number, extend: boolean) {
        // 拡張時は選択の可動端(focus)を動かし、通常時はアクティブセルを動かす
        const base = extend ? store.selection().focus : store.activeCell();
        moveActiveTo(base.row + dRow, base.col + dCol, extend);
    }

    /** 外部（ref 経由）からの指定セルへのジャンプ。選択・スクロール・フォーカスをまとめて行う */
    function jumpToCell(row: number, col: number) {
        const r = clamp(row, 0, store.rows - 1);
        const c = clamp(col, 0, store.cols - 1);

        // セルを選択
        store.selectCell(r, c, false);
        props.onActiveCellChange?.(r, c);

        // 画面内に表示されるように、スクロールを調整
        viewport.ensureVisible(r, c);

        // 必要に応じて入力欄にフォーカスを戻し、再描画
        els.input.focus();
        requestRender();
    }

    return { moveActiveTo, moveActive, jumpToCell };
}

export type Navigation = ReturnType<typeof createNavigation>;
