/**
 * 【部品: controller / 公開プロパティの型】
 * <CanvasTableGrid> に渡せるプロパティと、コールバックに渡される情報の型。
 * ロジックは持たない。プロパティを増やすときは、ここに型とコメントを足してから
 * 使う側のモジュールで props.xxx を参照する。
 */
import type { JSX } from "solid-js";
import type { GridStore, CellEdit, CellChange } from "../store/createGridStore";
import type {
    CellFormatProvider,
    CellValue,
    DropdownOption,
    DropdownOptionsProvider,
    GridOptions,
    GridTheme,
    RowMoveInfo,
    RowMoveResult,
    SelectionRange,
} from "../types";
import type { KeyBindingMap } from "../lib/keymap";
import type { CellRenderer } from "../rendering/cellRenderer";
import type { GridController } from "./createGridController";

export type { CellChange } from "../store/createGridStore";

/**
 * onChange に渡されるヘルパー。
 * mergeEdits() を呼ぶと、渡した変更が「今回のセル編集と同じUndo単位」にマージされる。
 * サーバーから非同期で関連項目の値を取得して補完するような場合、
 * fetch が解決した後にこれを呼べば、ユーザーの入力とセットで1回のUndo/Redoの対象になる。
 *
 * 各変更では value（省略可）に加えて format（省略可）も指定でき、値の補完と書式変更を同時に行える。
 *   helpers.mergeEdits([{ row, col: 3, value: "日", format: { color: "#c00" } }])
 *   helpers.mergeEdits([{ row, col: 4, format: { background: "#eef" } }])  // 書式のみ
 *   helpers.mergeEdits([{ row, col: 4, format: null }])                      // 書式をクリア
 */
export interface OnChangeHelpers {
    edits: CellEdit[] | undefined;
    mergeEdits: (changes: CellChange[]) => void;
}

/** onCellDoubleClick に渡される、ダブルクリックされたセルの情報 */
export interface CellDoubleClickInfo {
    row: number;
    col: number;
    /** セルに保存されている値（生の値） */
    value: CellValue;
    /** canvas に表示されている文字列（書式適用後） */
    displayValue: string;
    /** 2回目のクリックの pointerdown イベント */
    event: PointerEvent;
}

export interface CanvasTableGridProps {
    options: GridOptions;
    theme?: Partial<GridTheme>;
    /**
     * セルの値が変わるたびに呼ばれる。非同期関数でもよい。
     * row は「データ行」（ツリーでは、折りたたまれた行を含めた元のデータの行番号。ツリーでなければ表示と同じ）。
     * `helpers.mergeEdits` の row も同じくデータ行。画面上の行（表示行）との変換は
     * `store.dataRowOf()` / `store.displayRowOf()`、その行の値の参照は `store.getDataCell()` で行う。
     * `helpers.mergeEdits(...)` を呼ぶと、関連セルへの補完値を今回の変更と
     * 同じUndo単位にまとめて反映できる（例：日付を入力したら曜日列を自動補完、など）。
     */
    onChange?: (row: number, col: number, value: CellValue, helpers: OnChangeHelpers) => void | Promise<void>;
    /**
     * onChange の処理中(true)/完了(false)が変わるたびに呼ばれる。
     * onChange が Promise を返して解決するまでの間、グリッドは編集操作
     * （入力・削除・貼り付け・切り取り・Undo/Redo）を受け付けなくなる。
     * ローディング表示などに利用できる。
     */
    onBusyChange?: (busy: boolean) => void;
    /**
     * 編集開始時に呼ばれ、そのセルの候補一覧を返す。
     * 配列を返せば同期、Promiseを返せば非同期（サーバー取得等）に対応。
     * null/undefined を返したセルは通常のテキスト編集になる（＝特定のセルだけドロップダウン化できる）。
     */
    dropdownOptions?: DropdownOptionsProvider;
    /**
     * ドロップダウンの選択肢を絞り込むためのカスタムフィルター関数。
     * migemo 等を用いた高度なあいまい検索を実装したい場合に指定します。
     */
    dropdownFilter?: (options: DropdownOption[], query: string) => DropdownOption[];
    /**
     * セルの書式を描画のたびに動的に決定するコールバック。
     * `store.getFormat()` で保存されている基本書式（baseFormat）に対する上書き分だけを
     * 返せばよい（変更したいプロパティだけでOK）。`ctx.getCell(row, col)` で任意のセルの
     * 値を参照できるので、例えば「1つ上のセルと同じ値なら罫線を消して文字色を薄くし、
     * セルが結合されているように見せる」といった動的な表現をこちら側で自由に実装できる：
     * ```tsx
     * getCellFormat={(row, col, { value, getCell }) => {
     *   if (row > 0 && getCell(row - 1, col) === value) {
     *     return { border: { top: false }, color: "#aaaaaa" };
     *   }
     * }}
     * ```
     */
    getCellFormat?: CellFormatProvider;
    /**
     * true にすると、行をドラッグ＆ドロップで並べ替えられる（ツリーでは階層も変えられる）。
     * 行ヘッダ（行番号）をクリックして行を選択し、その選択済みの行番号をドラッグする。
     * ドロップ位置は、行の上端 = 前に挿入、下端 = 後ろに挿入、中央 = 子にする（ツリーのみ）。
     * ツリーでは行は子孫ごと移動し、階層は移動先に合わせて付け替わる。Undo 1回で戻せる。
     * 読み取り専用・onChange 処理中は移動できない。プログラムから行う場合は `store.moveRows()`。
     */
    rowDrag?: boolean;
    /**
     * 行の移動の可否を決める。false を返すと、その位置にはドロップできない（ドラッグ中は禁止カーソルになる）。
     * ドラッグ中のポインタの移動に応じて何度も呼ばれるので、軽い処理にすること。行はデータ行。
     */
    canMoveRows?: (info: RowMoveInfo) => boolean;
    /**
     * 行を移動したあとに呼ばれる。result.order / result.levels で、外部のデータを同じ並び・階層に合わせられる。
     * （値の変更ではないので onChange は呼ばれない。Undo/Redo では呼ばれない。）
     */
    onRowsMove?: (result: RowMoveResult) => void;
    /**
     * セルの描き方を差し替える。**全セル**に対して呼ばれるので、特定の列・行・セルだけ変えたいときは
     * 中で `c.row` / `c.col` / `c.dataRow` / `c.value` を見て分岐し、他は `defaultCellRenderer(c)` に任せる
     * （条件ごとの描き方を宣言的に書くなら `withCellRenderers`）。
     * 独自のレンダラーは、セルの矩形でクリップされ、描画状態は呼び出しの後で元に戻り、
     * 例外が起きても他のセルの描画は続く。関数の中で読んだ signal の変化でも再描画される。
     * ```tsx
     * cellRenderer={withCellRenderers([
     *   { when: (c) => c.col === 2, render: drawProgressBar },
     *   { when: (c) => c.value === "NG", render: drawRedBadge },
     * ])}
     * ```
     */
    cellRenderer?: CellRenderer;
    /** 行数（データ行の数。ツリーで折りたたまれた行も含む）が変わる（autoAppendRows・appendRows 等で行が追加される）たびに呼ばれる */
    onRowsChange?: (rows: number) => void;
    /**
     * true の間は読み取り専用。選択・スクロール・コピー・列幅変更はできるが、
     * 入力・削除・切り取り・貼り付け・Ctrl+D・日付/時刻入力・Undo/Redo は行えない。
     * 編集中に true にした場合、入力中の内容は破棄される。実行時に切り替え可能。
     */
    readOnly?: boolean;

    dispCopiedRange?: boolean;
    /**
     * ショートカットキーの割り当てを一部だけ上書きする。
     * アクション名をキーに、配列で新しいキーを指定するとデフォルトを置き換え、
     * `null` を指定するとそのショートカットを無効化できる。指定しなかったアクションは既定のまま。
     * 例: `{ undo: [{ key: "u", mod: true }] }` で Ctrl+U を元に戻すに割り当て直す。
     */
    keyBindings?: KeyBindingMap;
    /**
     * セルがダブルクリックされたときに呼ばれる（読み取り専用・onChange処理中でも呼ばれる）。
     * `false` を返すと、通常のダブルクリックによる編集開始をキャンセルできる
     * （例：独自のダイアログを開きたいとき）。それ以外の戻り値なら従来どおり編集を開始する。
     * ヘッダのダブルクリックは対象外。
     */
    onCellDoubleClick?: (info: CellDoubleClickInfo) => boolean | void;
    /** アクティブセルが変わるたびに呼ばれる（row は画面上の行＝表示行） */
    onActiveCellChange?: (row: number, col: number) => void;
    /** 選択範囲が変わるたびに呼ばれる */
    onSelectionChange?: (range: SelectionRange) => void;
    /** 内部の GridStore を親コンポーネントに渡す（書式設定ツールバー等から操作するため） */
    refStore?: (store: GridStore) => void;
    ref?: (controller: GridController) => void;
    style?: JSX.CSSProperties;
}
