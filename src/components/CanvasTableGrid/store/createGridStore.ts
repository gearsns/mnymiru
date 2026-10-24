/**
 * 【部品: store / 組み立て】
 * store/ 内の各部品（データ・履歴・選択・表示・編集操作）を1つの GridStore にまとめる。
 * ここにロジックは置かない。新しい状態や操作は、まず該当の部品に足してからここで公開する。
 *
 *   gridData   ... 値・書式・行数・列幅・行高（データ行の座標）
 *   treeState  ... ツリーの階層・開閉状態
 *   rowModel   ... 表示行 ⇔ データ行の対応表（ツリーを使わなければ恒等）
 *   treeOps    ... 行の展開/折りたたみと、選択の付け替え
 *   history    ... Undo/Redo スタックと dirty
 *   selection  ... 選択範囲・アクティブセル・編集中セル
 *   view       ... スクロール位置・画面の分割（左右・上下の pane）
 *   edits      ... 履歴に積む編集操作（setCellValue, fillDown, sortRows など）
 *   undoRedo   ... 履歴のコマンドを実行して元に戻す/やり直す
 *
 * 公開する座標: 選択・スクロール・getCell/getFormat・rows などの「画面側」の API は表示行、
 * 履歴の CellEdit・mergeCellEdits・replaceData・snapshot は「データ行」（詳しくは rowModel.ts）。
 * ツリーを使わない場合、両者は常に同じ番号になる。
 */
import { batch } from "solid-js";
import { unwrap } from "solid-js/store";
import type { CellFormat, CellValue, DropPosition, GridOptions, RowMoveResult } from "../types";
import { defaultColumnHeaderLabel, defaultRowHeaderLabel, normalizeHeaderLabel } from "../format";
import { createGridData } from "./gridData";
import { createRowModel } from "./rowModel";
import { createTreeOps } from "./treeOps";
import { createTreeState } from "./treeState";
import { createHistory } from "./history";
import { createSelectionState } from "./selection";
import { createViewState } from "./view";
import { createEditOps } from "./edits";
import { createUndoRedo } from "./undoRedo";

export function createGridStore(options: GridOptions) {
    const tree = createTreeState(options);
    const grid = createGridData(options, { onAppend: tree.append, onTruncate: tree.truncate });
    const rows = createRowModel(grid, tree, options);
    const history = createHistory();
    const selection = createSelectionState(rows.visibleCount, grid.cols);
    const view = createViewState(options);
    // 分割の列数・行数は、スクロールする側に最低1列・1行が残るよう丸める
    const splitCols = () => Math.min(view.split().cols, Math.max(0, grid.cols - 1));
    // 上 pane の行数は「先頭 N **データ行**」のうち見えている行の数で数える。
    // ツリーを閉じても N 行目より後ろの行が上 pane に繰り上がってこない（表示行で数えると、閉じた分だけ下の行が入ってきてしまう）
    const splitRows = () => Math.min(rows.visibleCountUpTo(view.split().rows), Math.max(0, rows.visibleCount() - 1));
    /** 上 pane の行の合計高さ(px)。上 pane の高さ（topHeight）の既定値 */
    function defaultTopHeight(): number {
        const h = rows.rowHeights;
        let sum = 0;
        for (let i = 0, n = splitRows(); i < n; i++) sum += h[i];
        return sum;
    }

    /**
     * 分割の設定を変更する（Undo の対象外）。
     * 分割モードで上下に分割しているとき、topHeight は常に具体的な値（px）を持つ。
     * 省略・undefined のときや、rows を変えたときは「そのときの上 pane の行の合計高さ」で固定する。
     * （合計に追従させると、ツリーの開閉や行高の変更でバーが動いてしまう。サイズを変えるのはドラッグか topHeight の指定だけ）
     */
    function setSplit(next: Parameters<typeof view.setSplit>[0]) {
        view.setSplit(next);
        const s = view.split();
        // 上 pane に見える行がまだ無いとき（データが空など）は固定しない（topHeight の getter が合計高さを返す）
        if (s.mode === "split" && splitRows() > 0 && (s.topHeight === undefined || (next.rows !== undefined && !("topHeight" in next)))) {
            view.setSplit({ topHeight: defaultTopHeight() });
        }
    }
    // 初期状態も同様に固定する
    setSplit({});

    const edits = createEditOps({ data: grid, history, rows, tree });
    const { undo, redo } = createUndoRedo({ data: grid, history, selection, rows });
    const treeOps = createTreeOps({ rows, tree, selection });

    const columnHeaderLabel = normalizeHeaderLabel(options.columnHeaderLabel, defaultColumnHeaderLabel);
    const rowHeaderLabel = normalizeHeaderLabel(options.rowHeaderLabel, defaultRowHeaderLabel);

    /**
     * データ全体を差し替える。行数・行高・履歴・選択状態もリセットする。
     * ツリーの場合は treeLevels で各行の階層を指定する（省略するとすべてルート階層。開閉はすべて展開）。
     */
    function replaceData(newCells: CellValue[][], newFormats?: (CellFormat | undefined)[][], treeLevels?: number[]) {
        batch(() => {
            grid.replaceContents(newCells, newFormats);
            tree.reset(grid.rowCount(), treeLevels);
            // 古い履歴は新しいデータと整合しないので破棄
            history.clear();
            selection.reset();
        });
        history.markClean();
    }

    /**
     * 行を移動する（ドラッグ＆ドロップ相当。Undo/Redo 対応・1操作）。sourceRows・target.row は表示行。
     * ツリーでは子孫ごと移動し、階層は移動先に合わせて付け替わる（詳しくは lib/rowMove.ts）。
     * 移動後は、移動した行が行選択される。移動できない・動きがなければ null。
     */
    function moveRows(sourceRows: number[], target: { row: number; position: DropPosition }): RowMoveResult | null {
        const moved = edits.moveRows(sourceRows, target);
        if (!moved) return null;
        batch(() => {
            // 移動した行（見えているもの）を選択し直す
            const snap = rows.snapshotNow();
            const shown = moved.newIndices.map((d) => (rows.enabled ? (snap.displayOf[d] ?? -1) : d)).filter((r) => r >= 0);
            if (shown.length > 0) {
                const r1 = Math.min(...shown);
                const r2 = Math.max(...shown);
                selection.selectRow(r1);
                if (r2 > r1) selection.selectRow(r2, true);
            }
        });
        return moved.result;
    }

    return {
        markClean: history.markClean,
        isDirty: history.isDirty,

        /** 見えている行数（表示行の数）。ツリーでは折りたたまれた行を含まない */
        get rows() {
            return rows.visibleCount();
        },
        /** 全データ行の数（折りたたまれた行も含む）。ツリーでなければ rows と同じ */
        get totalRows() {
            return rows.totalRows();
        },
        cols: grid.cols,
        // ---- 画面の分割（左右・上下の pane。lib/geometry.ts の GridLayout がそのまま読む） ----
        /** 左 pane の列数（スクロールする側に最低1列残すよう、列数 - 1 までに丸める）。0 = 左右に分割しない */
        get splitCols() {
            return splitCols();
        },
        /** 上 pane の行数（表示行。先頭 N データ行のうち見えている行の数。見えている行数 - 1 までに丸める）。0 = 上下に分割しない */
        get splitRows() {
            return splitRows();
        },
        /** 動作モード。"split" = pane ごとに独立してスクロール、"freeze" = 通常の固定 */
        get splitMode() {
            return view.split().mode;
        },
        /** 左 pane の表示幅(px)。undefined = 左 pane の列の合計幅（固定モードでは常に undefined） */
        get leftWidth() {
            const s = view.split();
            return s.mode === "split" && splitCols() > 0 ? s.leftWidth : undefined;
        },
        /** 上 pane の表示高さ(px)。分割モードで上下に分割しているときは常に具体的な値（初期値・リセット時は上 pane の行の合計高さ）。固定モードでは常に undefined */
        get topHeight() {
            const s = view.split();
            if (s.mode !== "split" || splitRows() === 0) return undefined;
            return s.topHeight ?? defaultTopHeight();
        },
        /** 境界のバーをドラッグでサイズ変更できるか（固定モードでは常に false） */
        get splitResizable() {
            const s = view.split();
            return s.mode === "split" && s.resizable;
        },
        /** 分割・固定の設定を変更する（Undo の対象外）。leftWidth に undefined を渡すと左 pane の列の合計幅（追従）、topHeight に undefined を渡すとそのときの上 pane の行の合計高さ（固定）に戻る */
        setSplit,
        /** 通常の固定にする（先頭の rows 行・cols 列を固定）。`setSplit({ rows, cols, mode: "freeze" })` の省略記法 */
        setFrozen: view.setFrozen,
        autoAppendRows: grid.autoAppendRows,
        data: grid.data,
        colWidths: grid.colWidths,
        setColWidths: grid.setColWidths,
        /** 表示行ごとの行の高さ */
        get rowHeights() {
            return rows.rowHeights;
        },
        /** データ行ごとの行の高さを設定する（引数の行はデータ行） */
        setRowHeights: grid.setRowHeights,
        headerHeight: options.headerHeight ?? 28,
        headerWidth: options.headerWidth ?? 48,
        columnHeaderLabel,
        rowHeaderLabel,
        replaceData,

        /** 表示行のセルの値 */
        getCell: (row: number, col: number) => grid.getCell(rows.dataRow(row), col),
        /** 表示行のセルの書式 */
        getFormat: (row: number, col: number) => grid.getFormat(rows.dataRow(row), col),
        /** データ行のセルの値（onChange で受け取った行の値を読むときなどに使う） */
        getDataCell: grid.getCell,
        setCellValue: edits.setCellValue,
        mergeCellEdits: edits.mergeCellEdits,
        setRangeValues: edits.setRangeValues,
        setRangeFormat: edits.setRangeFormat,
        clearRange: edits.clearRange,
        fillDown: edits.fillDown,
        findUsedRange: rows.findUsedRange,
        appendRows: grid.appendRows,
        sortRows: edits.sortRows,
        moveRows,
        /** 移動できるか確認する（動かさない）。ドラッグ中のドロップ先の判定に使う。できなければ null */
        previewMoveRows: edits.previewMoveRows,
        ensureRows: grid.ensureRows,

        selection: selection.selection,
        setSelection: selection.setSelection,
        activeCell: selection.activeCell,
        setActiveCell: selection.setActiveCell,
        editingCell: selection.editingCell,
        setEditingCell: selection.setEditingCell,
        scroll: view.scroll,
        setScroll: view.setScroll,
        focusRange: selection.focusRange,

        // ---- ツリー（ツリーを使わない場合、treeEnabled は false で、各関数は何もしない/既定値を返す） ----
        treeEnabled: rows.enabled,
        /** 開閉アイコン・インデントを表示する列（ツリーでなければ -1） */
        treeColumn: rows.column,
        treeIndent: rows.indent,
        /** 表示行 → データ行 */
        dataRowOf: rows.dataRow,
        /** データ行 → 表示行（折りたたまれて見えていなければ -1） */
        displayRowOf: rows.displayRow,
        /** 表示行の階層の深さ（0 = ルート） */
        rowLevel: rows.level,
        /** 表示行が子を持つか */
        rowHasChildren: rows.hasChildren,
        /** 表示行が展開されているか（子のない行は false） */
        rowExpanded: rows.isExpanded,
        /** 表示行の親の表示行（ルートなら -1） */
        parentRow: rows.parentRow,
        toggleRow: treeOps.toggle,
        setRowExpanded: treeOps.setExpanded,
        expandAll: treeOps.expandAll,
        collapseAll: treeOps.collapseAll,
        /** 階層・開閉が変わるたびに増える（行の位置に依存する表示を消すために購読する） */
        treeVersion: tree.version,

        selectCell: selection.selectCell,
        selectColumn: selection.selectColumn,
        selectRow: selection.selectRow,
        selectAll: selection.selectAll,

        undo,
        redo,
        canUndo: history.canUndo,
        canRedo: history.canRedo,

        /** テスト・デバッグ用にstoreの生データを取得 */
        snapshot: () => unwrap(grid.data),
    };
}

export type GridStore = ReturnType<typeof createGridStore>;
export type { CellEdit, CellChange, EditToken, SortReformat, SortReformatContext } from "./types";
