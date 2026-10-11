import { createStore, produce, unwrap } from "solid-js/store";
import { createSignal, batch, createMemo } from "solid-js";
import type {
    CellFormat,
    CellPos,
    CellValue,
    GridOptions,
    Selection,
    SelectionRange,
} from "./types";
import { defaultColumnHeaderLabel, defaultRowHeaderLabel } from "./format";

/** 元に戻せる1つの変更単位。
 * "cellEdit" は edits 配列を参照で保持するため、コマンドを積んだ後でも
 * mergeCellEdits() で同じ配列に追記でき、Undo/Redoが1操作として扱われる。
 */
type Command =
    | {
        kind: "cellEdit";
        label: string;
        edits: CellEdit[];
        /** このコマンドの操作（最終行への入力など）で自動追加された行数。Undo で取り除き、Redo で再追加する */
        appendedRows?: number;
    }
    | { kind: "generic"; label: string; undo: () => void; redo: () => void };

export interface CellEdit {
    row: number;
    col: number;
    before: CellValue;
    after: CellValue;
    beforeFormat?: CellFormat;
    afterFormat?: CellFormat;
}

/** setCellValue が返す、非同期の関連セル更新をマージするためのトークン */
export type EditToken = Extract<Command, { kind: "cellEdit" }> | null;

/**
 * onChange の helpers.mergeEdits() に渡す関連セルへの変更。
 * - value を省略すると値は変更しない（書式だけ変えたいとき）
 * - format は現在の書式にマージされる（指定したプロパティだけ上書き）。
 *   null を渡すとそのセルの書式を丸ごとクリアする。省略すると書式は変更しない
 */
export type CellChange = {
    row: number;
    col: number;
    value?: CellValue;
    format?: CellFormat | null;
};

/** sortRows の reformat コールバックに渡される情報（ソート後の状態） */
export interface SortReformatContext {
    /** このセルのソート後の値 */
    value: CellValue;
    /** ソート後の任意のセルの値（例：1つ上のセルと比較する等に使う） */
    getCell: (row: number, col: number) => CellValue;
    /** このセルのソート後の現在の書式（ソート前の位置から行ごと移動してきたもの） */
    format: CellFormat | undefined;
}

/**
 * ソート後に各セルの書式を再計算するコールバック。
 * - CellFormat を返す → 現在の書式にマージ（指定したプロパティだけ上書き）
 * - null を返す → 書式を丸ごとクリア
 * - undefined を返す → 変更しない
 */
export type SortReformat = (row: number, col: number, ctx: SortReformatContext) => CellFormat | null | undefined;

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

/** この編集が書式の変更を含むか（含まない編集は Undo/Redo 時に書式に触らない） */
function tracksFormat(e: CellEdit): boolean {
    return e.beforeFormat !== undefined || e.afterFormat !== undefined;
}

const MAX_HISTORY = 200;

export function normalizeRange(r1: number, c1: number, r2: number, c2: number): SelectionRange {
    return {
        r1: Math.min(r1, r2),
        c1: Math.min(c1, c2),
        r2: Math.max(r1, r2),
        c2: Math.max(c1, c2),
    };
}

export function createGridStore(options: GridOptions) {
    const initialRows = options.rows;
    const cols = options.cols;
    const defaultRowHeight = options.defaultRowHeight ?? 28;
    /** 最終行に値を入れたときに追加する行数（0 なら自動追加しない） */
    const autoAppendRows = Math.max(0, Math.floor(options.autoAppendRows ?? 0));
    // 行数は途中で増える（appendRows / ensureRows）ため、シグナルで持つ
    const [rowCount, setRowCount] = createSignal(initialRows);

    const initialData: CellValue[][] =
        options.data ?? Array.from({ length: initialRows }, () => Array<CellValue>(cols).fill(null));
    const initialFormats: (CellFormat | undefined)[][] =
        options.formats ?? Array.from({ length: initialRows }, () => Array<CellFormat | undefined>(cols).fill(undefined));

    const [data, setData] = createStore({ cells: initialData, formats: initialFormats });

    const [colWidths, setColWidths] = createStore<number[]>(
        options.colWidths ?? Array(cols).fill(options.defaultColWidth ?? 96)
    );
    const [rowHeights, setRowHeights] = createStore<number[]>(
        options.rowHeights ?? Array(initialRows).fill(defaultRowHeight)
    );

    const [selection, setSelection] = createSignal<Selection>({
        mode: "cell",
        anchor: { row: 0, col: 0 },
        focus: { row: 0, col: 0 },
        range: { r1: 0, c1: 0, r2: 0, c2: 0 },
    });
    const [activeCell, setActiveCell] = createSignal<CellPos>({ row: 0, col: 0 });
    const [editingCell, setEditingCell] = createSignal<CellPos | null>(null);
    const [scroll, setScroll] = createSignal({ x: 0, y: 0 });

    const undoStack: Command[] = [];
    const redoStack: Command[] = [];
    const [historyVersion, setHistoryVersion] = createSignal(0);

    function pushCommand(cmd: Command) {
        undoStack.push(cmd);
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack.length = 0;
        setHistoryVersion((v) => v + 1);
    }

    function getCell(row: number, col: number): CellValue {
        return data.cells[row]?.[col] ?? null;
    }
    function getFormat(row: number, col: number): CellFormat | undefined {
        return data.formats[row]?.[col];
    }

    function applyEdits(edits: CellEdit[], useAfter: boolean) {
        setData(
            produce((d) => {
                // 同じセルへの編集が複数ある場合（ユーザー入力＋onChangeでの補完など）に
                // 正しく戻せるよう、Undo は逆順に適用する
                const list = useAfter ? edits : [...edits].reverse();
                for (const e of list) {
                    d.cells[e.row][e.col] = useAfter ? e.after : e.before;
                    if (tracksFormat(e)) {
                        d.formats[e.row][e.col] = useAfter ? e.afterFormat : e.beforeFormat;
                    }
                }
            })
        );
    }

    /** 単一セルの値を変更（undo対応）。戻り値は mergeCellEdits() に渡すトークン。
     * onChange で非同期に関連セルへ値を補完したい場合、この戻り値をとっておき
     * 補完が終わったタイミングで mergeCellEdits(token, ...) を呼ぶと、
     * この変更と同じUndo単位にまとめられる。 */
    function setCellValue(row: number, col: number, value: CellValue): EditToken {
        const before = getCell(row, col);
        if (before === value) return null;
        const edit: CellEdit = { row, col, before, after: value };
        applyEdits([edit], true);
        const cmd: Command = { kind: "cellEdit", label: "setCellValue", edits: [edit] };
        pushCommand(cmd);
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

        const isStillTop =
            token !== null &&
            redoStack.length === 0 &&
            undoStack.length > 0 &&
            undoStack[undoStack.length - 1] === token;

        const appended = expandIfNeeded(newEdits);
        if (isStillTop) {
            token!.edits.push(...newEdits);
            if (appended > 0) token!.appendedRows = (token!.appendedRows ?? 0) + appended;
            setHistoryVersion((v) => v + 1);
        } else {
            // token が無効（null／既に他の変更で上書きされた／Undo済み）な場合は
            // 独立した新しいコマンドとして積む（安全側へのフォールバック）
            const cmd: Command = { kind: "cellEdit", label: "mergedEdits", edits: newEdits };
            if (appended > 0) cmd.appendedRows = appended;
            pushCommand(cmd);
        }
    }

    /** 範囲に対して複数セルをまとめて変更（貼り付け・削除など、undo単位は1つ）。戻り値は mergeCellEdits() 用トークン。 */
    function setRangeValues(
        range: SelectionRange,
        valueAt: (row: number, col: number) => CellValue,
        opts?: { growRows?: boolean }
    ): EditToken {
        const edits: CellEdit[] = [];
        for (let r = range.r1; r <= range.r2; r++) {
            for (let c = range.c1; c <= range.c2; c++) {
                const before = getCell(r, c);
                const after = valueAt(r, c);
                if (before !== after) edits.push({ row: r, col: c, before, after });
            }
        }
        if (edits.length === 0) return null;
        // growRows 指定時は、現在の行数を超える行への書き込みに必要な分だけ、このコマンドの一部として行を追加する
        let appended = 0;
        if (opts?.growRows) {
            let maxRow = 0;
            for (const e of edits) if (e.row > maxRow) maxRow = e.row;
            const need = maxRow + 1 - rowCount();
            if (need > 0) appended += appendRows(need);
        }
        applyEdits(edits, true);
        const cmd: Command = { kind: "cellEdit", label: "setRangeValues", edits };
        pushCommand(cmd);
        appended += expandIfNeeded(edits);
        if (appended > 0) cmd.appendedRows = appended;
        return cmd;
    }

    /** 範囲の書式を変更（undo対応） */
    function setRangeFormat(range: SelectionRange, format: CellFormat) {
        const edits: CellEdit[] = [];
        for (let r = range.r1; r <= range.r2; r++) {
            for (let c = range.c1; c <= range.c2; c++) {
                const beforeFormat = getFormat(r, c);
                edits.push({
                    row: r,
                    col: c,
                    before: getCell(r, c),
                    after: getCell(r, c),
                    beforeFormat,
                    afterFormat: { ...beforeFormat, ...format },
                });
            }
        }
        applyEdits(edits, true);
        pushCommand({ kind: "cellEdit", label: "setRangeFormat", edits });
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
        for (let r = targetStart; r <= range.r2; r++) {
            for (let c = range.c1; c <= range.c2; c++) {
                const before = getCell(r, c);
                const beforeFormat = getFormat(r, c);
                const after = getCell(srcRow, c);
                const afterFormat = getFormat(srcRow, c);
                if (before === after && beforeFormat === afterFormat) continue;
                edits.push({ row: r, col: c, before, after, beforeFormat, afterFormat });
            }
        }
        if (edits.length === 0) return null;
        applyEdits(edits, true);
        const cmd: Command = { kind: "cellEdit", label: "fillDown", edits };
        pushCommand(cmd);
        const appended = expandIfNeeded(edits);
        if (appended > 0) cmd.appendedRows = appended;
        return cmd;
    }

    /**
     * データが入っている最も右の列・最も下の行を求める（Excelの Ctrl+End 相当の移動先）。
     * データが1つも無ければ (0, 0) を返す。
     */
    function findUsedRange(): { row: number; col: number } {
        let maxRow = 0;
        let maxCol = 0;
        for (let r = 0; r < rowCount(); r++) {
            for (let c = 0; c < cols; c++) {
                if (getCell(r, c) != null) {
                    if (r > maxRow) maxRow = r;
                    if (c > maxCol) maxCol = c;
                }
            }
        }
        return { row: maxRow, col: maxCol };
    }

    /** 列幅リサイズをUndo履歴に記録する（ドラッグ中の連続変更はこの1コマンドにまとめる） */
    function recordColumnWidthChange(col: number, before: number, after: number) {
        if (before === after) return;
        pushCommand({
            kind: "generic",
            label: "resizeColumn",
            undo: () => setColWidths(col, before),
            redo: () => setColWidths(col, after),
        });
    }

    function runCommand(cmd: Command, useAfter: boolean) {
        if (cmd.kind === "cellEdit") {
            const n = cmd.appendedRows ?? 0;
            if (useAfter) {
                // Redo: 先に行を再追加してから値を書き戻す
                if (n > 0) appendRows(n);
                applyEdits(cmd.edits, true);
            } else {
                // Undo: 値を戻してから、このコマンドで増えた行を取り除く
                applyEdits(cmd.edits, false);
                if (n > 0) removeLastRows(n);
            }
        } else if (useAfter) cmd.redo();
        else cmd.undo();
    }

    /** コマンドが影響したセル範囲を求める（列幅変更など、セルを伴わないコマンドは null） */
    function boundingRangeOfCommand(cmd: Command): SelectionRange | null {
        if (cmd.kind !== "cellEdit" || cmd.edits.length === 0) return null;
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

    function undo() {
        const cmd = undoStack.pop();
        if (!cmd) return;
        runCommand(cmd, false);
        redoStack.push(cmd);
        setHistoryVersion((v) => v + 1);
        const range = boundingRangeOfCommand(cmd);
        if (range) focusRange(range);
    }

    function redo() {
        const cmd = redoStack.pop();
        if (!cmd) return;
        runCommand(cmd, true);
        undoStack.push(cmd);
        setHistoryVersion((v) => v + 1);
        const range = boundingRangeOfCommand(cmd);
        if (range) focusRange(range);
    }

    function canUndo() {
        historyVersion();
        return undoStack.length > 0;
    }
    function canRedo() {
        historyVersion();
        return redoStack.length > 0;
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

    /**
     * 末尾に行を count 行追加する。行数・セル・書式・行の高さをまとめて更新する。
     * 手動で呼んだ場合は Undo 履歴には積まない（Undo しても残る）。
     * 最終行への入力・貼り付け等による自動追加（autoAppendRows）は、その操作と同じ Undo 単位に含まれる。
     * 戻り値は実際に追加した行数。
     */
    function appendRows(count: number): number {
        const n = Math.floor(count);
        if (n <= 0) return 0;
        batch(() => {
            const start = rowCount();
            setData(
                produce((d) => {
                    for (let i = 0; i < n; i++) {
                        d.cells[start + i] = Array<CellValue>(cols).fill(null);
                        d.formats[start + i] = Array<CellFormat | undefined>(cols).fill(undefined);
                    }
                })
            );
            for (let i = 0; i < n; i++) setRowHeights(start + i, defaultRowHeight);
            setRowCount(start + n);
        });
        return n;
    }

    /** 末尾から count 行取り除く（Undo 用。最低1行は残す） */
    function removeLastRows(count: number) {
        const n = Math.min(Math.floor(count), rowCount() - 1);
        if (n <= 0) return;
        batch(() => {
            const next = rowCount() - n;
            setData(
                produce((d) => {
                    d.cells.length = next;
                    d.formats.length = next;
                })
            );
            setRowHeights(
                produce((h) => {
                    h.length = next;
                })
            );
            setRowCount(next);
        });
    }

    /** 行数が minRows 以上になるまで行を追加する（すでに足りていれば何もしない） */
    function ensureRows(minRows: number) {
        const shortage = Math.ceil(minRows) - rowCount();
        if (shortage > 0) appendRows(shortage);
    }

    /** 最終行に値が入る変更なら、autoAppendRows 行を追加し、追加した行数を返す（書き込み系の処理から呼ぶ） */
    function expandIfNeeded(edits: CellEdit[]): number {
        if (autoAppendRows <= 0) return 0;
        const last = rowCount() - 1;
        if (edits.some((e) => e.row === last && e.after != null && e.after !== e.before)) return appendRows(autoAppendRows);
        return 0;
    }

    /** columnHeaderLabel/rowHeaderLabel は 関数 or 文字列配列 のどちらでも受け取れるので、内部用の関数に正規化する */
    function normalizeHeaderLabel(
        option: ((index: number) => string) | string[] | undefined,
        fallback: (index: number) => string
    ): (index: number) => string {
        if (option == null) return fallback;
        if (Array.isArray(option)) {
            return (index: number) => option[index] ?? fallback(index);
        }
        return option;
    }

    const columnHeaderLabel = normalizeHeaderLabel(options.columnHeaderLabel, defaultColumnHeaderLabel);
    const rowHeaderLabel = normalizeHeaderLabel(options.rowHeaderLabel, defaultRowHeaderLabel);

    /** データ全体を差し替える。行数・行高・履歴・選択状態もリセットする。 */
    function replaceData(newCells: CellValue[][], newFormats?: (CellFormat | undefined)[][]) {
        const n = Math.max(1, newCells.length);
        batch(() => {
            // 列数は固定なので、はみ出しは切り捨て・不足は null で埋める
            const cells = Array.from({ length: n }, (_, r) =>
                Array.from({ length: cols }, (_, c) => newCells[r]?.[c] ?? null)
            );
            const formats = Array.from({ length: n }, (_, r) =>
                Array.from({ length: cols }, (_, c) => newFormats?.[r]?.[c])
            );
            setData({ cells, formats }); // 配列は置き換えられる
            setRowHeights(
                produce((h) => {
                    const old = h.length;
                    h.length = n;
                    for (let i = old; i < n; i++) h[i] = defaultRowHeight;
                })
            );
            setRowCount(n);

            // 古い履歴は新しいデータと整合しないので破棄
            undoStack.length = 0;
            redoStack.length = 0;
            setHistoryVersion((v) => v + 1);

            setEditingCell(null);
            setActiveCell({ row: 0, col: 0 });
            setSelection({
                mode: "cell",
                anchor: { row: 0, col: 0 },
                focus: { row: 0, col: 0 },
                range: { r1: 0, c1: 0, r2: 0, c2: 0 },
            });
        });
        markClean();
    }

    /**
     * 行を compare の順に並べ替える（Undo/Redo対応・1操作）。
     * 値と書式を行ごと移動する。既定の対象は 0 行目〜データが入っている最終行。
     * ヘッダ行を除きたい場合は startRow を指定する。
     */
    function sortRows(
        compare: (a: CellValue[], b: CellValue[]) => number,
        opts?: { startRow?: number; endRow?: number; reformat?: SortReformat }
    ): EditToken {
        const raw = unwrap(data); // プロキシを介さない生データ
        const startRow = Math.max(0, opts?.startRow ?? 0);
        const endRow = Math.min(rowCount() - 1, opts?.endRow ?? findUsedRange().row);
        if (endRow - startRow < 1) return null;

        // order[i] = 「startRow + i 行目に来る元の行番号」。元の行番号で同順位を解決して安定ソートにする
        const order: number[] = [];
        for (let r = startRow; r <= endRow; r++) order.push(r);
        order.sort((a, b) => compare(raw.cells[a], raw.cells[b]) || a - b);

        // 適用前に差分をすべて計算する（途中で書き換えないので読み取りは常に元の状態）
        const edits: CellEdit[] = [];
        for (let i = 0; i < order.length; i++) {
            const dst = startRow + i;
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

        let cmd: EditToken = null;
        if (edits.length > 0) {
            applyEdits(edits, true);
            cmd = { kind: "cellEdit", label: "sortRows", edits };
            pushCommand(cmd);
        }

        // ソート後の状態を元に書式を再計算し、同じUndo単位にマージする。
        // 範囲の1つ下の行も対象にする（その行は「1つ上のセル」が変わるため）
        if (opts?.reformat) {
            const reformat = opts.reformat;
            const changes: CellChange[] = [];
            const lastRow = Math.min(rowCount() - 1, endRow + 1);
            for (let r = startRow; r <= lastRow; r++) {
                for (let c = 0; c < cols; c++) {
                    const format = reformat(r, c, { value: getCell(r, c), getCell, format: getFormat(r, c) });
                    if (format !== undefined) changes.push({ row: r, col: c, format });
                }
            }
            // cmd が null（ソートで並びが変わらなかった）場合は、書式変更だけが独立したコマンドになる
            const before = undoStack.length;
            mergeCellEdits(cmd, changes);
            if (cmd === null && undoStack.length > before) {
                const top = undoStack[undoStack.length - 1];
                if (top.kind === "cellEdit") cmd = top;
            }
        }
        return cmd;
    }

    const [dirtyCheckpoint, setDirtyCheckpoint] = createSignal<Command | null>(null);
    /**
     * 現在の状態を「変更なし（クリーン）」の基準としてマークする
     * （例：初期データ読み込み時や、サーバーへの保存成功時に呼ぶ）
     */
    function markClean() {
        const last = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
        setDirtyCheckpoint(last);
    }
    const isDirty = createMemo(() => {
        historyVersion();
        const currentLast = undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
        return currentLast !== dirtyCheckpoint();
    });

    return {
        markClean,
        isDirty,

        get rows() {
            return rowCount();
        },
        cols,
        autoAppendRows,
        data,
        colWidths,
        setColWidths,
        rowHeights,
        setRowHeights,
        headerHeight: options.headerHeight ?? 28,
        headerWidth: options.headerWidth ?? 48,
        columnHeaderLabel,
        rowHeaderLabel,
        replaceData,

        getCell,
        getFormat,
        setCellValue,
        mergeCellEdits,
        setRangeValues,
        setRangeFormat,
        clearRange,
        fillDown,
        findUsedRange,
        appendRows,
        sortRows,
        ensureRows,

        selection,
        setSelection,
        activeCell,
        setActiveCell,
        editingCell,
        setEditingCell,
        scroll,
        setScroll,
        focusRange,

        selectCell,
        selectColumn,
        selectRow,
        selectAll,

        undo,
        redo,
        canUndo,
        canRedo,
        recordColumnWidthChange,

        /** テスト・デバッグ用にstoreの生データを取得 */
        snapshot: () => unwrap(data),
    };
}

export type GridStore = ReturnType<typeof createGridStore>;
