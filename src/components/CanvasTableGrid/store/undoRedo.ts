/**
 * 【部品: store / Undo・Redo 実行】
 * history から取り出したコマンドを実際に適用し、影響したセルへ選択を移す。
 */
import type { SelectionRange } from "../types";
import type { GridData } from "./gridData";
import type { GridHistory } from "./history";
import type { RowModel } from "./rowModel";
import type { SelectionState } from "./selection";
import type { Command } from "./types";

/** コマンドが影響したセル範囲を求める（セルを伴わない変更だけのコマンドは null） */
function boundingRangeOfCommand(cmd: Command): SelectionRange | null {
    if (cmd.edits.length === 0) return null;
    let r1 = Infinity;
    let c1 = Infinity;
    let r2 = -Infinity;
    let c2 = -Infinity;
    for (const e of cmd.edits) {
        if (e.row < r1) r1 = e.row;
        if (e.col < c1) c1 = e.col;
        if (e.row > r2) r2 = e.row;
        if (e.col > c2) c2 = e.col;
    }
    return { r1, c1, r2, c2 };
}

export function createUndoRedo(deps: { data: GridData; history: GridHistory; selection: SelectionState; rows: RowModel }) {
    const { data, history, selection, rows } = deps;

    function runCommand(cmd: Command, useAfter: boolean) {
        const n = cmd.appendedRows ?? 0;
        if (useAfter) {
            // Redo: 先に行を再追加してから値を書き戻す
            if (n > 0) data.appendRows(n);
            data.applyEdits(cmd.edits, true);
            cmd.structure?.redo();
        } else {
            // Undo: 値を戻してから、このコマンドで増えた行を取り除く
            cmd.structure?.undo();
            data.applyEdits(cmd.edits, false);
            if (n > 0) data.removeLastRows(n);
        }
    }

    function undo() {
        const cmd = history.undo((c) => runCommand(c, false));
        if (!cmd) return;
        const range = boundingRangeOfCommand(cmd);
        // コマンドの行はデータ行。画面上の行（表示行）に直して、隠れていれば展開して見せる
        if (range) selection.focusRange(rows.revealRange(range));
    }

    function redo() {
        const cmd = history.redo((c) => runCommand(c, true));
        if (!cmd) return;
        const range = boundingRangeOfCommand(cmd);
        if (range) selection.focusRange(rows.revealRange(range));
    }

    return { undo, redo };
}
