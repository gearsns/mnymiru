/**
 * 【部品: store / データ本体】
 * セルの値・書式・行数・列幅・行高という「表そのもの」の保持と、素朴な読み書き。
 * 履歴（Undo）や選択状態は知らない。履歴に積むのは edits.ts の役割。
 *
 * （将来ツリーグリッドを入れるときは、ここの「行」の扱い＝表示行と実データ行の対応を
 *  拡張する。docs は ARCHITECTURE.md の「ツリーグリッド」を参照。）
 */
import { batch, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { CellFormat, CellValue, GridOptions } from "../types";
import type { CellEdit } from "./types";

/** この編集が書式の変更を含むか（含まない編集は Undo/Redo 時に書式に触らない） */
function tracksFormat(e: CellEdit): boolean {
    return e.beforeFormat !== undefined || e.afterFormat !== undefined;
}

/** 行の増減を、行ごとの付随情報（ツリーの階層など）を持つ部品へ知らせるためのフック */
export interface RowHooks {
    /** 末尾に n 行追加された */
    onAppend?: (n: number) => void;
    /** 行数が count に減った */
    onTruncate?: (count: number) => void;
}

export function createGridData(options: GridOptions, hooks?: RowHooks) {
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
            hooks?.onAppend?.(n);
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
            hooks?.onTruncate?.(next);
        });
    }

    /** 行 start から始まる範囲の行の高さを丸ごと置き換える（行の移動の Undo/Redo 用） */
    function patchRowHeights(start: number, heights: number[]) {
        setRowHeights(
            produce((h) => {
                heights.forEach((v, i) => (h[start + i] = v));
            })
        );
    }

    /** 行数が minRows 以上になるまで行を追加する（すでに足りていれば何もしない） */
    function ensureRows(minRows: number) {
        const shortage = Math.ceil(minRows) - rowCount();
        if (shortage > 0) appendRows(shortage);
    }

    /**
     * 最終行に値が入る変更なら、autoAppendRows 行を追加し、追加した行数を返す（書き込み系の処理から呼ぶ）。
     * lastRow は「最終行」とみなすデータ行（既定は最後のデータ行。ツリーでは見えている最後の行を渡す）。
     */
    function expandIfNeeded(edits: CellEdit[], lastRow?: number): number {
        if (autoAppendRows <= 0) return 0;
        const last = lastRow ?? rowCount() - 1;
        if (edits.some((e) => e.row === last && e.after != null && e.after !== e.before)) return appendRows(autoAppendRows);
        return 0;
    }

    /** セル・書式・行高・行数を丸ごと差し替える（履歴・選択のリセットは呼び出し側の仕事） */
    function replaceContents(newCells: CellValue[][], newFormats?: (CellFormat | undefined)[][]) {
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
        });
    }

    return {
        cols,
        autoAppendRows,
        rowCount,
        data,
        colWidths,
        setColWidths,
        rowHeights,
        setRowHeights,
        patchRowHeights,
        getCell,
        getFormat,
        applyEdits,
        appendRows,
        removeLastRows,
        ensureRows,
        expandIfNeeded,
        replaceContents,
    };
}

export type GridData = ReturnType<typeof createGridData>;
