/**
 * 【部品: controller / 編集アクション】
 * 「Undo」「削除」「Ctrl+D」「日付の挿入」のような、ユーザーが起こす1つの操作。
 * キーボード・ツールバー・右クリックメニューなど、どこから呼んでもよいように
 * キー判定や DOM イベントとは切り離してある（呼ぶ側は keyboard.ts）。
 * いずれも locked()（onChange 処理中・読み取り専用）のときは何もしない。
 */
import { spliceAtCursor } from "../lib/textEdit";
import type { EditToken } from "../store/createGridStore";
import type { DropPosition } from "../types";
import type { ChangeRunner } from "./changeRunner";
import type { GridContext } from "./context";
import type { DropdownController } from "./dropdownState";
import type { Navigation } from "./navigation";
import type { Viewport } from "./viewport";

export function createActions(
    ctx: GridContext,
    deps: {
        viewport: Viewport;
        changes: ChangeRunner;
        dropdown: DropdownController;
        navigation: Navigation;
        requestRender: () => void;
    }
) {
    const { props, store, els } = ctx;
    const { viewport, changes, dropdown, navigation, requestRender } = deps;
    const { locked, runOnChange } = changes;

    function undo() {
        if (locked()) return;
        store.undo();
        const ac = store.activeCell();
        viewport.ensureVisible(ac.row, ac.col);
        requestRender();
    }

    function redo() {
        if (locked()) return;
        store.redo();
        const ac = store.activeCell();
        viewport.ensureVisible(ac.row, ac.col);
        requestRender();
    }

    function selectAll() {
        store.selectAll();
        requestRender();
    }

    /** 選択範囲の値を削除する（Delete/Backspace） */
    function deleteSelection() {
        if (locked()) return;
        const range = store.selection().range;
        // セル範囲をクリアしつつ、変更されたトークンを取得する
        const token: EditToken = store.clearRange(range);

        // 範囲内の先頭セルなどを基準にして onChange を呼ぶ（または必要に応じて各セル）
        // 履歴の行はデータ行。onChange にもデータ行と変更後の値を渡す
        if (token && token.edits.length > 0) {
            const first = token.edits[0];
            void runOnChange(first.row, first.col, first.after, token);
        }
        requestRender();
    }

    /** 選択範囲内で先頭行の内容・書式を下方向へコピーする（Ctrl+D） */
    function fillDown() {
        if (locked()) return;
        const range = store.selection().range;
        const token = store.fillDown(range);
        if (token && token.edits.length > 0) {
            const first = token.edits[0];
            void runOnChange(first.row, first.col, first.after, token);
        }
        requestRender();
    }

    /**
     * カーソル位置（または末尾）に日付・時刻などの文字列を挿入する（Ctrl+; / Ctrl+Shift+: 用）。
     * 編集中ならカーソル位置に挿入し、編集中でなければセルの値を直接その文字列に置き換える
     * （Excelの Ctrl+; がセルの内容をその場で日付に置き換えるのと同じ挙動）。
     */
    function insertQuickValue(text: string) {
        if (locked()) return;
        const editing = store.editingCell();
        if (editing) {
            const input = els.input;
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            const { value: nextValue, caret } = spliceAtCursor(input.value, start, end, text);
            input.value = nextValue;
            dropdown.setEditText(nextValue);
            input.setSelectionRange(caret, caret);
            requestRender();
        } else {
            const { row, col } = store.activeCell();
            const token: EditToken = store.setCellValue(row, col, text);
            void runOnChange(store.dataRowOf(row), col, text, token);
        }
    }

    // ---------- 行の移動（ドラッグ＆ドロップ） ----------

    /**
     * 行を移動する。sources・target.row は表示行。読み取り専用・onChange 処理中は何もしない。
     * canMoveRows が false を返したときも移動しない。移動したら onRowsMove を呼ぶ。移動したかを返す。
     */
    function moveRows(sources: number[], target: { row: number; position: DropPosition }): boolean {
        if (locked()) return false;
        const info = store.previewMoveRows(sources, target);
        if (!info) return false;
        if (props.canMoveRows?.(info) === false) return false;
        const prev = store.activeCell();
        const result = store.moveRows(sources, target);
        if (!result) return false;
        afterTreeChange(prev);
        props.onRowsMove?.(result);
        return true;
    }

    // ---------- ツリー（開閉は閲覧の操作なので、読み取り専用・onChange 処理中でも行える） ----------

    /** 開閉のあと、アクティブセルを画面内に収め、必要なら親へ通知して描き直す */
    function afterTreeChange(prev: { row: number; col: number }) {
        const ac = store.activeCell();
        viewport.ensureVisible(ac.row, ac.col);
        if (ac.row !== prev.row || ac.col !== prev.col) props.onActiveCellChange?.(ac.row, ac.col);
        requestRender();
    }

    /** 表示行 row の展開・折りたたみを切り替える */
    function toggleRow(row: number) {
        const prev = store.activeCell();
        store.toggleRow(row);
        afterTreeChange(prev);
    }

    /** アクティブな行が折りたたまれていれば展開する（Alt+→） */
    function expandActive() {
        const { row } = store.activeCell();
        if (store.rowHasChildren(row) && !store.rowExpanded(row)) toggleRow(row);
    }

    /** アクティブな行が展開されていれば折りたたむ。すでに折りたたまれている（子がない）なら親の行へ移動する（Alt+←） */
    function collapseActive() {
        const { row, col } = store.activeCell();
        if (store.rowExpanded(row)) {
            toggleRow(row);
            return;
        }
        const parent = store.parentRow(row);
        if (parent >= 0) navigation.moveActiveTo(parent, col, false);
    }

    return {
        undo,
        redo,
        selectAll,
        deleteSelection,
        fillDown,
        insertQuickValue,
        moveRows,
        toggleRow,
        expandActive,
        collapseActive,
    };
}

export type Actions = ReturnType<typeof createActions>;
