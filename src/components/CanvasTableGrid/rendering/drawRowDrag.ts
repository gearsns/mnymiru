/**
 * 【部品: rendering / 行ドラッグの表示】
 * 行をドラッグしている間の表示：移動元の行を薄暗くし、ドロップ位置を示す。
 *   before / after … 挿入位置に線を引く。ツリーでは、移動後の階層のインデント位置から引き、先頭に丸を付ける
 *   inside         … ドロップ先の行全体を枠で囲む（その行の子になる）
 * 領域（ペイン）ごとに呼ばれ、その領域に属する行・列の部分だけを描く（分割した pane と共存できる）。
 */
import { colEdgeX, colEndX, rowEdgeY, rowEndY, type Pane } from "../lib/geometry";
import { TREE_LEFT_PADDING } from "../lib/tree";
import type { DrawFrame, RowDragVisual } from "./types";

export function drawRowDrag(f: DrawFrame, pane: Pane, drag: RowDragVisual | null | undefined): void {
  if (!drag) return;
  const { ctx, source, metrics, theme, scroll } = f;
  const x1 = colEdgeX(source, metrics, scroll, pane.cols.start);
  const x2 = colEndX(source, metrics, scroll, pane.cols.end - 1);

  // --- 移動元の行を薄暗くする ---
  const r1 = Math.max(drag.sources.r1, pane.rows.start);
  const r2 = Math.min(drag.sources.r2, pane.rows.end - 1);
  if (r1 <= r2) {
    const y1 = rowEdgeY(source, metrics, scroll, r1);
    const y2 = rowEndY(source, metrics, scroll, r2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
  }

  // --- ドロップ位置 ---
  const t = drag.target;
  if (!t || t.row < pane.rows.start || t.row >= pane.rows.end) return;
  const top = rowEdgeY(source, metrics, scroll, t.row);
  const bottom = rowEndY(source, metrics, scroll, t.row);
  ctx.strokeStyle = theme.selectionBorderColor;
  ctx.fillStyle = theme.selectionBorderColor;

  if (t.position === "inside") {
    ctx.save();
    ctx.fillStyle = theme.selectionFill;
    ctx.fillRect(x1, top, x2 - x1, bottom - top);
    ctx.strokeStyle = theme.selectionBorderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x1 + 1, top + 1, x2 - x1 - 2, bottom - top - 2);
    ctx.restore();
    return;
  }

  const y = t.position === "before" ? top : bottom;
  // 線の始まり: ツリーでは移動後の階層のインデント位置（どの階層に入るかが分かる）、そうでなければ表の左端
  const lineStart =
    source.treeColumn >= 0
      ? colEdgeX(source, metrics, scroll, source.treeColumn) + TREE_LEFT_PADDING + t.level * source.treeIndent
      : colEdgeX(source, metrics, scroll, 0);
  const startX = Math.max(lineStart, x1);
  ctx.save();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  if (lineStart >= x1 && lineStart <= x2) {
    ctx.beginPath();
    ctx.arc(lineStart, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
