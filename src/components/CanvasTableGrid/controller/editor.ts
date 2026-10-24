/**
 * 【部品: controller / セル編集】
 * セル編集の開始・確定・キャンセル、IME（日本語入力）の状態、裏の input のイベント。
 * ドロップダウン候補の確定もここ（確定は「編集の確定」の一種なので）。
 *
 * 編集中かどうかの状態そのものは store.editingCell() にある。ここはその遷移を担当する。
 */
import { createEffect } from "solid-js";
import { coerceValue } from "../lib/coerceValue";
import type { CellValue, DropdownOption } from "../types";
import type { EditToken } from "../store/createGridStore";
import type { ChangeRunner } from "./changeRunner";
import type { GridContext } from "./context";
import type { DropdownController } from "./dropdownState";
import type { InputOverlay } from "./inputOverlay";
import type { Navigation } from "./navigation";

export function createEditor(
    ctx: GridContext,
    deps: {
        overlay: InputOverlay;
        dropdown: DropdownController;
        navigation: Navigation;
        changes: ChangeRunner;
        /** 次のフレームで描き直す */
        requestRender: () => void;
        /** 今すぐ描き直す（cancelEdit の rAF 内でのみ使う） */
        render: () => void;
    }
) {
    const { props, store, els } = ctx;
    const { overlay, dropdown, navigation, changes, requestRender, render } = deps;
    const { locked, runOnChange } = changes;

    /** IME で変換中か。変換中はナビゲーションキーを奪わない（keyboard.ts が参照する） */
    let composing = false;
    const isComposing = () => composing;

    function beginEdit(caretIndex?: number) {
        if (locked()) return; // onChange 処理中は編集開始を禁止
        const target = store.activeCell();
        store.setEditingCell(target);
        const raw = store.getCell(target.row, target.col);
        els.input.value = raw == null ? "" : String(raw);
        dropdown.setEditText(els.input.value);
        overlay.positionInput();
        els.input.focus();
        const len = els.input.value.length;
        const pos = caretIndex === undefined ? len : Math.max(0, Math.min(len, caretIndex));
        els.input.setSelectionRange(pos, pos);
        dropdown.open(target.row, target.col);
        requestRender();
    }

    function commitEdit(moveRow: number, moveCol: number) {
        const editing = store.editingCell();
        if (!editing) return;
        const dataRow = store.dataRowOf(editing.row); // onChange にはデータ行を渡す
        const text = els.input.value;
        const prev = store.getCell(editing.row, editing.col);
        const nextValue: CellValue = text === "" ? null : coerceValue(text, store.getFormat(editing.row, editing.col));
        // 先に編集状態を抜けてカーソルを移動する（値の反映自体は同期的に完了している）。
        // onChange の完了を待つのは「次の編集を許可するタイミング」だけでよい。
        store.setEditingCell(null);
        dropdown.close();
        els.input.value = "";
        navigation.moveActive(moveRow, moveCol, false);
        els.input.focus();
        if (nextValue !== prev) {
            const token: EditToken = store.setCellValue(editing.row, editing.col, nextValue);
            void runOnChange(dataRow, editing.col, nextValue, token);
        }
    }

    function cancelEdit() {
        store.setEditingCell(null);
        dropdown.close();
        els.input.value = "";
        els.input.focus();
        requestAnimationFrame(() => {
            els.input.focus();
            render();
        });
    }

    /** ドロップダウンの選択肢をクリック／Enter/Tabで確定する */
    function selectDropdownOption(opt: DropdownOption, moveRow: number, moveCol: number) {
        els.input.value = opt.value == null ? "" : String(opt.value);
        commitEdit(moveRow, moveCol);
    }

    // ---------- 裏の input のイベント（直接入力・IME） ----------
    function handleInput() {
        if (locked()) return; // onChange 処理中は編集開始を禁止
        if (!store.editingCell() && els.input.value !== "") {
            // 直接入力（IME含む）でセル編集を開始
            const target = store.activeCell();
            store.setEditingCell(target);
            dropdown.open(target.row, target.col);
            requestRender();
        }
        dropdown.setEditText(els.input.value);
    }

    function handleCompositionStart() {
        if (locked()) return; // onChange 処理中は編集開始を禁止
        composing = true;
        if (!store.editingCell()) {
            const target = store.activeCell();
            store.setEditingCell(target);
            dropdown.open(target.row, target.col);
            requestRender();
        }
    }

    function handleCompositionEnd() {
        composing = false;
        dropdown.setEditText(els.input.value);
    }

    /** input への実際のテキスト挿入（IMEの確定含む）を、busy中は最終防衛ラインとして止める */
    function handleBeforeInput(e: InputEvent) {
        if (locked()) e.preventDefault();
    }

    function handleBlur() {
        if (store.editingCell() && !composing) commitEdit(0, 0);
    }

    // 編集が終わった（外部から止められた場合も含む）ら、入力欄とドロップダウンを片付ける
    createEffect(() => {
        if (!store.editingCell()) {
            dropdown.close();
            els.input.value = "";
        }
    });

    // busy中は input を readOnly にして、IME確定を含む書き込みを二重に防ぐ
    createEffect(() => {
        els.input.readOnly = locked();
    });

    // 編集中に読み取り専用へ切り替えられたら、入力中の内容を破棄して編集を終える
    createEffect(() => {
        if (props.readOnly && store.editingCell()) cancelEdit();
    });

    return {
        isComposing,
        beginEdit,
        commitEdit,
        cancelEdit,
        selectDropdownOption,
        handleInput,
        handleCompositionStart,
        handleCompositionEnd,
        handleBeforeInput,
        handleBlur,
    };
}

export type Editor = ReturnType<typeof createEditor>;
