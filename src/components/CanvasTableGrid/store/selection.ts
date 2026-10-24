/**
 * 【部品: store / 選択状態】
 * 選択範囲・アクティブセル・編集中セルの状態と、その更新操作。
 * データの中身（値・書式）は知らない。行数だけ関数で受け取る（行が増減するため）。
 */
import { batch, createSignal } from "solid-js";
import type { CellPos, Selection, SelectionRange } from "../types";

export function normalizeRange(r1: number, c1: number, r2: number, c2: number): SelectionRange {
    return {
        r1: Math.min(r1, r2),
        c1: Math.min(c1, c2),
        r2: Math.max(r1, r2),
        c2: Math.max(c1, c2),
    };
}

export function createSelectionState(rowCount: () => number, cols: number) {
    const [selection, setSelection] = createSignal<Selection>({
        mode: "cell",
        anchor: { row: 0, col: 0 },
        focus: { row: 0, col: 0 },
        range: { r1: 0, c1: 0, r2: 0, c2: 0 },
    });
    const [activeCell, setActiveCell] = createSignal<CellPos>({ row: 0, col: 0 });
    const [editingCell, setEditingCell] = createSignal<CellPos | null>(null);

    /** Undo/Redo後、影響したセル範囲にアクティブセル・選択範囲を移動する */
    function focusRange(range: SelectionRange) {
        batch(() => {
            setActiveCell({ row: range.r1, col: range.c1 });
            setSelection({
                mode: "cell",
                anchor: { row: range.r1, col: range.c1 },
                focus: { row: range.r2, col: range.c2 },
                range,
            });
        });
    }

    function selectCell(row: number, col: number, extend = false) {
        const anchor = extend ? selection().anchor : { row, col };
        const focus = { row, col };
        setSelection({
            mode: "cell",
            anchor,
            focus,
            range: normalizeRange(anchor.row, anchor.col, row, col),
        });
        if (!extend) setActiveCell({ row, col });
    }

    function selectColumn(col: number, extend = false) {
        const anchorCol = extend ? selection().anchor.col : col;
        const focus = { row: rowCount() - 1, col };
        setSelection({
            mode: "col",
            anchor: { row: 0, col: anchorCol },
            focus,
            range: normalizeRange(0, anchorCol, rowCount() - 1, col),
        });
        if (!extend) setActiveCell({ row: 0, col });
    }

    function selectRow(row: number, extend = false) {
        const anchorRow = extend ? selection().anchor.row : row;
        const focus = { row, col: cols - 1 };
        setSelection({
            mode: "row",
            anchor: { row: anchorRow, col: 0 },
            focus,
            range: normalizeRange(anchorRow, 0, row, cols - 1),
        });
        if (!extend) setActiveCell({ row, col: 0 });
    }

    function selectAll() {
        setSelection({
            mode: "cell",
            anchor: { row: 0, col: 0 },
            focus: { row: rowCount() - 1, col: cols - 1 },
            range: { r1: 0, c1: 0, r2: rowCount() - 1, c2: cols - 1 },
        });
    }

    /** 編集を終え、アクティブセル・選択を A1 に戻す（データ全体を差し替えたとき用） */
    function reset() {
        setEditingCell(null);
        setActiveCell({ row: 0, col: 0 });
        setSelection({
            mode: "cell",
            anchor: { row: 0, col: 0 },
            focus: { row: 0, col: 0 },
            range: { r1: 0, c1: 0, r2: 0, c2: 0 },
        });
    }

    return {
        selection,
        setSelection,
        activeCell,
        setActiveCell,
        editingCell,
        setEditingCell,
        focusRange,
        selectCell,
        selectColumn,
        selectRow,
        selectAll,
        reset,
    };
}

export type SelectionState = ReturnType<typeof createSelectionState>;
