/**
 * 【部品: store / ツリーの開閉操作】
 * 行の展開・折りたたみ。開閉すると表示行の番号がずれるので、選択範囲・アクティブセル・
 * 編集中のセルが「同じデータ行」を指し続けるよう付け替える。
 * （折りたたまれて見えなくなった行を指していた場合は、見えている最も近い祖先へ移る。）
 */
import { batch } from "solid-js";
import type { CellPos, Selection } from "../types";
import type { RowModel } from "./rowModel";
import { normalizeRange, type SelectionState } from "./selection";
import type { TreeState } from "./treeState";

export function createTreeOps(deps: { rows: RowModel; tree: TreeState; selection: SelectionState }) {
    const { rows, tree, selection } = deps;

    /** 構造を変える処理 mutate を実行し、その前後で選択などを同じデータ行に付け替える */
    function changeStructure(mutate: () => void) {
        if (!rows.enabled) return;
        batch(() => {
            const sel = selection.selection();
            const active = selection.activeCell();
            const editing = selection.editingCell();
            // 変更前に、指している行をデータ行で控える
            const anchorD = rows.dataRow(sel.anchor.row);
            const focusD = rows.dataRow(sel.focus.row);
            const activeD = rows.dataRow(active.row);
            const editingD = editing ? rows.dataRow(editing.row) : -1;

            mutate();

            const snap = rows.snapshotNow();
            const lastRow = Math.max(0, snap.visible.length - 1);
            const toRow = (d: number) => rows.nearestVisible(d, snap);

            let next: Selection;
            if (sel.mode === "col") {
                // 列選択は常に「全行」を指す
                next = {
                    mode: "col",
                    anchor: { row: 0, col: sel.anchor.col },
                    focus: { row: lastRow, col: sel.focus.col },
                    range: normalizeRange(0, sel.anchor.col, lastRow, sel.focus.col),
                };
            } else {
                const anchor: CellPos = { row: toRow(anchorD), col: sel.anchor.col };
                const focus: CellPos = { row: toRow(focusD), col: sel.focus.col };
                next = {
                    mode: sel.mode,
                    anchor,
                    focus,
                    range: normalizeRange(anchor.row, anchor.col, focus.row, focus.col),
                };
            }
            selection.setSelection(next);
            selection.setActiveCell({ row: toRow(activeD), col: active.col });
            if (editing) {
                // 編集中の行が隠れた場合は、編集を終える
                const row = snap.displayOf[editingD] ?? -1;
                selection.setEditingCell(row < 0 ? null : { row, col: editing.col });
            }
        });
    }

    /** 表示行 row の展開状態を設定する（子のない行は何もしない） */
    function setExpanded(row: number, expanded: boolean) {
        if (!rows.hasChildren(row)) return;
        const d = rows.dataRow(row);
        changeStructure(() => tree.setExpandedAt(d, expanded));
    }

    function toggle(row: number) {
        setExpanded(row, !rows.isExpanded(row));
    }

    function expandAll() {
        changeStructure(() => tree.setAllExpanded(true));
    }

    function collapseAll() {
        changeStructure(() => tree.setAllExpanded(false));
    }

    return { setExpanded, toggle, expandAll, collapseAll };
}

export type TreeOps = ReturnType<typeof createTreeOps>;
