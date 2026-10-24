/**
 * 【部品: controller / 行ドラッグの表示状態】
 * 行をドラッグしている間の表示内容（rendering/drawRowDrag が読む）を持つだけの signal。
 * ドラッグの操作そのものは rowDrag.ts が担当し、ここへ書き込む。
 */
import { createSignal } from "solid-js";
import type { RowDragVisual } from "../rendering/types";

export function createRowDragState() {
    const [dragState, setDragState] = createSignal<RowDragVisual | null>(null);
    return { dragState, setDragState };
}

export type RowDragState = ReturnType<typeof createRowDragState>;
