/**
 * 【部品: store / 表示状態】
 * スクロール位置と、画面の分割（左右・上下の pane）の設定。いずれも「表示の設定」なので Undo の対象外。
 *
 * スクロールは pane ごとに独立していて、同じ軸を共有する pane は同じ値を使う（= 同期する）:
 *   x … 右 pane の横、y … 下 pane の縦、lx … 左 pane の横、ty … 上 pane の縦。
 *   分割しなければ x / y が表全体のスクロール量。
 * 分割の列数・行数は、実際の行数・列数に収まるよう createGridStore で丸めて公開する
 * （ここでは設定された値をそのまま持つ）。
 */
import { createSignal } from "solid-js";
import type { GridOptions, SplitMode, SplitOptions } from "../types";

export interface SplitState {
    /** "split" = pane ごとに独立してスクロール、"freeze" = 通常の固定（先頭の列・行はスクロールしない） */
    mode: SplitMode;
    cols: number;
    rows: number;
    /** 左 pane の表示幅(px)。undefined = 左 pane の列の合計幅 */
    leftWidth?: number;
    /** 上 pane の表示高さ(px)。undefined = 上 pane の行の合計高さ */
    topHeight?: number;
    resizable: boolean;
}

const count = (n: number | undefined) => Math.max(0, Math.floor(n ?? 0));
const size = (n: number | undefined) => (n === undefined ? undefined : Math.max(0, n));

export function createViewState(initial?: Pick<GridOptions, "split" | "frozenRows" | "frozenCols">) {
    const [scroll, setScrollState] = createSignal({ x: 0, y: 0, lx: 0, ty: 0 });
    /** lx / ty を省略した場合は、現在の値を保つ（分割を使わない呼び出し側は x, y だけ渡せばよい） */
    function setScroll(next: { x: number; y: number; lx?: number; ty?: number }) {
        setScrollState((prev) => ({ x: next.x, y: next.y, lx: next.lx ?? prev.lx, ty: next.ty ?? prev.ty }));
    }

    // split の指定が優先。無ければ frozenRows / frozenCols（通常の固定の省略記法）
    const initialSplit: SplitState = initial?.split
        ? {
              mode: initial.split.mode ?? "split",
              cols: count(initial.split.cols),
              rows: count(initial.split.rows),
              leftWidth: size(initial.split.leftWidth),
              topHeight: size(initial.split.topHeight),
              resizable: initial.split.resizable ?? true,
          }
        : { mode: initial?.frozenRows || initial?.frozenCols ? "freeze" : "split", cols: count(initial?.frozenCols), rows: count(initial?.frozenRows), resizable: true };
    const [split, setSplitState] = createSignal<SplitState>(initialSplit);

    /**
     * 分割の設定を変更する（Undo の対象外）。指定した項目だけが変わる。
     * leftWidth / topHeight に undefined を明示的に渡すと、「列（行）の合計」の既定サイズに戻る。
     */
    function setSplit(next: Partial<SplitOptions>) {
        setSplitState((prev) => {
            const s = { ...prev };
            if (next.mode !== undefined) s.mode = next.mode;
            if (next.cols !== undefined) s.cols = count(next.cols);
            if (next.rows !== undefined) s.rows = count(next.rows);
            if ("leftWidth" in next) s.leftWidth = size(next.leftWidth);
            if ("topHeight" in next) s.topHeight = size(next.topHeight);
            if (next.resizable !== undefined) s.resizable = next.resizable;
            return s;
        });
    }

    /** 通常の固定にする（先頭の rows 行・cols 列を固定。pane のサイズは既定に戻る）。`setSplit({ rows, cols, mode: "freeze" })` の省略記法 */
    function setFrozen(rows: number, cols: number) {
        setSplit({ rows, cols, mode: "freeze", leftWidth: undefined, topHeight: undefined });
    }

    return { scroll, setScroll, split, setSplit, setFrozen };
}

export type ViewState = ReturnType<typeof createViewState>;
