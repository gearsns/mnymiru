/**
 * 【部品: rendering / 共通の型】
 * 描画層が store から「読んでよいもの」を GridRenderSource として明示する。
 * 描画は読み取り専用。ここに無いもの（setXxx や編集操作）には触れない。
 */
import type { GridStore } from "../store/createGridStore";
import type { DropPosition, GridTheme } from "../types";
import type { Metrics, ScrollPosition, ViewLayout } from "../lib/geometry";

export type GridRenderSource = Pick<
  GridStore,
  | "rows"
  | "cols"
  | "colWidths"
  | "rowHeights"
  | "headerWidth"
  | "headerHeight"
  | "splitRows"
  | "splitCols"
  | "leftWidth"
  | "topHeight"
  | "splitMode"
  | "treeColumn"
  | "treeIndent"
  | "rowLevel"
  | "rowHasChildren"
  | "rowExpanded"
  | "dataRowOf"
  | "getCell"
  | "getFormat"
  | "scroll"
  | "selection"
  | "activeCell"
  | "editingCell"
  | "columnHeaderLabel"
  | "rowHeaderLabel"
>;

/** 行をドラッグしている間の表示内容（drawRowDrag が描く） */
export interface RowDragVisual {
  /** 移動元の行（表示行、両端を含む）。薄暗く表示する */
  sources: { r1: number; r2: number };
  /** ドロップ位置。ドロップできない位置にいるときは null（何も表示しない） */
  target: { row: number; position: DropPosition; level: number } | null;
}

/** 1回の描画で共有する情報（drawGrid が1度だけ作り、各 draw 関数へ渡す） */
export interface DrawFrame {
  ctx: CanvasRenderingContext2D;
  source: GridRenderSource;
  metrics: Metrics;
  theme: GridTheme;
  /** canvas の論理サイズ(px) */
  width: number;
  height: number;
  scroll: ScrollPosition;
  /** 描画すべき領域（左右・上下の pane）。drawGrid が1度だけ求める */
  view: ViewLayout;
  sel: ReturnType<GridRenderSource["selection"]>;
  active: ReturnType<GridRenderSource["activeCell"]>;
  editing: ReturnType<GridRenderSource["editingCell"]>;
}
