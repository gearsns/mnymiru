/**
 * 【部品: controller / キーボード】
 * キー入力を「アクション」に振り分ける窓口。判定ロジックは持たず、
 *   - どのキーがどのアクションか → lib/keymap.ts（props.keyBindings で上書き可）
 *   - アクションの中身            → actions.ts / navigation.ts / editor.ts
 * に任せる。新しいショートカットを足すときは、keymap.ts にアクション名とキーを足し、
 * ここで if (is("新アクション")) を1つ増やす。
 */
import { createMemo } from "solid-js";
import { matchesAction, mergeKeyBindings, type GridAction } from "../lib/keymap";
import { formatNowTime, formatTodayDate } from "../lib/quickDateTime";
import { clampHighlightIndex } from "../lib/dropdown";
import type { Actions } from "./actions";
import type { ChangeRunner } from "./changeRunner";
import type { GridContext } from "./context";
import type { CopiedRange } from "./copiedRange";
import type { DropdownController } from "./dropdownState";
import type { Editor } from "./editor";
import type { Navigation } from "./navigation";
import type { RowDrag } from "./rowDrag";

export function createKeyboard(
    ctx: GridContext,
    deps: {
        editor: Editor;
        actions: Actions;
        navigation: Navigation;
        dropdown: DropdownController;
        copied: CopiedRange;
        changes: ChangeRunner;
        rowDrag: RowDrag;
    }
) {
    const { props, store } = ctx;
    const { editor, actions, navigation, dropdown, copied, changes, rowDrag } = deps;
    const { locked } = changes;
    const { moveActive, moveActiveTo } = navigation;

    const keyBindings = createMemo(() => mergeKeyBindings(props.keyBindings));

    function handleKeyDown(e: KeyboardEvent) {
        const editing = store.editingCell();
        const bindings = keyBindings();
        const is = (action: GridAction) => matchesAction(e, action, bindings);

        if (is("cancelEdit")) {
            if (rowDrag.isActive() || rowDrag.isPending()) {
                // 行のドラッグ中は、Esc で取り消す（移動しない）
                e.preventDefault();
                rowDrag.cancel();
            } else if (editing) {
                e.preventDefault();
                editor.cancelEdit();
            } else if (copied.copiedRange()) {
                copied.setCopiedRange(null);
            }
            return;
        }

        if (editor.isComposing()) return; // IME変換中はナビゲーションキーを奪わない

        // 日付・時刻の挿入（編集中かどうかに関わらず使える。編集中はカーソル位置に挿入する）
        if (is("insertTime")) {
            e.preventDefault();
            actions.insertQuickValue(formatNowTime());
            return;
        }
        if (is("insertDate")) {
            e.preventDefault();
            actions.insertQuickValue(formatTodayDate());
            return;
        }

        // 編集中にドロップダウンが開いていれば、上下キーはハイライト移動に使う
        if (editing && dropdown.dropdown()) {
            const list = dropdown.filteredOptions();
            if (is("arrowDown") && list.length > 0) {
                e.preventDefault();
                dropdown.setHighlightedIndex((i) => clampHighlightIndex(i, list.length, 1));
                return;
            }
            if (is("arrowUp") && list.length > 0) {
                e.preventDefault();
                dropdown.setHighlightedIndex((i) => clampHighlightIndex(i, list.length, -1));
                return;
            }
        }

        if (is("commitEnter")) {
            e.preventDefault();
            if (editing) {
                const list = dropdown.dropdown() ? dropdown.filteredOptions() : [];
                const idx = dropdown.highlightedIndex();
                if (idx >= 0 && idx < list.length) editor.selectDropdownOption(list[idx], 1, 0);
                else editor.commitEdit(1, 0);
            } else if (e.altKey) editor.beginEdit();
            else moveActive(e.shiftKey ? -1 : 1, 0, false);
            return;
        }
        if (is("commitTab")) {
            e.preventDefault();
            if (editing) {
                const list = dropdown.dropdown() ? dropdown.filteredOptions() : [];
                const idx = dropdown.highlightedIndex();
                if (idx >= 0 && idx < list.length) editor.selectDropdownOption(list[idx], 0, e.shiftKey ? -1 : 1);
                else editor.commitEdit(0, e.shiftKey ? -1 : 1);
            } else moveActive(0, e.shiftKey ? -1 : 1, false);
            return;
        }
        if (is("editF2")) {
            e.preventDefault();
            if (!editing && !locked()) editor.beginEdit();
            return;
        }

        // ツリー: Alt+→ で展開、Alt+← で折りたたみ（すでに折りたたまれていれば親へ移動）。矢印キーより先に判定する
        if (!editing && store.treeEnabled) {
            if (is("treeExpand")) {
                e.preventDefault();
                actions.expandActive();
                return;
            }
            if (is("treeCollapse")) {
                e.preventDefault();
                actions.collapseActive();
                return;
            }
        }

        if (!editing) {
            if (is("undo")) {
                e.preventDefault();
                actions.undo();
                return;
            }
            if (is("redo")) {
                e.preventDefault();
                actions.redo();
                return;
            }
            if (is("selectAll")) {
                e.preventDefault();
                actions.selectAll();
                return;
            }
            if (is("fillDown")) {
                // 選択範囲内で上のセルの内容・書式を下方向にコピーする
                e.preventDefault();
                actions.fillDown();
                return;
            }
            if (is("documentHome")) {
                // ワークシートの先頭 (A1) セルへ移動
                e.preventDefault();
                moveActiveTo(0, 0, false);
                return;
            }
            if (is("documentEnd")) {
                // データが入っている最も右・最も下のセルへ移動
                e.preventDefault();
                const used = store.findUsedRange();
                moveActiveTo(used.row, used.col, false);
                return;
            }

            const arrowMap: Partial<Record<GridAction, [number, number]>> = {
                arrowUp: [-1, 0],
                arrowDown: [1, 0],
                arrowLeft: [0, -1],
                arrowRight: [0, 1],
            };
            for (const action in arrowMap) {
                if (is(action as GridAction)) {
                    e.preventDefault();
                    const [dr, dc] = arrowMap[action as GridAction]!;
                    moveActive(dr, dc, e.shiftKey);
                    return;
                }
            }
            if (is("home")) {
                // 現在行の先頭列(A列など)へ移動。Shift+Home なら選択を拡張する
                e.preventDefault();
                const rowRef = e.shiftKey ? store.selection().focus.row : store.activeCell().row;
                moveActiveTo(rowRef, 0, e.shiftKey);
                return;
            }
            if (is("end")) {
                // 現在行の最終列へ移動
                e.preventDefault();
                const rowRef = e.shiftKey ? store.selection().focus.row : store.activeCell().row;
                moveActiveTo(rowRef, store.cols - 1, e.shiftKey);
                return;
            }
            if (is("deleteCell")) {
                e.preventDefault();
                actions.deleteSelection();
                return;
            }
        }
    }

    return { handleKeyDown };
}

export type Keyboard = ReturnType<typeof createKeyboard>;
