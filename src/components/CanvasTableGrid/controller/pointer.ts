/**
 * 【部品: controller / マウス・ポインタ操作】
 * クリック／ドラッグによる範囲選択、行・列ヘッダ選択、列幅リサイズ、スクロールバーのドラッグ、
 * ダブルクリック判定、ホイールスクロール、ホバー時のカーソル変更。
 * どのセル・どの境界に当たったかの判定は viewport と lib/ の純粋関数に任せる。
 *
 * ツリーの開閉アイコンのクリックなど「セル内の特定位置」に反応させたい場合は、
 * handlePointerDown のセルクリック部分（pixelToCell の後）に足す。
 */
import { clamp } from "../lib/geometry";
import { isDoubleClick, type ClickPoint } from "../lib/doubleClick";
import { SCROLLBAR_SIZE, barDragRatio, type ScrollbarBar } from "../lib/scrollbar";
import { clampPaneHeight, clampPaneWidth, minPaneSize } from "../lib/split";
import { hitTreeToggle } from "../lib/tree";
import { formatCellValue } from "../format";
import type { Actions } from "./actions";
import type { ChangeRunner } from "./changeRunner";
import type { GridContext } from "./context";
import type { Editor } from "./editor";
import type { InputOverlay } from "./inputOverlay";
import type { RowDrag } from "./rowDrag";
import type { Viewport } from "./viewport";

const MIN_COL_WIDTH = 30;
const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_PX = 4;

export function createPointer(
    ctx: GridContext,
    deps: {
        viewport: Viewport;
        overlay: InputOverlay;
        editor: Editor;
        changes: ChangeRunner;
        actions: Actions;
        rowDrag: RowDrag;
        requestRender: () => void;
    }
) {
    const { props, store, els } = ctx;
    const { viewport, overlay, editor, changes, actions, rowDrag, requestRender } = deps;
    const { busy } = changes;

    let isSelecting = false;
    let lastClick: ClickPoint | null = null;
    /** ドラッグ中のスクロールバー（pane ごとに別のバー）と、ドラッグ開始時の位置・スクロール量 */
    let dragScrollbar: ScrollbarBar | null = null;
    let dragScrollbarStartPx = 0;
    let dragScrollbarStartScroll = 0;
    /** ドラッグ中の分割の境界のバー（縦 = 左右 pane の境界、横 = 上下 pane の境界。交点なら両方）と、開始時の pane の大きさ */
    let dragSplit: { v: boolean; h: boolean; startX: number; startY: number; leftW: number; topH: number } | null = null;
    /** 分割バーを最後に押した時刻。続けて押したら（ダブルクリック）既定のサイズに戻す */
    let lastSplitDown = -Infinity;
    let resizingCol: number | null = null;
    let resizeStartX = 0;
    let resizeStartWidth = 0;

    /** 座標 (px, py) のセルが、ツリー列の「子を持つ行」の開閉アイコンの上か */
    function overTreeToggle(row: number, col: number, px: number, py: number): boolean {
        if (!store.treeEnabled || col !== store.treeColumn || !store.rowHasChildren(row)) return false;
        return hitTreeToggle(viewport.cellRect(row, col), store.rowLevel(row), store.treeIndent, px, py);
    }

    function handlePointerDown(e: PointerEvent) {
        // canvas はフォーカス不可能な要素なので、何もしないと mousedown のデフォルト動作で
        // 裏の input からフォーカスが外れてしまう（ダブルクリックでしか効かなくなる原因）。
        // preventDefault してブラウザのデフォルトのフォーカス処理を止める。
        e.preventDefault();

        const canvas = els.canvas;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        // 分割の境界のバーのドラッグ（pane の大きさを変える）。続けて2回押すと既定のサイズ（列・行の合計）に戻す。
        // バーはスクロールバーの帯の中まで貫いているので、継ぎ目の付近はスクロールバーより先に判定する
        const split = viewport.splitBarAt(px, py);
        if (split) {
            if (store.editingCell()) editor.commitEdit(0, 0);
            const now = performance.now();
            if (now - lastSplitDown <= DOUBLE_CLICK_MS) {
                lastSplitDown = -Infinity;
                store.setSplit({
                    ...(split.v ? { leftWidth: undefined } : {}),
                    ...(split.h ? { topHeight: undefined } : {}),
                });
                requestRender();
                return;
            }
            lastSplitDown = now;
            const p = viewport.paneSize();
            dragSplit = { v: split.v, h: split.h, startX: e.clientX, startY: e.clientY, leftW: p.w, topH: p.h };
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
        }

        // スクロールバードラッグ（実際にスクロールバーが表示されている場合のみ。分割していれば pane ごとに別のバー）
        const bar = viewport.scrollbarAt(px, py);
        if (bar) {
            // 無効なバー（スクロール不要の pane の、場所だけ確保したトラック）は、何もせずクリックを受け止める
            if (!bar.enabled) return;
            dragScrollbar = bar;
            dragScrollbarStartPx = bar.orientation === "v" ? e.clientY : e.clientX;
            dragScrollbarStartScroll = bar.scroll;
            canvas.style.cursor = "default";
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
        }

        // 列幅リサイズ開始（列ヘッダの境界線付近をクリック）
        if (py < store.headerHeight && px >= store.headerWidth) {
            const borderCol = viewport.findColumnBorderNearPx(px);
            if (borderCol !== null) {
                if (store.editingCell()) editor.commitEdit(0, 0);
                resizingCol = borderCol;
                resizeStartX = e.clientX;
                resizeStartWidth = store.colWidths[borderCol];
                document.body.style.cursor = "col-resize";
                (e.target as Element).setPointerCapture(e.pointerId);
                return;
            }
        }

        if (store.editingCell()) editor.commitEdit(0, 0);

        const extend = e.shiftKey;

        // 列ヘッダクリック
        if (py < store.headerHeight && px >= store.headerWidth) {
            const cell = viewport.hitCell(px, store.headerHeight + 1);
            if (cell) {
                store.selectColumn(cell.col, extend);
                isSelecting = true;
            }
            els.input.focus();
            requestRender();
            return;
        }
        // 行ヘッダクリック
        if (px < store.headerWidth && py >= store.headerHeight) {
            const cell = viewport.hitCell(store.headerWidth + 1, py);
            // 選択済みの行番号を押した場合は、行のドラッグ（移動）の準備をする（動かさず離せば通常のクリック）
            if (cell && rowDrag.begin(cell.row, e)) return;
            if (cell) {
                store.selectRow(cell.row, extend);
                isSelecting = true;
            }
            els.input.focus();
            requestRender();
            return;
        }
        // 左上コーナー -> 全選択
        if (px < store.headerWidth && py < store.headerHeight) {
            store.selectAll();
            requestRender();
            return;
        }

        const cell = viewport.hitCell(px, py);
        if (!cell) return;

        // ツリー: 開閉アイコンのクリックは、選択してから展開/折りたたみを切り替える（ダブルクリック・範囲選択の対象にしない）
        if (!extend && overTreeToggle(cell.row, cell.col, px, py)) {
            store.selectCell(cell.row, cell.col);
            props.onActiveCellChange?.(cell.row, cell.col);
            actions.toggleRow(cell.row);
            els.input.focus();
            return;
        }

        // pointerdown で preventDefault しているとブラウザは互換用マウスイベント
        // （click/dblclick）の発火を抑制することがあるため、ここで手動判定する。
        const clickPoint: ClickPoint = { row: cell.row, col: cell.col, x: px, y: py, time: performance.now() };
        const doubleClicked = isDoubleClick(lastClick, clickPoint, {
            maxIntervalMs: DOUBLE_CLICK_MS,
            maxDistancePx: DOUBLE_CLICK_PX,
        });
        lastClick = clickPoint;

        if (doubleClicked && !extend) {
            lastClick = null; // 3回連続クリックで再度ダブルクリック判定されないようにリセット
            store.selectCell(cell.row, cell.col);
            const value = store.getCell(cell.row, cell.col);
            const result = props.onCellDoubleClick?.({
                row: cell.row,
                col: cell.col,
                value,
                displayValue: formatCellValue(value, overlay.getEffectiveFormat(cell.row, cell.col)),
                event: e,
            });
            if (result !== false) {
                editor.beginEdit(overlay.caretIndexFromClick(cell.row, cell.col, px));
            }
            requestRender();
            return;
        }

        store.selectCell(cell.row, cell.col, extend);
        props.onActiveCellChange?.(cell.row, cell.col);
        isSelecting = true;
        els.input.focus();
        requestRender();
    }

    function handlePointerMove(e: PointerEvent) {
        if (rowDrag.isActive() || rowDrag.isPending()) {
            rowDrag.move(e);
            return;
        }
        if (resizingCol !== null) {
            const dx = e.clientX - resizeStartX;
            const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth + dx);
            store.setColWidths(resizingCol, newWidth);
            requestRender();
            return;
        }
        if (dragScrollbar) {
            // つまみの移動量を、そのバーが動かすスクロール量（x / y / lx / ty のどれか）に直す
            const bar = dragScrollbar;
            const moved = (bar.orientation === "v" ? e.clientY : e.clientX) - dragScrollbarStartPx;
            const next = dragScrollbarStartScroll + moved * barDragRatio(bar);
            store.setScroll(viewport.clampScroll({ ...store.scroll(), [bar.scrollKey]: next }));
            requestRender();
            return;
        }
        if (dragSplit) {
            const s = viewport.size();
            // 左・上の pane の最小サイズは、先頭の列（行）が全部見える大きさ（ただし最大 40px）。右・下の pane には 40px 以上残す
            const minW = minPaneSize(store.colWidths[0]);
            const minH = minPaneSize(store.rowHeights[0]);
            store.setSplit({
                ...(dragSplit.v ? { leftWidth: clampPaneWidth(dragSplit.leftW + (e.clientX - dragSplit.startX), s.width, store.headerWidth, minW) } : {}),
                ...(dragSplit.h ? { topHeight: clampPaneHeight(dragSplit.topH + (e.clientY - dragSplit.startY), s.height, store.headerHeight, minH) } : {}),
            });
            requestRender();
            return;
        }
        if (!isSelecting) return;
        const rect = els.canvas.getBoundingClientRect();
        const px = clamp(e.clientX - rect.left, store.headerWidth, rect.width - SCROLLBAR_SIZE - 1);
        const py = clamp(e.clientY - rect.top, store.headerHeight, rect.height - SCROLLBAR_SIZE - 1);
        const cell = viewport.hitCell(px, py);
        if (!cell) return;
        const mode = store.selection().mode;
        if (mode === "col") store.selectColumn(cell.col, true);
        else if (mode === "row") store.selectRow(cell.row, true);
        else store.selectCell(cell.row, cell.col, true);
        requestRender();
    }

    function handlePointerUp(e: PointerEvent) {
        if (rowDrag.isActive() || rowDrag.isPending()) {
            rowDrag.up(e);
            return;
        }
        if (resizingCol !== null) {
            // 列幅は表示の設定なので、Undo の履歴には積まない
            resizingCol = null;
            document.body.style.cursor = "";
            requestRender();
        }
        if (dragScrollbar || dragSplit) {
            els.canvas.style.cursor = "cell";
        }
        isSelecting = false;
        dragScrollbar = null;
        dragSplit = null;
    }

    function handleHoverMove(e: PointerEvent) {
        // ドラッグ中（範囲選択・スクロールバー・分割バー・リサイズ）はこちらでは何もしない
        if (isSelecting || dragScrollbar || dragSplit || resizingCol !== null || rowDrag.isActive()) return;
        const canvas = els.canvas;
        if (busy()) {
            canvas.style.cursor = "wait";
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        // 分割の境界のバー（スクロールバーの帯の中まで貫いているので、スクロールバーより先に判定する）:
        // 縦のバーは左右、横のバーは上下、交点はどちらにも動かせる
        const split = viewport.splitBarAt(px, py);
        if (split) {
            canvas.style.cursor = split.v && split.h ? "move" : split.v ? "col-resize" : "row-resize";
            return;
        }

        if (viewport.scrollbarAt(px, py)) {
            canvas.style.cursor = "default";
            return;
        }

        // 行ヘッダ: ドラッグで移動できる（選択済みの）行の上では「掴める手」
        if (px < store.headerWidth && py >= store.headerHeight) {
            const cell = viewport.hitCell(store.headerWidth + 1, py);
            if (cell && rowDrag.canStartAt(cell.row)) {
                canvas.style.cursor = "grab";
                return;
            }
        }

        if (py < store.headerHeight && px >= store.headerWidth && viewport.findColumnBorderNearPx(px) !== null) {
            canvas.style.cursor = "col-resize";
        } else if (store.treeEnabled && overTreeToggleAt(px, py)) {
            canvas.style.cursor = "pointer";
        } else {
            canvas.style.cursor = "cell";
        }
    }

    /** 座標 (px, py) がツリーの開閉アイコンの上か（セルを特定するところから行う） */
    function overTreeToggleAt(px: number, py: number): boolean {
        const cell = viewport.hitCell(px, py);
        return !!cell && overTreeToggle(cell.row, cell.col, px, py);
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        // 分割しているときは、ポインタのある pane のスクロールを動かす（横: 左 or 右、縦: 上 or 下）。
        // 同じ軸を共有する pane は同じスクロール量を使うので、動かすと同期して動く
        const rect = els.canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const pane = viewport.paneSize();
        const gap = viewport.gap();
        // 固定モードでは左・上は動かないので、どこでホイールを回してもスクロールする側（右・下）が動く
        const splitting = store.splitMode === "split";
        const inLeft = splitting && store.splitCols > 0 && px < store.headerWidth + pane.w + gap.w / 2; // 分割バーの上は、半分ずつ左右の pane に振り分ける
        const inTop = splitting && store.splitRows > 0 && py < store.headerHeight + pane.h + gap.h / 2;
        const s = store.scroll();
        store.setScroll(
            viewport.clampScroll({
                ...s,
                ...(inLeft ? { lx: s.lx + e.deltaX } : { x: s.x + e.deltaX }),
                ...(inTop ? { ty: s.ty + e.deltaY } : { y: s.y + e.deltaY }),
            })
        );
        requestRender();
    }

    /** canvas / window にイベントリスナーを登録する。戻り値の関数で解除する */
    function bind(): () => void {
        const canvas = els.canvas;
        canvas.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        canvas.addEventListener("pointermove", handleHoverMove);
        canvas.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            canvas.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            canvas.removeEventListener("pointermove", handleHoverMove);
            canvas.removeEventListener("wheel", handleWheel);
        };
    }

    return { bind };
}

export type Pointer = ReturnType<typeof createPointer>;
