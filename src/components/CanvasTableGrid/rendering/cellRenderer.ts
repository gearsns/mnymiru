/**
 * 【部品: rendering / セルレンダラー】
 * 「1つのセルをどう描くか」だけを担当する。位置の計算・罫線・選択枠は別の部品。
 *
 * 描画を差し替えたいとき（進捗バー、チェックボックス、バッジ等）は、
 * CellRenderer 型の関数を作って <CanvasTableGrid cellRenderer={...}> に渡す。
 * 関数は「全セル」に対して呼ばれるので、特定の列・行・セルだけ変えたいときは、
 * 中で c.row / c.col / c.value などを見て分岐し、それ以外は defaultCellRenderer(c) を呼ぶ
 * （この分岐を宣言的に書くための withCellRenderers も用意してある）。
 * defaultCellRenderer を部分的に再利用できるよう、背景・開閉アイコン・テキストは別関数にしてある。
 * ツリー列のセルでは c.tree に階層の情報が入る（defaultCellRenderer はインデント・アイコンも描く）。
 *
 * 独自のレンダラーは、グリッドを壊さないよう次のように保護して呼ばれる
 * （標準のレンダラーには影響しない）:
 *   - セルの矩形でクリップされる（隣のセルにはみ出して描けない）
 *   - 描画状態（色・フォント・線の太さなど）は、呼び出しの後で元に戻る
 *   - 例外が起きても他のセルの描画は続く（コンソールにエラーが出る）
 *

 *   const myRenderer: CellRenderer = (c) => {
 *     if (c.col === 2) {
 *       drawCellBackground(c);
 *       // ここに独自の描画（c.ctx と c.rect を使う）
 *       return;
 *     }
 *     defaultCellRenderer(c);
 *   };
 */
import type { CellFormat, CellValue, GridTheme } from "../types";
import { defaultAlign, formatCellValue } from "../format";
import { TEXT_PADDING, type Rect } from "../lib/geometry";
import { treeTextInset, treeToggleBox } from "../lib/tree";

export interface CellRenderContext {
  ctx: CanvasRenderingContext2D;
  theme: GridTheme;
  /** 表示行（いま見えている行の通し番号） */
  row: number;
  col: number;
  /**
   * データ行（元のデータ配列の行番号）。ツリーの折りたたみやソートで表示行は変わるので、
   * 「このデータのこの行だけ」のように行を特定したいときはこちらで判定する。ツリーでなければ row と同じ。
   */
  dataRow: number;
  /** canvas ローカル座標でのセル矩形（スクロール・ヘッダ分を反映済み） */
  rect: Rect;
  value: CellValue;
  /** 基本書式に getCellFormat の上書きをマージ済みの書式 */
  format: CellFormat | undefined;
  /** 選択範囲に含まれるか */
  selected: boolean;
  /** 編集中か（編集中のセルは裏の input が見えるので、テキストは描かない） */
  editing: boolean;
  /** ツリー列のセルのときだけ入る、階層の情報（ツリーでなければ undefined） */
  tree?: TreeCellInfo;
}

export interface TreeCellInfo {
  /** 階層の深さ（0 = ルート） */
  level: number;
  hasChildren: boolean;
  /** 展開されているか（子のない行は false） */
  expanded: boolean;
  /** 1階層あたりのインデント幅(px) */
  indent: number;
}

export type CellRenderer = (c: CellRenderContext) => void;

/** 書式なしの基本フォント */
export function baseFont(theme: GridTheme): string {
  return `${theme.fontSize}px ${theme.fontFamily}`;
}

/** 書式（太字・斜体）を反映したフォント。編集開始時のキャレット位置計算でも同じものを使う */
export function cellFont(theme: GridTheme, format: CellFormat | undefined): string {
  const weightParts: string[] = [];
  if (format?.bold) weightParts.push("bold");
  if (format?.italic) weightParts.push("italic");
  return `${weightParts.join(" ")} ${theme.fontSize}px ${theme.fontFamily}`.trim();
}

/** 背景色と、選択中の薄い塗り */
export function drawCellBackground(c: CellRenderContext): void {
  const { ctx, theme, rect, format } = c;
  ctx.fillStyle = format?.background ?? theme.cellBackground;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  if (c.selected) {
    ctx.fillStyle = theme.selectionFill;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
}

/** 書式適用後のテキスト（編集中のセルは描かない） */
export function drawCellText(c: CellRenderContext): void {
  if (c.editing) return;
  const { ctx, theme, rect, value, format } = c;
  const text = formatCellValue(value, format);
  if (!text) return;

  ctx.fillStyle = format?.color ?? theme.textColor;
  ctx.font = cellFont(theme, format);
  const align = defaultAlign(value, format);
  ctx.textAlign = align;
  const pad = TEXT_PADDING;
  const tx = align === "left" ? rect.x + pad : align === "right" ? rect.x + rect.w - pad : rect.x + rect.w / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillText(text, tx, rect.y + rect.h / 2 + 1);
  ctx.restore();
  ctx.font = baseFont(theme);
}

/** ツリーの開閉アイコン（▶ 折りたたみ / ▼ 展開）。子のない行には描かない */
export function drawTreeToggle(c: CellRenderContext): void {
  const t = c.tree;
  if (!t || !t.hasChildren) return;
  const { ctx, theme, rect } = c;
  const box = treeToggleBox(rect, t.level, t.indent);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.fillStyle = theme.headerTextColor;
  ctx.beginPath();
  if (t.expanded) {
    ctx.moveTo(cx - 4, cy - 2);
    ctx.lineTo(cx + 4, cy - 2);
    ctx.lineTo(cx, cy + 3);
  } else {
    ctx.moveTo(cx - 2, cy - 4);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx - 2, cy + 4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 標準のセル描画：背景 → 選択の塗り →（ツリー列なら開閉アイコン）→ テキスト */
export const defaultCellRenderer: CellRenderer = (c) => {
  drawCellBackground(c);
  if (c.tree) {
    drawTreeToggle(c);
    // テキストはインデント・アイコンの右から始める
    const inset = treeTextInset(c.tree.level, c.tree.indent);
    drawCellText({ ...c, rect: { ...c.rect, x: c.rect.x + inset, w: Math.max(0, c.rect.w - inset) } });
    return;
  }
  drawCellText(c);
};

/** withCellRenderers に渡す規則 */
export interface CellRendererRule {
  /** このセルを担当するか */
  when: (c: CellRenderContext) => boolean;
  /** 担当するセルの描き方 */
  render: CellRenderer;
}

/**
 * 「条件に合うセルだけ別の描き方にする」レンダラーを作る。規則は先頭から順に判定し、最初に合ったものだけが使われる。
 * どれにも合わないセルは fallback（既定は defaultCellRenderer）で描かれる。
 *
 *   cellRenderer={withCellRenderers([
 *     { when: (c) => c.col === 2, render: progressBar },            // 列ごと
 *     { when: (c) => c.row === 0, render: headerStyle },            // 行ごと
 *     { when: (c) => c.row === 3 && c.col === 1, render: star },    // 1セルだけ
 *     { when: (c) => c.value === "NG", render: redBadge },          // 値で
 *   ])}
 */
export function withCellRenderers(rules: CellRendererRule[], fallback: CellRenderer = defaultCellRenderer): CellRenderer {
  return (c) => {
    for (const rule of rules) {
      if (rule.when(c)) {
        rule.render(c);
        return;
      }
    }
    fallback(c);
  };
}
