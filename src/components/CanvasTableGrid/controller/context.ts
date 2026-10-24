/**
 * 【部品: controller / 共有コンテキスト】
 * controller の各部品が受け取る「共通の道具箱」。
 * store（状態）・theme・props・DOM 要素（JSX の ref で後から埋まる）をまとめただけで、ロジックは無い。
 *
 * ※ els.root / els.canvas / els.input は、コンポーネントの JSX が作られた後（effect・イベント内）
 *   でのみ使える。部品の初期化中（createXxx の直下）では触らないこと。
 */
import { createGridStore, type GridStore } from "../store/createGridStore";
import { defaultTheme } from "../rendering/theme";
import type { GridTheme } from "../types";
import type { CanvasTableGridProps } from "./props";

export interface GridElements {
    root: HTMLDivElement;
    canvas: HTMLCanvasElement;
    input: HTMLInputElement;
}

export interface GridContext {
    props: CanvasTableGridProps;
    store: GridStore;
    theme: GridTheme;
    els: GridElements;
}

export function createGridContext(props: CanvasTableGridProps): GridContext {
    const store = createGridStore(props.options);
    props.refStore?.(store);
    const theme: GridTheme = { ...defaultTheme, ...props.theme };
    return { props, store, theme, els: {} as GridElements };
}
