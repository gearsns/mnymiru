/**
 * 【部品: store / 行モデル（表示行 ⇔ データ行）】
 * 画面に見えている行（表示行）と、実データの行（データ行）の対応表。
 *
 *   表示行 … 今見えている行の通し番号。選択・スクロール・描画・キー操作は、すべてこの座標を使う
 *   データ行 … gridData に入っている行の番号。履歴(Undo)・onChange・replaceData はこの座標を使う
 *
 * ツリーを使わない場合は表示行 = データ行（恒等写像）で、従来と完全に同じ動きになる。
 * ツリーを使う場合は、折りたたまれた行の子孫が表示行から外れる。
 * 座標の変換は store の境界（このモジュールを使う store 内の各部品）だけで行い、
 * 描画や controller は表示行だけを知っていればよい。
 */
import { createMemo } from "solid-js";
import { computeVisibleRows, DEFAULT_TREE_INDENT, hasChildren, parentOf, subtreeEnd } from "../lib/tree";
import type { GridOptions, SelectionRange } from "../types";
import type { GridData } from "./gridData";
import type { TreeState } from "./treeState";

export function createRowModel(grid: GridData, tree: TreeState, options: GridOptions) {
    const enabled = tree.enabled;
    /** ツリーの開閉アイコン・インデントを表示する列（ツリー無効時は -1） */
    const column = enabled ? Math.max(0, Math.min(options.tree?.column ?? 0, grid.cols - 1)) : -1;
    const indent = options.tree?.indent ?? DEFAULT_TREE_INDENT;

    /** 見えている行（データ行の番号）を表示順に並べたもの */
    const visible = createMemo(() => (enabled ? computeVisibleRows(tree.levels(), tree.expanded()) : []));
    /** データ行 → 表示行（隠れている行は -1） */
    const displayOf = createMemo(() => {
        if (!enabled) return [] as number[];
        const map = new Array<number>(tree.levels().length).fill(-1);
        visible().forEach((d, i) => (map[d] = i));
        return map;
    });
    /** 表示行ごとの行の高さ（データ行の高さを表示順に並べ替えたもの） */
    const heights = createMemo(() => (enabled ? visible().map((d) => grid.rowHeights[d]) : []));

    /** 見えている行数 */
    function visibleCount(): number {
        return enabled ? visible().length : grid.rowCount();
    }

    /**
     * 先頭 dataLimit 個のデータ行（データ行 0 〜 dataLimit-1）のうち、見えている行の数。
     * 画面の分割・固定で「先頭 N 行」をデータ行で数えるのに使う（ツリーを閉じても、N 行目より後ろの行が pane に入ってこない）。
     * 見えている行はデータ行の昇順に並んでいるので、二分探索で求める。ツリー無効時は min(dataLimit, 行数)。
     */
    function visibleCountUpTo(dataLimit: number): number {
        if (!enabled) return Math.max(0, Math.min(dataLimit, grid.rowCount()));
        const v = visible();
        let lo = 0;
        let hi = v.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (v[mid] < dataLimit) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    /**
     * 表示行 → データ行。
     * 表示行が見えている行数を超えている場合は、「末尾に追加される行」とみなして、
     * 追加後に対応するデータ行番号を返す（貼り付けで行が増える場合などに使う）。
     */
    function dataRow(row: number): number {
        const n = visibleCount();
        if (row >= n) return grid.rowCount() + (row - n);
        return enabled ? visible()[row] : row;
    }

    /** データ行 → 表示行（隠れていれば -1） */
    function displayRow(data: number): number {
        if (!enabled) return data >= 0 && data < grid.rowCount() ? data : -1;
        return displayOf()[data] ?? -1;
    }

    /** 見えている最後の行のデータ行番号（最終行への入力で行を自動追加するかの判定に使う） */
    function lastVisibleDataRow(): number {
        return dataRow(visibleCount() - 1);
    }

    // ---- 行の性質（引数はすべて表示行） ----
    function level(row: number): number {
        return enabled ? (tree.levels()[dataRow(row)] ?? 0) : 0;
    }
    function rowHasChildren(row: number): boolean {
        return enabled && hasChildren(tree.levels(), dataRow(row));
    }
    /** 子を持ち、かつ展開されているか（子のない行は false） */
    function isExpanded(row: number): boolean {
        return rowHasChildren(row) && !!tree.expanded()[dataRow(row)];
    }
    /** 親の表示行（ルートなら -1） */
    function parentRow(row: number): number {
        if (!enabled) return -1;
        const p = parentOf(tree.levels(), dataRow(row));
        return p < 0 ? -1 : displayRow(p);
    }
    /** データ行 d の子孫の最後のデータ行（ツリー無効時は d 自身） */
    function lastDescendant(d: number): number {
        return enabled ? subtreeEnd(tree.levels(), d) : d;
    }

    /**
     * 見えている行のうち、データが入っている最も下の行・最も右の列（Ctrl+End の移動先）。
     * 何も入っていなければ (0, 0)。
     */
    function findUsedRange(): { row: number; col: number } {
        let maxRow = 0;
        let maxCol = 0;
        const n = visibleCount();
        for (let r = 0; r < n; r++) {
            const d = dataRow(r);
            for (let c = 0; c < grid.cols; c++) {
                if (grid.getCell(d, c) != null) {
                    if (r > maxRow) maxRow = r;
                    if (c > maxCol) maxCol = c;
                }
            }
        }
        return { row: maxRow, col: maxCol };
    }

    /**
     * 最新の状態から（メモの更新を待たずに）対応表を作る。
     * batch の途中で、構造を変えた直後の表示行を知りたいときに使う。
     */
    function snapshotNow(): { visible: number[]; displayOf: number[] } {
        if (!enabled) return { visible: [], displayOf: [] };
        const vis = computeVisibleRows(tree.levels(), tree.expanded());
        const map = new Array<number>(tree.levels().length).fill(-1);
        vis.forEach((d, i) => (map[d] = i));
        return { visible: vis, displayOf: map };
    }

    /**
     * データ行 d が隠れていれば、見えている最も近い祖先（なければ自身）の表示行を返す。
     * snap は snapshotNow() の結果。
     */
    function nearestVisible(d: number, snap: { displayOf: number[] }): number {
        let cur = d;
        while (cur >= 0 && (snap.displayOf[cur] ?? -1) < 0) cur = parentOf(tree.levels(), cur);
        return cur < 0 ? 0 : snap.displayOf[cur];
    }

    /**
     * データ行の範囲を表示行の範囲に直す（Undo/Redo 後に、影響した範囲へ選択を移すため）。
     * 隠れている行があれば、祖先を展開して見えるようにする。ツリー無効時はそのまま返す。
     */
    function revealRange(range: SelectionRange): SelectionRange {
        if (!enabled) return range;
        tree.expandAncestors(range.r1);
        tree.expandAncestors(range.r2);
        const snap = snapshotNow();
        const last = Math.max(0, snap.visible.length - 1);
        const clampRow = (d: number) => Math.min(Math.max(0, snap.displayOf[d] ?? last), last);
        return { ...range, r1: clampRow(range.r1), r2: clampRow(range.r2) };
    }

    return {
        enabled,
        column,
        indent,
        /** 全データ行の数（折りたたまれた行も含む） */
        totalRows: () => grid.rowCount(),
        visibleCount,
        visibleCountUpTo,
        dataRow,
        displayRow,
        lastVisibleDataRow,
        get rowHeights(): ArrayLike<number> {
            return enabled ? heights() : grid.rowHeights;
        },
        level,
        hasChildren: rowHasChildren,
        isExpanded,
        parentRow,
        lastDescendant,
        findUsedRange,
        snapshotNow,
        nearestVisible,
        revealRange,
    };
}

export type RowModel = ReturnType<typeof createRowModel>;
