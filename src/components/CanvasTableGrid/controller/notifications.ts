/**
 * 【部品: controller / 親への通知】
 * 内部状態の変化を、親コンポーネントのコールバックへ伝える。
 *   onSelectionChange ... 選択範囲が変わるたび
 *   onRowsChange      ... 行数（データ行の数。折りたたまれた行も含む）が変わったとき（初回は通知しない）
 * （onBusyChange は changeRunner.ts、onActiveCellChange は navigation.ts / pointer.ts にある）
 */
import { createEffect } from "solid-js";
import type { GridContext } from "./context";

export function bindParentNotifications(ctx: GridContext) {
    const { props, store } = ctx;

    createEffect(() => {
        // store.selection() を購読し、範囲が変わるたびに発火させる
        const selection = store.selection();
        if (selection) {
            props.onSelectionChange?.(store.selection().range);
        }
    });

    // 行数の変化を親コンポーネントへ通知（初回は通知しない）
    let lastNotifiedRows = store.totalRows;
    createEffect(() => {
        const rows = store.totalRows;
        if (rows !== lastNotifiedRows) {
            lastNotifiedRows = rows;
            props.onRowsChange?.(rows);
        }
    });
}
