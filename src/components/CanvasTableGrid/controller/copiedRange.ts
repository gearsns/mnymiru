/**
 * 【部品: controller / コピー枠の状態】
 * コピー（切り取り）した範囲を点線で表示するための状態。
 * データが丸ごと差し替わったり、行が減って範囲外になったら自動で消す。
 */
import { createEffect, createSignal, untrack } from "solid-js";
import type { SelectionRange } from "../types";
import type { GridContext } from "./context";

export function createCopiedRange(ctx: GridContext) {
    const { store } = ctx;
    const [copiedRange, setCopiedRange] = createSignal<SelectionRange | null>(null);

    // data.cells の参照が変わった（= replaceData が呼ばれた）場合にcopiedRangeをクリアする
    let lastCellsRef = store.data.cells;
    createEffect(() => {
        const currentCells = store.data.cells;
        if (currentCells !== lastCellsRef) {
            lastCellsRef = currentCells;
            setCopiedRange(null); // データが丸ごと置き換わったのでコピー枠をクリア
        }
    });

    // ツリーの開閉・ソートなどで行の並びが変わったら、行の位置を指しているコピー枠は意味を失うので消す
    let lastTreeVersion = store.treeVersion();
    createEffect(() => {
        const v = store.treeVersion();
        if (v !== lastTreeVersion) {
            lastTreeVersion = v;
            setCopiedRange(null);
        }
    });

    // 行数が減った（Undo で自動追加行が取り除かれた）とき、コピー枠が範囲外にならないようにする
    createEffect(() => {
        const rows = store.rows;
        const cr = untrack(copiedRange);
        if (cr && cr.r2 >= rows) setCopiedRange(null);
    });

    return { copiedRange, setCopiedRange };
}

export type CopiedRange = ReturnType<typeof createCopiedRange>;
