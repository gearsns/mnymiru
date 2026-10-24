/**
 * 【部品: controller / onChange の実行とロック】
 * ユーザー操作で値が変わったとき props.onChange を呼び、完了（Promise の解決）まで
 * 編集系の操作をロックする。読み取り専用(readOnly)の判定もここ。
 *
 * 編集系の操作（入力・貼り付け・削除・Undo など）は、必ず locked() を見て始めること。
 */
import { createEffect, createSignal } from "solid-js";
import type { CellValue } from "../types";
import type { EditToken } from "../store/createGridStore";
import type { GridContext } from "./context";

export function createChangeRunner(ctx: GridContext, requestRender: () => void) {
    const { props, store } = ctx;
    const [pendingCount, setPendingCount] = createSignal(0);
    /** true の間は onChange の処理待ち。編集系の操作をすべて禁止する。 */
    const busy = () => pendingCount() > 0;
    /** 編集系の操作を受け付けない状態（onChange 処理中 または 読み取り専用） */
    const locked = () => busy() || !!props.readOnly;

    /**
     * onChange を実行する（await して完了を待つ）。
     * 呼び出し元となる編集操作（beginEdit・handlePaste・handleCut・Undo/Redo等）は
     * すべて busy() を見て新しい編集の開始を止めているため、この関数の実行中に
     * 別の onChange が呼ばれることはない。キューで直列化しなくても、
     * 「busyの間は次の編集を始められない」というロックだけで結果的に直列になる。
     */
    async function runOnChange(row: number, col: number, value: CellValue, token: EditToken) {
        if (!props.onChange) return;
        setPendingCount((n) => n + 1);
        try {
            await props.onChange(row, col, value, {
                edits: token?.edits,
                mergeEdits: (changes) => store.mergeCellEdits(token, changes),
            });
        } catch (err) {
            console.error("[canvas-table-grid] onChange でエラーが発生しました:", err);
        } finally {
            setPendingCount((n) => Math.max(0, n - 1));
            requestRender();
        }
    }

    // busy の変化を親コンポーネントへ通知
    createEffect(() => {
        props.onBusyChange?.(busy());
    });

    return { busy, locked, runOnChange };
}

export type ChangeRunner = ReturnType<typeof createChangeRunner>;
