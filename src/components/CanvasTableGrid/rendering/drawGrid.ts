/**
 * 【部品: rendering / 組み立て】
 * グリッド全体を canvas に描画する。ここは「順番を決めるだけ」で、中身は各部品に任せる。
 *
 *   drawCells     ... 1つの領域のセル（セルの描画は CellRenderer、罫線もここ）
 *   drawOverlays  ... 選択枠・コピー枠・アクティブセル枠
 *   drawRowDrag   ... 行ドラッグ中の、移動元の暗転とドロップ位置
 *   drawHeaders   ... 列ヘッダ・行ヘッダ・左上コーナー
 *   drawFreezeLines ... 固定モードの境界線（ヘッダにも重ねるので、drawHeaders の後。
 *                       分割モードのバーは、スクロールバーの後に renderer が重ねる）
 *
 * 座標計算（どのセルがどこに来るか等）は `../lib/geometry` の純粋関数に委譲し、
 * ここでは実際の描画（canvas API呼び出し）のみを行う。
 */
import type { CellFormatProvider, GridTheme, SelectionRange } from "../types";
import { computeViewLayout, type Metrics } from "../lib/geometry";
import { defaultTheme } from "./theme";
import { baseFont, defaultCellRenderer, type CellRenderer } from "./cellRenderer";
import { drawCells } from "./drawCells";
import { drawOverlays } from "./drawOverlays";
import { drawHeaders } from "./drawHeaders";
import { drawFreezeLines } from "./drawSplitBars";
import { drawRowDrag } from "./drawRowDrag";
import type { DrawFrame, GridRenderSource, RowDragVisual } from "./types";

export interface DrawOptions {
  width: number;
  height: number;
  dpr: number;
  theme?: GridTheme;
  /** コピー中の範囲（点線＝マーチングアンツで表示） */
  copiedRange?: SelectionRange | null;
  /** セルの書式を動的に決定するコールバック（例：1つ上と同じ値なら罫線を消す、など） */
  getCellFormat?: CellFormatProvider;
  /** セル1つの描き方。省略時は標準（背景＋テキスト）。全セルに対して呼ばれる。差し替えポイント */
  cellRenderer?: CellRenderer;
  /** 行をドラッグしている間の表示（なければ通常の描画） */
  rowDrag?: RowDragVisual | null;
}

export function drawGrid(ctx: CanvasRenderingContext2D, store: GridRenderSource, metrics: Metrics, opts: DrawOptions) {
  const theme = opts.theme ?? defaultTheme;
  const { width, height, dpr } = opts;
  const scroll = store.scroll();

  const frame: DrawFrame = {
    ctx,
    source: store,
    metrics,
    theme,
    width,
    height,
    scroll,
    view: computeViewLayout(store, metrics, scroll, { width, height }),
    sel: store.selection(),
    active: store.activeCell(),
    editing: store.editingCell(),
  };

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.font = baseFont(theme);
  ctx.textBaseline = "middle";

  // --- セル領域（領域ごとに、ヘッダ・他の領域にはみ出さないようクリップして描く） ---
  // 分割していなければ領域は1つだけ（表全体）。分割している場合は先頭が右下の pane。
  for (const pane of frame.view.panes) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.clip.x, pane.clip.y, pane.clip.w, pane.clip.h);
    ctx.clip();
    drawCells(frame, pane, {
      cellRenderer: opts.cellRenderer ?? defaultCellRenderer,
      getCellFormat: opts.getCellFormat,
      isolate: opts.cellRenderer !== undefined, // 独自レンダラーだけ、はみ出し・状態の乱れ・例外から守る
    });
    drawOverlays(frame, pane, opts.copiedRange);
    drawRowDrag(frame, pane, opts.rowDrag);
    ctx.restore(); // クリップ解除
  }

  drawHeaders(frame);
  drawFreezeLines(frame); // ヘッダの上にも線を通すため、ヘッダの後に描く

  ctx.restore();
}
