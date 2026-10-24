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
     * 画面を左右・上下の pane に分割する（Excel の「分割」と同じ考え方。mode: "freeze" にすると通常の「固定」）。
     * 先頭の cols 列を左 pane、先頭の rows 行を上 pane とし、各 pane はそれぞれ内容がはみ出せば自分でスクロールする。
     * 横は「左上と左下」「右上と右下」、縦は「左上と右上」「左下と右下」がスクロールを共有する（同期する）。
     * 実行時に変えるには store.setSplit() を使う。
     */
    split?: SplitOptions;
    /**
     * 先頭から固定する行数。`split: { rows, mode: "freeze" }` の省略記法（通常の固定）。
     * split を指定した場合は split が優先される。実行時に変えるには store.setFrozen(rows, cols) を使う。
     */
    frozenRows?: number;
    /** 先頭から固定する列数。`split: { cols, mode: "freeze" }` の省略記法（通常の固定）。 */
    frozenCols?: number;
    /**
     * ツリーグリッドにする場合に指定する。指定しなければ通常の表。
     * データ（data）は「深さ優先」の並び（親の直後に子が続く）で渡し、各行の深さを levels で指定する。
     * ネストした形式のデータは、flattenTree() で変換できる。
     */
    tree?: TreeOptions;
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

/**
 * 画面の分割の動作モード。
 *   "split"  … 左右・上下の pane がそれぞれ独立してスクロールし、境界のバーをドラッグしてサイズを変えられる（既定）
 *   "freeze" … 通常の「固定」。先頭の列・行は常に表示され（スクロールしない）、残りの部分だけがスクロールする。
 *              境界のバーは動かせず、スクロールバーは縦横1本ずつ（全長）で、leftWidth / topHeight / resizable は無視される
 */
export type SplitMode = "split" | "freeze";

/** 画面の分割の設定（GridOptions.split） */
export interface SplitOptions {
    /** 動作モード（既定 "split"）。"freeze" にすると通常の固定 */
    mode?: SplitMode;
    /** 左 pane に入れる列数（先頭から）。0 または省略で左右に分割しない */
    cols?: number;
    /** 上 pane に入れる行数（先頭から。ツリーでは**データ行**で数える。途中の行を折りたたんでも、それより後ろの行は上 pane に入らない）。0 または省略で上下に分割しない */
    rows?: number;
    /**
     * 左 pane の表示幅(px)。省略すると、左 pane の列の合計幅になる（スクロール不要。従来の「固定」と同じ見た目）。
     * 列の合計幅より小さくすると、左 pane の中が横にスクロールできる。
     */
    leftWidth?: number;
    /**
     * 上 pane の表示高さ(px)。省略すると、そのとき（作成時・rows 変更時・モード切替時）の上 pane の行の合計高さで**固定**される。
     * ツリーの開閉や行高の変更では動かない（動かすのはドラッグか、この値の指定）。
     */
    topHeight?: number;
    /** 境界のバーをドラッグしてサイズを変えられるか（既定 true）。false なら動かせない（固定と同じ） */
    resizable?: boolean;
}

/** 行をドロップする位置。before = 直前、after = 直後（展開された親の後ろは最初の子）、inside = 最後の子（ツリーのみ） */
export type DropPosition = "before" | "after" | "inside";

/** 行の移動（ドラッグ＆ドロップ）の内容。canMoveRows に渡される。行はすべてデータ行 */
export interface RowMoveInfo {
  /** 移動する行（各行は子孫ごと移動する。元の並び順）。親と一緒に選択された子孫は含まれない */
  rows: number[];
  /** ドロップ先の行と位置 */
  target: { row: number; position: DropPosition };
  /** 移動後の、移動した行の階層の深さ（ツリーでなければ 0） */
  level: number;
}

/** 行を移動した結果。onRowsMove に渡される。外部のデータを同じ並びに合わせるのに使う */
export interface RowMoveResult extends RowMoveInfo {
  /** 移動後の並び: order[i] = 移動後の i 行目に来る、移動前のデータ行（全データ行ぶん） */
  order: number[];
  /** ツリーのとき、移動後の各データ行の階層の深さ（全データ行ぶん） */
  levels?: number[];
}

/** ツリーグリッドの設定（GridOptions.tree） */
export interface TreeOptions {
    /** 各データ行の階層の深さ（0 = ルート）。data と同じ長さで、先頭は 0、前の行 + 1 を超えない値にする（超える場合は丸められる） */
    levels: number[];
    /** 開閉アイコンとインデントを表示する列（既定 0） */
    column?: number;
    /**
     * 初期状態の開閉。true = すべて展開（既定）、false = すべて折りたたみ、
     * 配列 = データ行ごと、関数 = データ行から決める。子のない行では無視される。
     */
    expanded?: boolean | boolean[] | ((row: number) => boolean);
    /** 1階層あたりのインデント幅(px)。既定 16 */
    indent?: number;
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
    /** pane の境界のバー（分割線）の色（省略時は既定色。mode: "split" のとき） */
    splitBarColor?: string;
    /** 固定（mode: "freeze"）の境界線の色（省略時は既定色） */
    frozenBorderColor?: string;
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
