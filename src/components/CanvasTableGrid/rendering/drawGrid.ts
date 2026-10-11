import type { GridStore } from "../GridStore";
import type { CellFormat, CellFormatProvider, GridTheme, SelectionRange } from "../types";
import { defaultAlign, formatCellValue } from "../format";
import { TEXT_PADDING, findFirstVisible, inRange, type Metrics } from "../lib/geometry";

export const defaultTheme: GridTheme = {
  fontFamily: '"Yu Gothic", "Hiragino Kaku Gothic ProN", "Segoe UI", sans-serif',
  fontSize: 13,
  textColor: "#1f2328",
  gridLineColor: "#e1e4e8",
  headerBackground: "#f5f6f8",
  headerTextColor: "#57606a",
  headerActiveBackground: "#c8d6f5",
  cellBackground: "#ffffff",
  activeCellBorderColor: "#3068e0",
  selectionFill: "rgba(48, 104, 224, 0.12)",
  selectionBorderColor: "#3068e0",
  scrollbarTrackColor: "rgba(0, 0, 0, 0.06)",
  scrollbarThumbColor: "rgba(0, 0, 0, 0.28)",
};

export interface DrawOptions {
  width: number;
  height: number;
  dpr: number;
  theme?: GridTheme;
  /** コピー中の範囲（点線＝マーチングアンツで表示） */
  copiedRange?: SelectionRange | null;
  /** セルの書式を動的に決定するコールバック（例：1つ上と同じ値なら罫線を消す、など） */
  getCellFormat?: CellFormatProvider;
}

/**
 * グリッド全体を canvas に描画する。座標計算（どのセルがどこに来るか等）は
 * `../lib/geometry` の純粋関数に委譲し、ここでは実際の描画（canvas API呼び出し）のみを行う。
 */
export function drawGrid(ctx: CanvasRenderingContext2D, store: GridStore, metrics: Metrics, opts: DrawOptions) {
  const theme = opts.theme ?? defaultTheme;
  const { width, height, dpr } = opts;
  const { headerWidth, headerHeight } = store;
  const { x: scrollX, y: scrollY } = store.scroll();
  const sel = store.selection();
  const active = store.activeCell();
  const editing = store.editingCell();

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.font = `${theme.fontSize}px ${theme.fontFamily}`;
  ctx.textBaseline = "middle";

  const firstCol = findFirstVisible(metrics.colOffsets, scrollX);
  const firstRow = findFirstVisible(metrics.rowOffsets, scrollY);
  const lastColOffset = scrollX + (width - headerWidth);
  const lastRowOffset = scrollY + (height - headerHeight);

  // --- セル本体 ---
  ctx.save();
  ctx.beginPath();
  ctx.rect(headerWidth, headerHeight, width - headerWidth, height - headerHeight);
  ctx.clip();

  // 罫線はセルごとに「上」と「左」だけを描画する（右・下は隣のセルの左・上として描かれる）。
  // こうすることで、getCellFormat の border:{top:false} 等でその1本だけを個別に消せる。
  // ※ テキスト描画のクリップ処理が ctx.beginPath() を呼ぶため、ループ中に直接
  //   moveTo/lineTo で罫線パスを組み立てると毎回リセットされてしまう
  //  （現在のパスは save()/restore() で保存されない状態のため）。
  //   そのため座標だけ配列に貯めておき、ループが終わってからまとめて1回で描く。
  const borderSegments: Array<[number, number, number, number]> = [];

  for (let r = firstRow; r < store.rows && metrics.rowOffsets[r] < lastRowOffset; r++) {
    const y = headerHeight + metrics.rowOffsets[r] - scrollY;
    const rh = store.rowHeights[r];
    for (let c = firstCol; c < store.cols && metrics.colOffsets[c] < lastColOffset; c++) {
      const x = headerWidth + metrics.colOffsets[c] - scrollX;
      const cw = store.colWidths[c];
      const value = store.getCell(r, c);
      const baseFormat = store.getFormat(r, c);
      const override = opts.getCellFormat?.(r, c, { value, getCell: store.getCell, baseFormat });
      const format: CellFormat | undefined = override ? { ...baseFormat, ...override } : baseFormat;

      // 背景
      ctx.fillStyle = format?.background ?? theme.cellBackground;
      ctx.fillRect(x, y, cw, rh);

      if (inRange(sel.range, r, c)) {
        ctx.fillStyle = theme.selectionFill;
        ctx.fillRect(x, y, cw, rh);
      }

      // テキスト（編集中セルは canvas に描かない。裏の input が表示される）
      const isEditing = editing && editing.row === r && editing.col === c;
      if (!isEditing) {
        const text = formatCellValue(value, format);
        if (text) {
          ctx.fillStyle = format?.color ?? theme.textColor;
          const weightParts: string[] = [];
          if (format?.bold) weightParts.push("bold");
          if (format?.italic) weightParts.push("italic");
          ctx.font = `${weightParts.join(" ")} ${theme.fontSize}px ${theme.fontFamily}`.trim();
          const align = defaultAlign(value, format);
          ctx.textAlign = align;
          const pad = TEXT_PADDING;
          const tx = align === "left" ? x + pad : align === "right" ? x + cw - pad : x + cw / 2;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, cw, rh);
          ctx.clip();
          ctx.fillText(text, tx, y + rh / 2 + 1);
          ctx.restore();
          ctx.font = `${theme.fontSize}px ${theme.fontFamily}`;
        }
      }

      // このセル自身の上辺・左辺の罫線（border.xxx !== false ならデフォルトで表示）
      if (format?.border?.top !== false) {
        const ly = Math.round(y) + 0.5;
        borderSegments.push([x, ly, x + cw, ly]);
      }
      if (format?.border?.left !== false) {
        const lx = Math.round(x) + 0.5;
        borderSegments.push([lx, y, lx, y + rh]);
      }
    }
  }

  // 表全体の外枠（最終行の下辺・最終列の右辺は、どのセルの「上」「左」にも属さないため個別に追加）
  const outerRightX = Math.round(headerWidth + metrics.colOffsets[store.cols] - scrollX) + 0.5;
  const outerBottomY = Math.round(headerHeight + metrics.rowOffsets[store.rows] - scrollY) + 0.5;
  borderSegments.push([outerRightX, headerHeight, outerRightX, outerBottomY]);
  borderSegments.push([headerWidth, outerBottomY, outerRightX, outerBottomY]);

  ctx.beginPath();
  for (const [x1, y1, x2, y2] of borderSegments) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.strokeStyle = theme.gridLineColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- 選択範囲の枠線 ---
  if (metrics.colOffsets[sel.range.c2 + 1] !== undefined) {
    const sx = headerWidth + metrics.colOffsets[sel.range.c1] - scrollX;
    const sy = headerHeight + metrics.rowOffsets[sel.range.r1] - scrollY;
    const ex = headerWidth + metrics.colOffsets[sel.range.c2 + 1] - scrollX;
    const ey = headerHeight + metrics.rowOffsets[sel.range.r2 + 1] - scrollY;
    ctx.strokeStyle = theme.selectionBorderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, ex - sx - 2, ey - sy - 2);
  }

  // --- コピー中の範囲（マーチングアンツ） ---
  if (opts.copiedRange) {
    const cr = opts.copiedRange;
    const cx = headerWidth + metrics.colOffsets[cr.c1] - scrollX;
    const cy = headerHeight + metrics.rowOffsets[cr.r1] - scrollY;
    const cex = headerWidth + metrics.colOffsets[cr.c2 + 1] - scrollX;
    const cey = headerHeight + metrics.rowOffsets[cr.r2 + 1] - scrollY;
    ctx.save();
    ctx.strokeStyle = theme.selectionBorderColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(cx + 1, cy + 1, cex - cx - 2, cey - cy - 2);
    ctx.restore();
  }

  // --- アクティブセルの枠線 ---
  if (!editing) {
    const ax = headerWidth + metrics.colOffsets[active.col] - scrollX;
    const ay = headerHeight + metrics.rowOffsets[active.row] - scrollY;
    const aw = store.colWidths[active.col];
    const ah = store.rowHeights[active.row];
    ctx.strokeStyle = theme.activeCellBorderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(ax + 1, ay + 1, aw - 2, ah - 2);
  }

  ctx.restore(); // クリップ解除

  // --- 列ヘッダ ---
  ctx.fillStyle = theme.headerBackground;
  ctx.fillRect(headerWidth, 0, width - headerWidth, headerHeight);
  ctx.save();
  ctx.beginPath();
  ctx.rect(headerWidth, 0, width - headerWidth, headerHeight);
  ctx.clip();
  ctx.textAlign = "center";
  for (let c = firstCol; c < store.cols && metrics.colOffsets[c] < lastColOffset; c++) {
    const x = headerWidth + metrics.colOffsets[c] - scrollX;
    const cw = store.colWidths[c];
    const isActive = sel.mode !== "row" && c >= sel.range.c1 && c <= sel.range.c2;
    if (isActive) {
      ctx.fillStyle = theme.headerActiveBackground;
      ctx.fillRect(x, 0, cw, headerHeight);
    }
    ctx.fillStyle = theme.headerTextColor;
    ctx.fillText(store.columnHeaderLabel(c), x + cw / 2, headerHeight / 2 + 1);
  }
  ctx.strokeStyle = theme.gridLineColor;
  ctx.beginPath();
  for (let c = firstCol; c <= store.cols && metrics.colOffsets[c] < lastColOffset; c++) {
    const x = Math.round(headerWidth + metrics.colOffsets[c] - scrollX) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, headerHeight);
  }
  ctx.stroke();
  ctx.restore();

  // --- 行ヘッダ ---
  ctx.fillStyle = theme.headerBackground;
  ctx.fillRect(0, headerHeight, headerWidth, height - headerHeight);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, headerHeight, headerWidth, height - headerHeight);
  ctx.clip();
  ctx.textAlign = "center";
  for (let r = firstRow; r < store.rows && metrics.rowOffsets[r] < lastRowOffset; r++) {
    const y = headerHeight + metrics.rowOffsets[r] - scrollY;
    const rh = store.rowHeights[r];
    const isActive = sel.mode !== "col" && r >= sel.range.r1 && r <= sel.range.r2;
    if (isActive) {
      ctx.fillStyle = theme.headerActiveBackground;
      ctx.fillRect(0, y, headerWidth, rh);
    }
    ctx.fillStyle = theme.headerTextColor;
    ctx.fillText(store.rowHeaderLabel(r), headerWidth / 2, y + rh / 2 + 1);
  }
  ctx.strokeStyle = theme.gridLineColor;
  ctx.beginPath();
  for (let r = firstRow; r <= store.rows && metrics.rowOffsets[r] < lastRowOffset; r++) {
    const y = Math.round(headerHeight + metrics.rowOffsets[r] - scrollY) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(headerWidth, y);
  }
  ctx.stroke();
  ctx.restore();

  // --- 左上コーナー ---
  ctx.fillStyle = theme.headerBackground;
  ctx.fillRect(0, 0, headerWidth, headerHeight);
  ctx.strokeStyle = theme.gridLineColor;
  ctx.strokeRect(0.5, 0.5, headerWidth, headerHeight);

  ctx.restore();
}
