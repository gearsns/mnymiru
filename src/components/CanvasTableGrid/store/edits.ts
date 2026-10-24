/**
 * 【部品: store / 編集操作】
 * 値・書式を書き換え、その変更を「Undo の1単位」として履歴に積む操作の集まり。
 * （setCellValue / setRangeValues / setRangeFormat / clearRange / fillDown / sortRows /
 *   mergeCellEdits / moveRows）
 * セルの読み書きは gridData、履歴は history に任せ、ここは「どの変更を1操作にまとめるか」だけを決める。
 *
 * 座標について（詳しくは rowModel.ts）:
 *   各操作の引数の行は「表示行」（選択範囲など、画面の座標）。内部で rows.dataRow() によって
 *   データ行に直してから gridData を読み書きし、履歴（CellEdit.row）にはデータ行を記録する。
 *   ただし mergeCellEdits の changes の行は最初からデータ行（onChange で受け取った行をそのまま渡す）。
 *   折りたたまれて見えない行は、範囲操作（貼り付け・削除・Ctrl+D など）の対象にならない。
 */
import { batch } from "solid-js";
import { unwrap } from "solid-js/store";
import type { CellFormat, CellValue, DropPosition, RowMoveInfo, RowMoveResult, SelectionRange } from "../types";
import type { GridData } from "./gridData";
import type { GridHistory } from "./history";
import type { RowModel } from "./rowModel";
import type { TreeState } from "./treeState";
import { planRowMove } from "../lib/rowMove";
import { planTreeSort } from "../lib/tree";
import type { CellChange, CellEdit, Command, EditToken, SortReformat } from "./types";

function sameFormat(a: CellFormat | undefined, b: CellFormat | undefined): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof CellFormat>;
    for (const k of keys) {
        if (k === "border") {
            if (a.border?.top !== b.border?.top || a.border?.left !== b.border?.left) return false;
        } else if (a[k] !== b[k]) return false;
    }
    return true;
}

export function createEditOps(deps: { data: GridData; history: GridHistory; rows: RowModel; tree: TreeState }) {
    const { data: grid, history, rows, tree } = deps;
    const { getCell, getFormat, applyEdits, appendRows, cols } = grid;
    /** 最終行（見えている最後の行）への入力なら、行を自動追加する */
    const expandIfNeeded = (edits: CellEdit[]) => grid.expandIfNeeded(edits, rows.lastVisibleDataRow());

    /** 単一セルの値を変更（undo対応）。戻り値は mergeCellEdits() に渡すトークン。
     * onChange で非同期に関連セルへ値を補完したい場合、この戻り値をとっておき
     * 補完が終わったタイミングで mergeCellEdits(token, ...) を呼ぶと、
     * この変更と同じUndo単位にまとめられる。 */
    function setCellValue(row: number, col: number, value: CellValue): EditToken {
        const dataRow = rows.dataRow(row);
        const before = getCell(dataRow, col);
        if (before === value) return null;
        const edit: CellEdit = { row: dataRow, col, before, after: value };
        applyEdits([edit], true);
        const cmd: Command = { kind: "cellEdit", label: "setCellValue", edits: [edit] };
        history.push(cmd);
        const appended = expandIfNeeded([edit]);
        if (appended > 0) cmd.appendedRows = appended;
        return cmd;
    }

    /**
     * 非同期処理（サーバーからの補完値取得など）の結果を、指定したトークンの
     * Undoコマンドにマージする。
     * - token がまだ Undo スタックの先頭にある（＝その後に他の変更や
     *   Undo/Redo が行われていない）場合：同じコマンドの edits に追記し、
     *   1回の Undo/Redo で元の変更とまとめて取り消し／やり直しできるようにする。
     * - すでに他の変更が積まれていた・Undoされていた場合：整合性のため
     *   独立した新しいコマンドとして積む（安全側にフォールバック）。
     */
    function mergeCellEdits(token: EditToken, changes: CellChange[]) {
        if (changes.length === 0) return;
        // 同じセルが複数回含まれても正しい before を取れるよう、1件ずつ適用しながら進める
        const newEdits: CellEdit[] = [];
        batch(() => {
            for (const c of changes) {
                const before = getCell(c.row, c.col);
                const beforeFormat = getFormat(c.row, c.col);
                const after = c.value !== undefined ? c.value : before;
                let afterFormat = beforeFormat;
                if (c.format === null) afterFormat = undefined;
                else if (c.format) afterFormat = { ...beforeFormat, ...c.format };

                const valueChanged = before !== after;
                const formatChanged = !sameFormat(beforeFormat, afterFormat);
                if (!valueChanged && !formatChanged) continue;

                const edit: CellEdit = { row: c.row, col: c.col, before, after };
                if (formatChanged) {
                    edit.beforeFormat = beforeFormat;
                    edit.afterFormat = afterFormat;
                }
                applyEdits([edit], true);
                newEdits.push(edit);
            }
        });
        if (newEdits.length === 0) return;

        const isStillTop = history.isLatest(token);

        const appended = expandIfNeeded(newEdits);
        if (isStillTop) {
            token!.edits.push(...newEdits);
            if (appended > 0) token!.appendedRows = (token!.appendedRows ?? 0) + appended;
            history.touch();
        } else {
            // token が無効（null／既に他の変更で上書きされた／Undo済み）な場合は
            // 独立した新しいコマンドとして積む（安全側へのフォールバック）
            const cmd: Command = { kind: "cellEdit", label: "mergedEdits", edits: newEdits };
            if (appended > 0) cmd.appendedRows = appended;
            history.push(cmd);
        }
    }

    /** 範囲に対して複数セルをまとめて変更（貼り付け・削除など、undo単位は1つ）。戻り値は mergeCellEdits() 用トークン。 */
    function setRangeValues(
        range: SelectionRange,
        valueAt: (row: number, col: number) => CellValue,
        opts?: { growRows?: boolean }
    ): EditToken {
        const edits: CellEdit[] = [];
        const visibleCount = rows.visibleCount();
        let maxRow = 0; // 書き込み先の最大の表示行
        for (let r = range.r1; r <= range.r2; r++) {
            const dataRow = rows.dataRow(r);
            for (let c = range.c1; c <= range.c2; c++) {
                const before = getCell(dataRow, c);
                const after = valueAt(r, c);
                if (before !== after) {
                    edits.push({ row: dataRow, col: c, before, after });
                    if (r > maxRow) maxRow = r;
                }
            }
        }
        if (edits.length === 0) return null;
        // growRows 指定時は、現在の行数を超える行への書き込みに必要な分だけ、このコマンドの一部として行を追加する
        let appended = 0;
        if (opts?.growRows) {
            const need = maxRow + 1 - visibleCount;
            if (need > 0) appended += appendRows(need);
        }
        applyEdits(edits, true);
        const cmd: Command = { kind: "cellEdit", label: "setRangeValues", edits };
        history.push(cmd);
        appended += expandIfNeeded(edits);
        if (appended > 0) cmd.appendedRows = appended;
        return cmd;
    }

    /** 範囲の書式を変更（undo対応） */
    function setRangeFormat(range: SelectionRange, format: CellFormat) {
        const edits: CellEdit[] = [];
        for (let r = range.r1; r <= range.r2; r++) {
            const dataRow = rows.dataRow(r);
            for (let c = range.c1; c <= range.c2; c++) {
                const beforeFormat = getFormat(dataRow, c);
                edits.push({
                    row: dataRow,
                    col: c,
                    before: getCell(dataRow, c),
                    after: getCell(dataRow, c),
                    beforeFormat,
                    afterFormat: { ...beforeFormat, ...format },
                });
            }
        }
        applyEdits(edits, true);
        history.push({ kind: "cellEdit", label: "setRangeFormat", edits });
    }

    /** 選択範囲を削除(Delete/Backspace) */
    function clearRange(range: SelectionRange): EditToken {
        return setRangeValues(range, () => null);
    }

    /**
     * 選択範囲内で、先頭行（単一行選択の場合は1つ上の行）の値と書式を
     * 下方向へコピーする（Excelの Ctrl+D 相当）。1回のUndoでまとめて戻せる。
     */
    function fillDown(range: SelectionRange): EditToken {
        const isSingleRow = range.r1 === range.r2;
        const srcRow = isSingleRow ? range.r1 - 1 : range.r1;
        if (srcRow < 0) return null;
        const targetStart = isSingleRow ? range.r1 : range.r1 + 1;

        const edits: CellEdit[] = [];
        const srcDataRow = rows.dataRow(srcRow);
        for (let r = targetStart; r <= range.r2; r++) {
            const dataRow = rows.dataRow(r);
            for (let c = range.c1; c <= range.c2; c++) {
                const before = getCell(dataRow, c);
                const beforeFormat = getFormat(dataRow, c);
                const after = getCell(srcDataRow, c);
                const afterFormat = getFormat(srcDataRow, c);
                if (before === after && beforeFormat === afterFormat) continue;
                edits.push({ row: dataRow, col: c, before, after, beforeFormat, afterFormat });
            }
        }
        if (edits.length === 0) return null;
        applyEdits(edits, true);
        const cmd: Command = { kind: "cellEdit", label: "fillDown", edits };
        history.push(cmd);
        const appended = expandIfNeeded(edits);
        if (appended > 0) cmd.appendedRows = appended;
        return cmd;
    }

    /**
     * 行 startData から始まる範囲を order の通りに並べ替え、1つの Undo 単位として履歴に積む（ソート・行の移動で共通）。
     * order[i] = 「startData + i 行目に来る、元のデータ行」。値と書式を行ごと移動する。
     *
     * ツリーでは、階層は行と一緒に動かし（opts.levels で移動後の値を指定、省略すると order の通りに並べ替えた値）、
     * Undo/Redo では前後の値を書き戻す。開閉状態は行に付いて動くが、Undo/Redo は「現在の状態を並べ替える」だけで、
     * 開閉の値そのものは書き戻さない（開閉は Undo の対象外。利用者が行った開閉は Undo で失われない）。
     * opts.expandRow は、移動に伴って展開する行（元のデータ行）。Redo で展開し、Undo では折りたたみに戻さない。
     * opts.moveHeights が true なら行の高さも行と一緒に動かす。
     * 何も変わらなければ履歴には積まず null を返す。
     */
    function commitReorder(
        label: string,
        startData: number,
        order: number[],
        opts: { levels?: number[]; expandRow?: number; moveHeights?: boolean } = {}
    ): EditToken {
        const raw = unwrap(grid.data); // プロキシを介さない生データ
        const endData = startData + order.length - 1;

        // 適用前に差分をすべて計算する（途中で書き換えないので読み取りは常に元の状態）
        const edits: CellEdit[] = [];
        for (let i = 0; i < order.length; i++) {
            const dst = startData + i;
            const src = order[i];
            if (dst === src) continue;
            for (let c = 0; c < cols; c++) {
                const before = raw.cells[dst][c];
                const after = raw.cells[src][c];
                const beforeFormat = raw.formats[dst][c];
                const afterFormat = raw.formats[src][c];
                if (before === after && beforeFormat === afterFormat) continue;
                edits.push({ row: dst, col: c, before, after, beforeFormat, afterFormat });
            }
        }

        // 行の高さ
        let heightParts: { undo: () => void; redo: () => void } | null = null;
        if (opts.moveHeights) {
            const beforeHeights = order.map((_, i) => grid.rowHeights[startData + i]);
            const afterHeights = order.map((src) => grid.rowHeights[src]);
            if (afterHeights.some((v, i) => v !== beforeHeights[i])) {
                heightParts = {
                    undo: () => grid.patchRowHeights(startData, beforeHeights),
                    redo: () => grid.patchRowHeights(startData, afterHeights),
                };
            }
        }

        // ツリー: 階層・開閉状態
        const undoParts: Array<() => void> = [];
        const redoParts: Array<() => void> = [];
        let changed = edits.length > 0 || heightParts !== null;
        if (rows.enabled) {
            const lv = tree.levels();
            const ex = tree.expanded();
            const reordered = order.some((r, i) => r !== startData + i);
            const beforeLevels = lv.slice(startData, endData + 1);
            const afterLevels = opts.levels ?? order.map((i) => lv[i]);
            const levelsChanged = afterLevels.some((v, i) => v !== beforeLevels[i]);
            const flagsChanged = reordered && order.some((old, i) => ex[old] !== ex[startData + i]);
            const expands = opts.expandRow !== undefined && !ex[opts.expandRow];
            if (levelsChanged || flagsChanged || expands) changed = true;

            if (changed) {
                if (levelsChanged) {
                    undoParts.push(() => tree.patchLevels(startData, beforeLevels));
                    redoParts.push(() => tree.patchLevels(startData, afterLevels));
                }
                if (reordered) {
                    // 開閉状態が行に付いて動くように、並べ替えも記録する（あとで利用者が開閉しても、Undo で行と一緒に戻る）
                    undoParts.push(() => tree.unpermuteExpanded(startData, order));
                    redoParts.push(() => tree.permuteExpanded(startData, order));
                }
                if (opts.expandRow !== undefined) {
                    const newRow = startData + order.indexOf(opts.expandRow);
                    redoParts.push(() => tree.setExpandedAt(newRow, true)); // Undo では折りたたみに戻さない
                }
            }
        }
        if (heightParts) {
            undoParts.push(heightParts.undo);
            redoParts.push(heightParts.redo);
        }

        if (!changed) return null;
        const structure =
            redoParts.length > 0
                ? { undo: () => undoParts.forEach((f) => f()), redo: () => redoParts.forEach((f) => f()) }
                : undefined;
        applyEdits(edits, true);
        structure?.redo();
        const cmd: EditToken = { kind: "cellEdit", label, edits };
        if (structure) cmd.structure = structure;
        history.push(cmd);
        return cmd;
    }

    /**
     * 行を compare の順に並べ替える（Undo/Redo対応・1操作）。
     * 値と書式を行ごと移動する。既定の対象は 0 行目〜データが入っている最終行。
     * ヘッダ行を除きたい場合は startRow を指定する（startRow / endRow は表示行）。
     *
     * ツリーの場合は「同じ親の下の兄弟どうし」を並べ替え、各行は子孫ごと移動する
     * （階層・開閉状態も行と一緒に移動する）。折りたたまれた行も並べ替えの対象。
     * reformat には表示行を渡す。
     */
    function sortRows(
        compare: (a: CellValue[], b: CellValue[]) => number,
        opts?: { startRow?: number; endRow?: number; reformat?: SortReformat }
    ): EditToken {
        const raw = unwrap(grid.data); // プロキシを介さない生データ
        const startRow = Math.max(0, opts?.startRow ?? 0);
        const endRow = Math.min(rows.visibleCount() - 1, opts?.endRow ?? rows.findUsedRange().row);
        if (endRow - startRow < 1) return null;

        // 並べ替える範囲（データ行）。ツリーでは、最後の行の子孫（折りたたまれた行）まで含める
        const startData = rows.dataRow(startRow);
        const endData = rows.lastDescendant(rows.dataRow(endRow));

        // order[i] = 「startData + i 行目に来る元のデータ行番号」。元の行番号で同順位を解決して安定ソートにする
        let order: number[];
        if (rows.enabled) {
            order = planTreeSort(tree.levels(), startData, endData, (a, b) => compare(raw.cells[a], raw.cells[b]));
        } else {
            order = [];
            for (let r = startData; r <= endData; r++) order.push(r);
            order.sort((a, b) => compare(raw.cells[a], raw.cells[b]) || a - b);
        }

        // 並べ替えを適用して履歴に積む（ツリーでは階層・開閉状態も行と一緒に動く）
        let cmd: EditToken = commitReorder("sortRows", startData, order);

        // ソート後の状態を元に書式を再計算し、同じUndo単位にマージする。
        // 範囲の1つ下の行も対象にする（その行は「1つ上のセル」が変わるため）
        if (opts?.reformat) {
            const reformat = opts.reformat;
            const changes: CellChange[] = [];
            const lastRow = Math.min(rows.visibleCount() - 1, endRow + 1);
            const getCellAt = (r: number, c: number) => getCell(rows.dataRow(r), c);
            for (let r = startRow; r <= lastRow; r++) {
                const dataRow = rows.dataRow(r);
                for (let c = 0; c < cols; c++) {
                    const format = reformat(r, c, { value: getCell(dataRow, c), getCell: getCellAt, format: getFormat(dataRow, c) });
                    if (format !== undefined) changes.push({ row: dataRow, col: c, format });
                }
            }
            // cmd が null（ソートで並びが変わらなかった）場合は、書式変更だけが独立したコマンドになる
            const before = history.size();
            mergeCellEdits(cmd, changes);
            if (cmd === null && history.size() > before) {
                const top = history.latest();
                if (top && top.kind === "cellEdit") cmd = top;
            }
        }
        return cmd;
    }

    // ---------- 行の移動（ドラッグ＆ドロップ） ----------

    /** 表示行で指定された移動元・ドロップ先を、データ行の移動計画にする（移動できなければ null） */
    function planMove(sourceRows: number[], target: { row: number; position: DropPosition }) {
        const visible = rows.visibleCount();
        if (target.row < 0 || target.row >= visible) return null;
        return planRowMove({
            count: grid.rowCount(),
            sources: sourceRows.filter((r) => r >= 0 && r < visible).map((r) => rows.dataRow(r)),
            target: { row: rows.dataRow(target.row), position: target.position },
            levels: rows.enabled ? tree.levels() : undefined,
            expanded: rows.enabled ? tree.expanded() : undefined,
        });
    }

    /** 移動できるか確認する（実際には動かさない）。できなければ null */
    function previewMoveRows(sourceRows: number[], target: { row: number; position: DropPosition }): RowMoveInfo | null {
        const plan = planMove(sourceRows, target);
        if (!plan) return null;
        return {
            rows: plan.heads,
            target: { row: rows.dataRow(target.row), position: target.position },
            level: plan.level,
        };
    }

    /**
     * 行を移動する（Undo/Redo 対応・1操作）。sourceRows・target.row は表示行。
     * ツリーでは子孫ごと移動し、階層は移動先に合わせて付け替える。行の高さも行と一緒に動く。
     * 移動できない・動きがない場合は null。
     * newIndices は、移動した行の移動後のデータ行（呼び出し側が選択を移すために使う）。
     */
    function moveRows(
        sourceRows: number[],
        target: { row: number; position: DropPosition }
    ): { token: EditToken; result: RowMoveResult; newIndices: number[] } | null {
        const plan = planMove(sourceRows, target);
        if (!plan) return null;
        const token = commitReorder("moveRows", plan.start, plan.order, {
            levels: plan.levels,
            expandRow: plan.expandRow,
            moveHeights: true,
        });
        if (!token) return null;

        const total = grid.rowCount();
        const order = Array.from({ length: total }, (_, i) => i);
        plan.order.forEach((old, i) => (order[plan.start + i] = old));
        const result: RowMoveResult = {
            rows: plan.heads,
            target: { row: rows.dataRow(target.row), position: target.position },
            level: plan.level,
            order,
        };
        if (rows.enabled) result.levels = tree.levels().slice();
        return { token, result, newIndices: plan.newIndices };
    }

    return {
        setCellValue,
        mergeCellEdits,
        setRangeValues,
        setRangeFormat,
        clearRange,
        fillDown,
        sortRows,
        moveRows,
        previewMoveRows,
    };
}

export type EditOps = ReturnType<typeof createEditOps>;
