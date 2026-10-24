/**
 * 【部品: store / 型】
 * 編集履歴（Undo/Redo）と編集操作で共有する型。Solid・DOM には依存しない。
 */
import type { CellFormat, CellValue } from "../types";

export interface CellEdit {
    row: number;
    col: number;
    before: CellValue;
    after: CellValue;
    beforeFormat?: CellFormat;
    afterFormat?: CellFormat;
}

/**
 * 元に戻せる1つの変更単位（セルの値・書式・行の構造に関わる変更）。
 * edits 配列を参照で保持するため、コマンドを積んだ後でも
 * mergeCellEdits() で同じ配列に追記でき、Undo/Redoが1操作として扱われる。
 *
 * 列幅・行の高さ・スクロール・選択・開閉・固定行/列などの「表示の設定」は、履歴の対象外。
 */
export type Command =
    | {
          kind: "cellEdit";
          label: string;
          edits: CellEdit[];
          /** このコマンドの操作（最終行への入力など）で自動追加された行数。Undo で取り除き、Redo で再追加する */
          appendedRows?: number;
          /**
           * セルの値以外（ツリーの階層・行の高さ・開閉状態の並べ替えなど）も変える操作の、元に戻す/やり直す処理。
           * ツリーのソート・行の移動で、行と一緒に階層なども動くときに使う。
           * ※ 開閉操作そのものは履歴の対象外（開閉の値は書き戻さない）。詳しくは edits.ts の commitReorder。
           */
          structure?: { undo: () => void; redo: () => void };
      };

/** setCellValue が返す、非同期の関連セル更新をマージするためのトークン */
export type EditToken = Extract<Command, { kind: "cellEdit" }> | null;

/**
 * onChange の helpers.mergeEdits() に渡す関連セルへの変更。
 * - value を省略すると値は変更しない（書式だけ変えたいとき）
 * - format は現在の書式にマージされる（指定したプロパティだけ上書き）。
 *   null を渡すとそのセルの書式を丸ごとクリアする。省略すると書式は変更しない
 */
export type CellChange = {
    row: number;
    col: number;
    value?: CellValue;
    format?: CellFormat | null;
};

/** sortRows の reformat コールバックに渡される情報（ソート後の状態） */
export interface SortReformatContext {
    /** このセルのソート後の値 */
    value: CellValue;
    /** ソート後の任意のセルの値（例：1つ上のセルと比較する等に使う） */
    getCell: (row: number, col: number) => CellValue;
    /** このセルのソート後の現在の書式（ソート前の位置から行ごと移動してきたもの） */
    format: CellFormat | undefined;
}

/**
 * ソート後に各セルの書式を再計算するコールバック。
 * - CellFormat を返す → 現在の書式にマージ（指定したプロパティだけ上書き）
 * - null を返す → 書式を丸ごとクリア
 * - undefined を返す → 変更しない
 */
export type SortReformat = (row: number, col: number, ctx: SortReformatContext) => CellFormat | null | undefined;
