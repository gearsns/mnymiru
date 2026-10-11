import { TEXT_PADDING, clamp } from "./geometry";

export interface ComputeCaretIndexParams {
  /** 実際に input に入る生の文字列 */
  rawText: string;
  /** canvas に描画されている、書式適用後の表示文字列 */
  displayText: string;
  align: "left" | "center" | "right";
  /** セルの左端x座標（canvasローカル座標） */
  cellX: number;
  cellWidth: number;
  /** クリックされたx座標（canvasローカル座標） */
  clickX: number;
  /** 文字列の描画幅を測る関数（例: (t) => ctx.measureText(t).width） */
  measureText: (text: string) => number;
  /** セル内テキストの左右パディング(px)。省略時は geometry.TEXT_PADDING */
  textPadding?: number;
}

/**
 * セルのクリック位置(px)から、編集開始時に置くべき生データ文字列内のキャレット位置を推定する。
 * 表示上は書式（カンマ区切りや日付フォーマット等）で見た目が変わっている場合があるため、
 * 「表示文字列上でのクリック位置」を先に求め、それを生文字列の長さに比例配分する。
 * 書式が無い（表示文字列 === 生文字列）場合は文字単位で厳密に一致する。
 *
 * DOM/canvas に依存しないよう、文字幅の計測は `measureText` として外から注入する
 * （テストでは適当な固定幅を返すモック関数を渡せる）。
 */
export function computeCaretIndex(params: ComputeCaretIndexParams): number {
  const { rawText, displayText, align, cellX, cellWidth, clickX, measureText } = params;
  const pad = params.textPadding ?? TEXT_PADDING;

  if (displayText.length === 0) return 0;

  const textWidth = measureText(displayText);
  const leftX =
    align === "left"
      ? cellX + pad
      : align === "right"
        ? cellX + cellWidth - pad - textWidth
        : cellX + cellWidth / 2 - textWidth / 2;

  const relativeX = clamp(clickX - leftX, 0, textWidth);

  // 各文字境界までの累積幅と比較し、クリック位置に最も近い境界を探す
  let displayIndex = displayText.length;
  let prevWidth = 0;
  for (let i = 1; i <= displayText.length; i++) {
    const w = measureText(displayText.slice(0, i));
    const boundary = (prevWidth + w) / 2; // 直前の境界とこの境界の中間より手前ならここで確定
    if (relativeX < boundary) {
      displayIndex = i - 1;
      break;
    }
    prevWidth = w;
  }

  if (displayText === rawText) return displayIndex; // 書式なし: そのまま使える
  // 書式ありの場合は生文字列の長さに比例配分した位置を使う（近似）
  const ratio = displayIndex / displayText.length;
  return Math.round(ratio * rawText.length);
}
