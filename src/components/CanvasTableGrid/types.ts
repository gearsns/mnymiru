/**
 * canvas-table-grid: 型定義
 */

export type CellValue = string | number | null;

/** セル1つの表示・書式設定 */
export interface CellFormat {
    /** 値の解釈タイプ。number/date は pattern に従って表示文字列を作る */
    type?: "number" | "date" | "text" | "custom";
    /**
     * type="number" の場合の書式パターン。
     *   "#,##0"      -> 1000    => "1,000"
     *   "#,##0.00"   -> 1000.5  => "1,000.50"
     *   "0.0%"       -> 0.125   => "12.5%"
     * type="date" の場合の書式パターン（トークン置換）。
     *   "YYYY/MM/DD" -> 2024-09-01 => "2024/09/01"
     *   "M/D(ddd)"   -> 2024-09-01 => "9/1(日)"
     */
    pattern?: string;
    /** 完全にカスタムな表示関数。指定時は type/pattern より優先 */
    formatter?: (value: CellValue) => string;
    /** 文字色 */
    color?: string;
    /** 背景色 */
    background?: string;
    /** 水平方向の配置。未指定時は number は right, それ以外は left */
    align?: "left" | "center" | "right";
    bold?: boolean;
    italic?: boolean;
    /**
     * セル自身の「上辺」「左辺」の罫線の表示制御（省略時はどちらも表示）。
     * 実装上、各セルは自分の上と左の罫線だけを描画する
     * （右・下の罫線は、右や下のセルの「左」「上」として描画される）。
     * 例えば、1つ上のセルと同じ値のときに `{ top: false }` を返せば、
     * その行の上側の罫線が消え、あたかも結合されているように見せられる。
     */
    border?: {
        top?: boolean;
        left?: boolean;
    };
}

/** getCellFormat コールバックに渡される情報 */
export interface CellFormatContext {
    /** このセルの現在の値 */
    value: CellValue;
    /** 任意のセルの値を取得する（例：1つ上のセルと比較する等に使う） */
    getCell: (row: number, col: number) => CellValue;
    /** setRangeFormat 等で保存されている、コールバック適用前の基本書式 */
    baseFormat: CellFormat | undefined;
}

/**
 * セルの書式を動的に決定するコールバック。
 * 戻り値は baseFormat にマージされる（baseFormat の上から上書きされる）ので、
 * 変えたいプロパティだけを返せばよい。undefined を返せば baseFormat のまま。
 */
export type CellFormatProvider = (row: number, col: number, ctx: CellFormatContext) => CellFormat | undefined;

export interface GridOptions {
    rows: number;
    cols: number;
    /** 初期データ。省略時は全セル null */
    data?: CellValue[][];
    /** 初期書式 */
    formats?: (CellFormat | undefined)[][];
    /** 列幅(px)の初期値。省略時 defaultColWidth を使用 */
    colWidths?: number[];
    rowHeights?: number[];
    defaultColWidth?: number;
    defaultRowHeight?: number;
    /**
     * 最終行のセルに値を入れる（入力・貼り付け・Ctrl+D 等）と、この行数だけ末尾に行を追加する。
     * 0 または省略時は行数固定。追加した行は Undo しても残る。
     * 手動で追加したい場合は store.appendRows(n) / store.ensureRows(n) を使う。
     */
    autoAppendRows?: number;
    headerHeight?: number;
    headerWidth?: number;
    /**
     * 列ヘッダのラベル。省略時 A,B,C...
     * - 関数 `(colIndex) => string` を渡すと動的に決められる
     * - 文字列配列 `["日付","売上",...]` を渡すと、そのままインデックスに対応する名前が使われる
     *   （配列の範囲外の列は既定の A,B,C... にフォールバックする）
     */
    columnHeaderLabel?: ((colIndex: number) => string) | string[];
    /**
     * 行ヘッダのラベル。省略時 1,2,3...(1-origin)
     * 関数または文字列配列を渡せる（columnHeaderLabel と同様）
     */
    rowHeaderLabel?: ((rowIndex: number) => string) | string[];
}

export interface CellPos {
    row: number;
    col: number;
}

export interface SelectionRange {
    r1: number;
    c1: number;
    r2: number;
    c2: number;
}

export type SelectionMode = "cell" | "row" | "col";

export interface Selection {
    mode: SelectionMode;
    /** ドラッグ開始位置（アンカー・固定端） */
    anchor: CellPos;
    /** 現在のカーソル位置（可動端） */
    focus: CellPos;
    /** 現在の範囲（正規化済み: r1<=r2, c1<=c2） */
    range: SelectionRange;
}

export interface GridTheme {
    fontFamily: string;
    fontSize: number;
    textColor: string;
    gridLineColor: string;
    headerBackground: string;
    headerTextColor: string;
    headerActiveBackground: string;
    cellBackground: string;
    activeCellBorderColor: string;
    selectionFill: string;
    selectionBorderColor: string;
    /** スクロールバーの帯（トラック）の色 */
    scrollbarTrackColor: string;
    /** スクロールバーのつまみ（サム）の色 */
    scrollbarThumbColor: string;
}

/** ドロップダウンの選択肢。label省略時は value の文字列表現を表示に使う */
export interface DropdownOption {
    value: CellValue;
    label?: string;
}

/**
 * セルがドロップダウン編集に対応するかどうかを判定し、選択肢を返す関数。
 * - 対応しないセルには null/undefined を返す。
 * - 選択肢は同期の配列でも、非同期に取得する Promise でもよい
 *  （サーバーから取得する場合など）。
 */
export type DropdownOptionsProvider = (
    row: number,
    col: number
) => DropdownOption[] | Promise<DropdownOption[]> | null | undefined;
