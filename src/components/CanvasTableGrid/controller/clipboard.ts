/**
 * 【部品: controller / クリップボード】
 * コピー・切り取り・貼り付けのイベント処理。テキストの変換や貼り付け範囲の計算は
 * lib/clipboard.ts の純粋関数に任せる。
 */
import { buildClipboardText, computePasteRange, parseClipboardText } from "../lib/clipboard";
import { coerceValue } from "../lib/coerceValue";
import type { EditToken } from "../store/createGridStore";
import type { ChangeRunner } from "./changeRunner";
import type { GridContext } from "./context";
import type { CopiedRange } from "./copiedRange";
import type { Viewport } from "./viewport";

export function createClipboard(
    ctx: GridContext,
    deps: { viewport: Viewport; changes: ChangeRunner; copied: CopiedRange; requestRender: () => void }
) {
    const { props, store } = ctx;
    const { viewport, changes, copied, requestRender } = deps;
    const { busy, locked, runOnChange } = changes;
    const { setCopiedRange } = copied;

    function cellRawText(row: number, col: number): string {
        const v = store.getCell(row, col);
        return v == null ? "" : String(v);
    }

    function handleCopy(e: ClipboardEvent) {
        if (store.editingCell()) return; // 編集中は通常のテキストコピーに任せる
        e.preventDefault();
        const range = store.selection().range;
        e.clipboardData?.setData("text/plain", buildClipboardText(range, cellRawText));
        setCopiedRange(range);
    }

    function handleCut(e: ClipboardEvent) {
        if (store.editingCell()) return;
        e.preventDefault();
        if (locked()) {
            // 読み取り専用のときは切り取りをコピーとして扱う（値は消さない）。onChange 処理中は何もしない
            if (props.readOnly && !busy()) {
                const range = store.selection().range;
                e.clipboardData?.setData("text/plain", buildClipboardText(range, cellRawText));
                setCopiedRange(range);
            }
            return;
        }
        const range = store.selection().range;
        e.clipboardData?.setData("text/plain", buildClipboardText(range, cellRawText));
        store.clearRange(range);
        setCopiedRange(range);
    }

    function handlePaste(e: ClipboardEvent) {
        if (store.editingCell()) return; // 編集中は通常のテキストペーストに任せる
        e.preventDefault();
        if (locked()) return; // onChange 処理中は変更操作を禁止
        const text = e.clipboardData?.getData("text/plain") ?? "";
        if (!text) return;
        const parsed = parseClipboardText(text);
        if (parsed.length === 0 || parsed[0].length === 0) return;

        const pastedRows = parsed.length;
        const pastedCols = Math.max(1, ...parsed.map((r) => r.length));

        const currentSelection = store.selection();
        const selRange = currentSelection.range;

        // 単一セル選択か複数セル選択かを判定
        const isSingleCellSelected = selRange.r1 === selRange.r2 && selRange.c1 === selRange.c2;

        const start = { row: store.selection().range.r1, col: store.selection().range.c1 };
        // autoAppendRows 有効時は、貼り付け内容が現在の行数を超えても行を足して全部貼る（行追加も貼り付けと同じUndo単位）
        let range: { r1: number; c1: number; r2: number; c2: number };
        let growRows = false;

        if (isSingleCellSelected) {
            // 単一セル選択時は従来の動作（貼り付けデータのサイズに応じて決定、autoAppendRowsの対象）
            growRows = store.autoAppendRows > 0;
            range = computePasteRange({
                start,
                pastedRows,
                pastedCols,
                totalRows: store.rows,
                totalCols: store.cols,
                growRows,
            });
        } else {
            // 複数セル選択時は現在の選択範囲をそのまま利用（リピート貼り付け）
            range = selRange;
        }


        const { r2: endRow, c2: endCol } = range;

        const token: EditToken = store.setRangeValues(range, (r, c) => {
            // 貼り付け元データを繰り返し配置するために剰余 (%) を計算
            const rowOffset = (r - start.row) % pastedRows;
            const colOffset = (c - start.col) % pastedCols;

            const raw = parsed[rowOffset]?.[colOffset];
            if (raw === undefined) return store.getCell(r, c);
            return coerceValue(raw, store.getFormat(r, c));
        }, { growRows });

        void runOnChange(store.dataRowOf(start.row), start.col, store.getCell(start.row, start.col), token);

        store.setActiveCell(start);
        store.setSelection({ mode: "cell", anchor: start, focus: { row: endRow, col: endCol }, range });
        setCopiedRange(null);
        viewport.ensureVisible(start.row, start.col);
        requestRender();
    }

    return { handleCopy, handleCut, handlePaste };
}

export type Clipboard = ReturnType<typeof createClipboard>;
