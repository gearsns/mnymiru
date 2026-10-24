/**
 * 【部品: controller / 裏の input（編集用の入力欄）】
 * canvas の裏に置いてある <input> の位置・サイズ・見た目を、アクティブ（編集中）セルに合わせる。
 * 編集開始時にクリック位置からキャレット位置を推定する処理もここ。
 */
import { defaultAlign, formatCellValue } from "../format";
import { computeCaretIndex } from "../lib/caret";
import { treeTextInset } from "../lib/tree";
import { cellFont } from "../rendering/cellRenderer";
import { resolveCellFormat } from "../rendering/cellFormat";
import { editableInputStyle } from "../styles";
import type { CellFormat } from "../types";
import type { GridContext } from "./context";
import type { Viewport } from "./viewport";

export function createInputOverlay(ctx: GridContext, viewport: Viewport) {
    const { props, store, theme, els } = ctx;

    /** store の基本書式に getCellFormat コールバックの上書きをマージした、実際に使う書式を返す */
    function getEffectiveFormat(row: number, col: number): CellFormat | undefined {
        return resolveCellFormat(store, props.getCellFormat, row, col);
    }

    /** ツリー列のセルでは、テキストがインデント・開閉アイコンの右から始まるので、その分だけ入力欄をずらす */
    function textInset(row: number, col: number): number {
        return col === store.treeColumn ? treeTextInset(store.rowLevel(row), store.treeIndent) : 0;
    }

    function positionInput() {
        const editing = store.editingCell();
        const target = editing ?? store.activeCell();
        const inset = textInset(target.row, target.col);
        const full = viewport.cellRect(target.row, target.col);
        const r = { ...full, x: full.x + inset, w: full.w - inset };
        const value = store.getCell(target.row, target.col);
        const format = getEffectiveFormat(target.row, target.col);
        const input = els.input;
        input.style.left = `${r.x}px`;
        input.style.top = `${r.y}px`;
        input.style.width = `${Math.max(0, r.w)}px`;
        input.style.height = `${Math.max(0, r.h)}px`;
        input.style.fontSize = `${theme.fontSize}px`;
        input.style.fontFamily = theme.fontFamily;
        // セルの配置設定（左/中央/右寄せ）を編集中の入力欄にも反映する
        input.style.textAlign = defaultAlign(value, format);
        // 見た目（背景・枠線・クリック透過など）は editing かどうかで丸ごと切り替わるので styles.ts に集約している
        Object.assign(input.style, editableInputStyle(!!editing, theme));
    }

    /**
     * セルのクリック位置(px, canvas上のローカルX座標)から、編集開始時に置くべき
     * 生データ文字列（inputに入る文字列）内のキャレット位置を推定する。
     * 表示上は書式（カンマ区切りや日付フォーマット等）で見た目が変わっている場合があるため、
     * 「表示文字列上でのクリック位置」を先に求め、それを生文字列の長さに比例配分する。
     * 書式が無い（表示文字列 === 生文字列）場合は厳密に一致する。
     */
    function caretIndexFromClick(row: number, col: number, clickX: number): number {
        const format = getEffectiveFormat(row, col);
        const value = store.getCell(row, col);
        const rawText = value == null ? "" : String(value);
        const displayText = formatCellValue(value, format);

        const ctx2d = els.canvas.getContext("2d");
        if (!ctx2d) return rawText.length;

        ctx2d.font = cellFont(theme, format);

        const full = viewport.cellRect(row, col);
        const inset = textInset(row, col);
        const rect = { ...full, x: full.x + inset, w: full.w - inset };
        const align = defaultAlign(value, format);

        return computeCaretIndex({
            rawText,
            displayText,
            align,
            cellX: rect.x,
            cellWidth: rect.w,
            clickX,
            measureText: (text) => ctx2d.measureText(text).width,
        });
    }

    return { getEffectiveFormat, positionInput, caretIndexFromClick };
}

export type InputOverlay = ReturnType<typeof createInputOverlay>;
