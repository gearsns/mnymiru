/**
 * 【部品: controller / ドロップダウンの状態】
 * セル編集中に出す候補リストの状態（選択肢・読み込み中・絞り込み・ハイライト）。
 * 表示（JSX）は components/DropdownList.tsx、キー操作は keyboard.ts、確定は editor.ts が担当する。
 */
import { createEffect, createMemo, createSignal } from "solid-js";
import { filterDropdownOptions } from "../lib/dropdown";
import type { DropdownOption } from "../types";
import type { GridContext } from "./context";

export interface DropdownState {
    row: number;
    col: number;
    options: DropdownOption[];
    loading: boolean;
}

export function createDropdownState(ctx: GridContext) {
    const { props, store } = ctx;
    const [dropdown, setDropdown] = createSignal<DropdownState | null>(null);
    const [editText, setEditText] = createSignal("");
    const [highlightedIndex, setHighlightedIndex] = createSignal(-1);

    const filteredOptions = createMemo(() => {
        const dd = dropdown();
        if (!dd) return [] as DropdownOption[];
        // カスタムフィルターがあれば優先し、なければデフォルトを使う
        if (props.dropdownFilter) {
            return props.dropdownFilter(dd.options, editText());
        }
        return filterDropdownOptions(dd.options, editText());
    });

    // 絞り込み結果が変わったらハイライトはいったん解除する（明示的に矢印キーで選ぶまでは自由入力扱い）
    createEffect(() => {
        filteredOptions();
        setHighlightedIndex(-1);
    });

    /**
     * 編集開始時に呼び、そのセルにドロップダウンがあれば選択肢を読み込む。
     * 非同期の場合は取得中 loading:true の状態を見せ、完了時にまだ同じセルを
     * 編集中であれば選択肢を反映する（その間に編集をやめていれば何もしない）。
     */
    function open(row: number, col: number) {
        setDropdown(null);
        if (!props.dropdownOptions) return;
        const result = props.dropdownOptions(row, col);
        if (result == null) return;

        if (Array.isArray(result)) {
            setDropdown({ row, col, options: result, loading: false });
            return;
        }

        setDropdown({ row, col, options: [], loading: true });
        result
            .then((options) => {
                const editing = store.editingCell();
                if (!editing || editing.row !== row || editing.col !== col) return; // 既に編集を終えていた
                setDropdown({ row, col, options: options ?? [], loading: false });
            })
            .catch((err) => {
                console.error("[canvas-table-grid] dropdownOptions の取得に失敗しました:", err);
                const editing = store.editingCell();
                if (editing && editing.row === row && editing.col === col) {
                    setDropdown({ row, col, options: [], loading: false });
                }
            });
    }

    function close() {
        setDropdown(null);
    }

    return { dropdown, editText, setEditText, highlightedIndex, setHighlightedIndex, filteredOptions, open, close };
}

export type DropdownController = ReturnType<typeof createDropdownState>;
