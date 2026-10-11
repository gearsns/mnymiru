import { createEffect, createSignal, createMemo, onCleanup, onMount, untrack, type JSX } from "solid-js";
import { createGridStore } from "./GridStore";
import type { CellEdit, CellChange, EditToken } from "./GridStore";
export type { CellChange } from "./GridStore";
import { drawGrid, defaultTheme } from "./rendering/drawGrid";
import { drawScrollbars } from "./rendering/drawScrollbars";
import {
    computeMetrics,
    pixelToCell,
    findColumnBorderNear,
    clamp,
    cellRect as computeCellRect,
    computeEnsureVisibleScroll,
} from "./lib/geometry";
import { SCROLLBAR_SIZE, scrollbarHitTest as computeScrollbarHitTest, scrollbarDragRatio } from "./lib/scrollbar";
import { isDoubleClick, type ClickPoint } from "./lib/doubleClick";
import { filterDropdownOptions, clampHighlightIndex } from "./lib/dropdown";
import { spliceAtCursor } from "./lib/textEdit";
import { computeCaretIndex } from "./lib/caret";
import { coerceValue } from "./lib/coerceValue";
import { buildClipboardText, parseClipboardText, computePasteRange } from "./lib/clipboard";
import { formatTodayDate, formatNowTime } from "./lib/quickDateTime";
import { editableInputStyle } from "./styles";
import { mergeKeyBindings, matchesAction, type GridAction, type KeyBindingMap } from "./lib/keymap";
import type {
    CellFormat,
    CellFormatProvider,
    CellValue,
    DropdownOption,
    DropdownOptionsProvider,
    GridOptions,
    GridTheme,
    SelectionRange,
} from "./types";
import { formatCellValue, defaultAlign } from "./format";

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
    /** 行数が変わる（autoAppendRows・appendRows 等で行が追加される）たびに呼ばれる */
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
    /** アクティブセルが変わるたびに呼ばれる */
    onActiveCellChange?: (row: number, col: number) => void;
    /** 選択範囲が変わるたびに呼ばれる */
    onSelectionChange?: (range: SelectionRange) => void;
    /** 内部の GridStore を親コンポーネントに渡す（書式設定ツールバー等から操作するため） */
    refStore?: (store: ReturnType<typeof createGridStore>) => void;
    ref?: (controller: GridController) => void;
    style?: JSX.CSSProperties;
}

const MIN_COL_WIDTH = 30;
const RESIZE_HANDLE_PX = 5;

/**
 * CanvasTableGrid の全ロジック（状態・DOMイベント処理・canvas再描画のトリガー）をまとめたコントローラ。
 * JSX（見た目の組み立て）は持たず、CanvasTableGrid.tsx から呼ばれて使われる。
 * こうして分けることで、「何をレンダリングするか」と「どう振る舞うか」が別ファイルになり、
 * それぞれの見通しがよくなる（振る舞いの大部分はさらに src/lib/ の純粋関数に切り出し済み）。
 */
export function createGridController(props: CanvasTableGridProps) {
    const store = createGridStore(props.options);
    props.refStore?.(store);

    const theme: GridTheme = { ...defaultTheme, ...props.theme };
    const metrics = createMemo(() => computeMetrics(store));

    let rootEl!: HTMLDivElement;
    let canvasEl!: HTMLCanvasElement;
    let inputEl!: HTMLInputElement;

    const [size, setSize] = createSignal({ width: 0, height: 0 });
    const [copiedRange, setCopiedRange] = createSignal<SelectionRange | null>(null);
    const [pendingCount, setPendingCount] = createSignal(0);
    /** true の間は onChange の処理待ち。編集系の操作をすべて禁止する。 */
    const busy = () => pendingCount() > 0;
    /** 編集系の操作を受け付けない状態（onChange 処理中 または 読み取り専用） */
    const locked = () => busy() || !!props.readOnly;
    const keyBindings = createMemo(() => mergeKeyBindings(props.keyBindings));
    const dpr = () => window.devicePixelRatio || 1;

    // ---------- ドロップダウン編集 ----------
    interface DropdownState {
        row: number;
        col: number;
        options: DropdownOption[];
        loading: boolean;
    }
    const [dropdown, setDropdown] = createSignal<DropdownState | null>(null);
    const [editText, setEditText] = createSignal("");
    const [highlightedIndex, setHighlightedIndex] = createSignal(-1);

    const filteredOptions = createMemo(() => {
        const dd = dropdown();
        if (!dd) return [] as DropdownOption[];
        // コントローラ側でカスタムフィルターがあれば優先し、なければデフォルトを使う
        if (props.dropdownFilter) {
            return props.dropdownFilter(dd.options, editText());
        }
        return filterDropdownOptions(dd.options, editText());
    });

    // 編集が終わった（外部から止められた場合も含む）ら、入力欄とドロップダウンを片付ける
    createEffect(() => {
        if (!store.editingCell()) {
            setDropdown(null);
            inputEl.value = "";
        }
    });

    createEffect(() => {
        // store.selection() を購読し、範囲が変わるたびに発火させる
        const selection = store.selection();
        if (selection) {
            props.onSelectionChange?.(store.selection().range);
        }
    });

    // data.cells の参照が変わった（= replaceData が呼ばれた）場合にcopiedRangeをクリアする
    let lastCellsRef = store.data.cells;
    createEffect(() => {
        const currentCells = store.data.cells;
        if (currentCells !== lastCellsRef) {
            lastCellsRef = currentCells;
            setCopiedRange(null); // データが丸ごと置き換わったのでコピー枠をクリア
        }
    });

    // 絞り込み結果が変わったらハイライトはいったん解除する（明示的に矢印キーで選ぶまでは自由入力扱い）
    createEffect(() => {
        filteredOptions();
        setHighlightedIndex(-1);
    });

    let isSelecting = false;
    let composing = false;
    const DOUBLE_CLICK_MS = 400;
    const DOUBLE_CLICK_PX = 4;
    let lastClick: ClickPoint | null = null;
    let dragScrollbar: "v" | "h" | null = null;
    let dragScrollbarStartPx = 0;
    let dragScrollbarStartScroll = 0;
    let resizingCol: number | null = null;
    let resizeStartX = 0;
    let resizeStartWidth = 0;

    const totalWidth = createMemo(() => metrics().colOffsets[store.cols]);
    const totalHeight = createMemo(() => metrics().rowOffsets[store.rows]);

    function viewportSize() {
        const s = size();
        return {
            w: Math.max(0, s.width - store.headerWidth - SCROLLBAR_SIZE),
            h: Math.max(0, s.height - store.headerHeight - SCROLLBAR_SIZE),
        };
    }

    function clampScroll(x: number, y: number) {
        const vp = viewportSize();
        const maxX = Math.max(0, totalWidth() - vp.w);
        const maxY = Math.max(0, totalHeight() - vp.h);
        return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
    }

    /**
     * 指定したローカル座標(px, py)がスクロールバー（実際に表示されている場合のみ）の
     * 上かどうかを判定する。クリック判定・ホバー時のカーソル変更の両方で使う。
     */
    function scrollbarHitTest(px: number, py: number, width: number, height: number) {
        const vp = viewportSize();
        return computeScrollbarHitTest({
            px,
            py,
            width,
            height,
            headerWidth: store.headerWidth,
            headerHeight: store.headerHeight,
            viewportWidth: vp.w,
            viewportHeight: vp.h,
            contentWidth: totalWidth(),
            contentHeight: totalHeight(),
        });
    }

    // ---------- 描画 ----------
    function render() {
        const ctx = canvasEl.getContext("2d");
        if (!ctx) return;
        const s = size();
        drawGrid(ctx, store, metrics(), {
            width: s.width,
            height: s.height,
            dpr: dpr(),
            theme,
            copiedRange: props.dispCopiedRange ? copiedRange() : null,
            getCellFormat: props.getCellFormat,
        });
        drawScrollbars(ctx, {
            width: s.width,
            height: s.height,
            dpr: dpr(),
            headerWidth: store.headerWidth,
            headerHeight: store.headerHeight,
            scroll: store.scroll(),
            viewport: viewportSize(),
            content: { w: totalWidth(), h: totalHeight() },
            theme,
        });
        positionInput();
    }

    // ---------- 裏の input 制御 ----------
    function cellRect(row: number, col: number) {
        return computeCellRect(store, metrics(), store.scroll(), row, col);
    }

    function positionInput() {
        const editing = store.editingCell();
        const target = editing ?? store.activeCell();
        const r = cellRect(target.row, target.col);
        const value = store.getCell(target.row, target.col);
        const format = getEffectiveFormat(target.row, target.col);
        inputEl.style.left = `${r.x}px`;
        inputEl.style.top = `${r.y}px`;
        inputEl.style.width = `${Math.max(0, r.w)}px`;
        inputEl.style.height = `${Math.max(0, r.h)}px`;
        inputEl.style.fontSize = `${theme.fontSize}px`;
        inputEl.style.fontFamily = theme.fontFamily;
        // セルの配置設定（左/中央/右寄せ）を編集中の入力欄にも反映する
        inputEl.style.textAlign = defaultAlign(value, format);
        // 見た目（背景・枠線・クリック透過など）は editing かどうかで丸ごと切り替わるので styles.ts に集約している
        Object.assign(inputEl.style, editableInputStyle(!!editing, theme));
    }

    /**
     * onChange を実行する（await して完了を待つ）。
     * 呼び出し元となる編集操作（beginEdit・handlePaste・handleCut・Undo/Redo等）は
     * すべて busy() を見て新しい編集の開始を止めているため、この関数の実行中に
     * 別の onChange が呼ばれることはない。キューで直列化しなくても、
     * 「busyの間は次の編集を始められない」というロックだけで結果的に直列になる。
     */
    async function runOnChange(row: number, col: number, value: CellValue, token: EditToken) {
        if (!props.onChange) return;
        setPendingCount((n) => n + 1);
        try {
            await props.onChange(row, col, value, {
                edits: token?.edits,
                mergeEdits: (changes) => store.mergeCellEdits(token, changes),
            });
        } catch (err) {
            console.error("[canvas-table-grid] onChange でエラーが発生しました:", err);
        } finally {
            setPendingCount((n) => Math.max(0, n - 1));
            requestAnimationFrame(render);
        }
    }

    /**
     * 編集開始時に呼び、そのセルにドロップダウンがあれば選択肢を読み込む。
     * 非同期の場合は取得中 loading:true の状態を見せ、完了時にまだ同じセルを
     * 編集中であれば選択肢を反映する（その間に編集をやめていれば何もしない）。
     */
    function openDropdownIfNeeded(row: number, col: number) {
        setDropdown(null);
        if (!props.dropdownOptions) return;
        const result = props.dropdownOptions(row, col);
        if (result == null) return;

        if (Array.isArray(result)) {
            setDropdown({ row, col, options: result, loading: false });
            return;
        }

        setDropdown({ row, col, options: [], loading: true });
        result
            .then((options) => {
                const editing = store.editingCell();
                if (!editing || editing.row !== row || editing.col !== col) return; // 既に編集を終えていた
                setDropdown({ row, col, options: options ?? [], loading: false });
            })
            .catch((err) => {
                console.error("[canvas-table-grid] dropdownOptions の取得に失敗しました:", err);
                const editing = store.editingCell();
                if (editing && editing.row === row && editing.col === col) {
                    setDropdown({ row, col, options: [], loading: false });
                }
            });
    }

    function beginEdit(caretIndex?: number) {
        if (locked()) return; // onChange 処理中は編集開始を禁止
        const target = store.activeCell();
        store.setEditingCell(target);
        const raw = store.getCell(target.row, target.col);
        inputEl.value = raw == null ? "" : String(raw);
        setEditText(inputEl.value);
        positionInput();
        inputEl.focus();
        const len = inputEl.value.length;
        const pos = caretIndex === undefined ? len : Math.max(0, Math.min(len, caretIndex));
        inputEl.setSelectionRange(pos, pos);
        openDropdownIfNeeded(target.row, target.col);
        requestAnimationFrame(render);
    }

    /**
     * セルのクリック位置(px, canvas上のローカルX座標)から、編集開始時に置くべき
     * 生データ文字列（inputに入る文字列）内のキャレット位置を推定する。
     * 表示上は書式（カンマ区切りや日付フォーマット等）で見た目が変わっている場合があるため、
     * 「表示文字列上でのクリック位置」を先に求め、それを生文字列の長さに比例配分する。
     * 書式が無い（表示文字列 === 生文字列）場合は厳密に一致する。
     */
    /** store の基本書式に getCellFormat コールバックの上書きをマージした、実際に使う書式を返す */
    function getEffectiveFormat(row: number, col: number): CellFormat | undefined {
        const value = store.getCell(row, col);
        const baseFormat = store.getFormat(row, col);
        const override = props.getCellFormat?.(row, col, { value, getCell: store.getCell, baseFormat });
        return override ? { ...baseFormat, ...override } : baseFormat;
    }

    function caretIndexFromClick(row: number, col: number, clickX: number): number {
        const format = getEffectiveFormat(row, col);
        const value = store.getCell(row, col);
        const rawText = value == null ? "" : String(value);
        const displayText = formatCellValue(value, format);

        const ctx = canvasEl.getContext("2d");
        if (!ctx) return rawText.length;

        const weightParts: string[] = [];
        if (format?.bold) weightParts.push("bold");
        if (format?.italic) weightParts.push("italic");
        ctx.font = `${weightParts.join(" ")} ${theme.fontSize}px ${theme.fontFamily}`.trim();

        const rect = cellRect(row, col);
        const align = defaultAlign(value, format);

        return computeCaretIndex({
            rawText,
            displayText,
            align,
            cellX: rect.x,
            cellWidth: rect.w,
            clickX,
            measureText: (text) => ctx.measureText(text).width,
        });
    }

    function commitEdit(moveRow: number, moveCol: number) {
        const editing = store.editingCell();
        if (!editing) return;
        const text = inputEl.value;
        const prev = store.getCell(editing.row, editing.col);
        const nextValue: CellValue = text === "" ? null : coerceValue(text, store.getFormat(editing.row, editing.col));
        // 先に編集状態を抜けてカーソルを移動する（値の反映自体は同期的に完了している）。
        // onChange の完了を待つのは「次の編集を許可するタイミング」だけでよい。
        store.setEditingCell(null);
        setDropdown(null);
        inputEl.value = "";
        moveActive(moveRow, moveCol, false);
        inputEl.focus();
        if (nextValue !== prev) {
            const token: EditToken = store.setCellValue(editing.row, editing.col, nextValue);
            void runOnChange(editing.row, editing.col, nextValue, token);
        }
    }

    function cancelEdit() {
        store.setEditingCell(null);
        setDropdown(null);
        inputEl.value = "";
        inputEl.focus();
        requestAnimationFrame(() => {
            inputEl.focus();
            render();
        });
    }

    /** ドロップダウンの選択肢をクリック／Enter/Tabで確定する */
    function selectDropdownOption(opt: DropdownOption, moveRow: number, moveCol: number) {
        inputEl.value = opt.value == null ? "" : String(opt.value);
        commitEdit(moveRow, moveCol);
    }

    /** アクティブセル（または拡張時は選択の可動端）を絶対位置(row,col)に移動する */
    function moveActiveTo(row: number, col: number, extend: boolean) {
        const r = clamp(row, 0, store.rows - 1);
        const c = clamp(col, 0, store.cols - 1);
        store.selectCell(r, c, extend);
        props.onActiveCellChange?.(store.activeCell().row, store.activeCell().col);
        ensureVisible(r, c);
    }

    function moveActive(dRow: number, dCol: number, extend: boolean) {
        // 拡張時は選択の可動端(focus)を動かし、通常時はアクティブセルを動かす
        const base = extend ? store.selection().focus : store.activeCell();
        moveActiveTo(base.row + dRow, base.col + dCol, extend);
    }

    /**
     * カーソル位置（または末尾）に日付・時刻などの文字列を挿入する（Ctrl+; / Ctrl+Shift+: 用）。
     * 編集中ならカーソル位置に挿入し、編集中でなければセルの値を直接その文字列に置き換える
     * （Excelの Ctrl+; がセルの内容をその場で日付に置き換えるのと同じ挙動）。
     */
    function insertQuickValue(text: string) {
        if (locked()) return;
        const editing = store.editingCell();
        if (editing) {
            const start = inputEl.selectionStart ?? inputEl.value.length;
            const end = inputEl.selectionEnd ?? inputEl.value.length;
            const { value: nextValue, caret } = spliceAtCursor(inputEl.value, start, end, text);
            inputEl.value = nextValue;
            setEditText(nextValue);
            inputEl.setSelectionRange(caret, caret);
            requestAnimationFrame(render);
        } else {
            const { row, col } = store.activeCell();
            const token: EditToken = store.setCellValue(row, col, text);
            void runOnChange(row, col, text, token);
        }
    }

    /** 選択範囲内で先頭行の内容・書式を下方向へコピーする（Ctrl+D） */
    function fillDownShortcut() {
        if (locked()) return;
        const range = store.selection().range;
        const token = store.fillDown(range);
        if (token && token.edits.length > 0) {
            const first = token.edits[0];
            void runOnChange(first.row, first.col, store.getCell(first.row, first.col), token);
        }
        requestAnimationFrame(render);
    }


    function ensureVisible(row: number, col: number) {
        const next = computeEnsureVisibleScroll(metrics(), store.scroll(), viewportSize(), row, col);
        store.setScroll(clampScroll(next.x, next.y));
    }

    /** 列ヘッダ上で、境界線付近(px)にいるかを判定し、あればその左側の列番号を返す */
    function findColumnBorderNearPx(px: number): number | null {
        return findColumnBorderNear({
            metrics: metrics(),
            cols: store.cols,
            headerWidth: store.headerWidth,
            scrollX: store.scroll().x,
            px,
            resizeHandlePx: RESIZE_HANDLE_PX,
        });
    }

    // ---------- クリップボード（コピー＆ペースト） ----------
    function cellRawText(row: number, col: number): string {
        const v = store.getCell(row, col);
        return v == null ? "" : String(v);
    }

    function handleCopy(e: ClipboardEvent) {
        if (store.editingCell()) return; // 編集中は通常のテキストコピーに任せる
        e.preventDefault();
        const range = store.selection().range;
        e.clipboardData?.setData("text/plain", buildClipboardText(range, cellRawText));
        setCopiedRange(range);
    }

    function handleCut(e: ClipboardEvent) {
        if (store.editingCell()) return;
        e.preventDefault();
        if (locked()) {
            // 読み取り専用のときは切り取りをコピーとして扱う（値は消さない）。onChange 処理中は何もしない
            if (props.readOnly && !busy()) {
                const range = store.selection().range;
                e.clipboardData?.setData("text/plain", buildClipboardText(range, cellRawText));
                setCopiedRange(range);
            }
            return;
        }
        const range = store.selection().range;
        e.clipboardData?.setData("text/plain", buildClipboardText(range, cellRawText));
        store.clearRange(range);
        setCopiedRange(range);
    }

    function handlePaste(e: ClipboardEvent) {
        if (store.editingCell()) return; // 編集中は通常のテキストペーストに任せる
        e.preventDefault();
        if (locked()) return; // onChange 処理中は変更操作を禁止
        const text = e.clipboardData?.getData("text/plain") ?? "";
        if (!text) return;
        const parsed = parseClipboardText(text);
        const start = { row: store.selection().range.r1, col: store.selection().range.c1 };
        // autoAppendRows 有効時は、貼り付け内容が現在の行数を超えても行を足して全部貼る（行追加も貼り付けと同じUndo単位）
        const growRows = store.autoAppendRows > 0;
        const range = computePasteRange({
            start,
            pastedRows: parsed.length,
            pastedCols: Math.max(1, ...parsed.map((r) => r.length)),
            totalRows: store.rows,
            totalCols: store.cols,
            growRows,
        });
        const { r2: endRow, c2: endCol } = range;

        const token: EditToken = store.setRangeValues(range, (r, c) => {
            const raw = parsed[r - start.row]?.[c - start.col];
            if (raw === undefined) return store.getCell(r, c);
            return coerceValue(raw, store.getFormat(r, c));
        }, { growRows });
        void runOnChange(start.row, start.col, store.getCell(start.row, start.col), token);

        store.setActiveCell(start);
        store.setSelection({ mode: "cell", anchor: start, focus: { row: endRow, col: endCol }, range });
        setCopiedRange(null);
        ensureVisible(start.row, start.col);
        requestAnimationFrame(render);
    }

    // ---------- マウス操作 ----------
    function handlePointerDown(e: PointerEvent) {
        // canvas はフォーカス不可能な要素なので、何もしないと mousedown のデフォルト動作で
        // 裏の input からフォーカスが外れてしまう（ダブルクリックでしか効かなくなる原因）。
        // preventDefault してブラウザのデフォルトのフォーカス処理を止める。
        e.preventDefault();

        const rect = canvasEl.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        // スクロールバードラッグ（実際にスクロールバーが表示されている場合のみ）
        const hit = scrollbarHitTest(px, py, rect.width, rect.height);
        if (hit.overVertical) {
            dragScrollbar = "v";
            dragScrollbarStartPx = e.clientY;
            dragScrollbarStartScroll = store.scroll().y;
            canvasEl.style.cursor = "default";
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
        }
        if (hit.overHorizontal) {
            dragScrollbar = "h";
            dragScrollbarStartPx = e.clientX;
            dragScrollbarStartScroll = store.scroll().x;
            canvasEl.style.cursor = "default";
            (e.target as Element).setPointerCapture(e.pointerId);
            return;
        }

        // 列幅リサイズ開始（列ヘッダの境界線付近をクリック）
        if (py < store.headerHeight && px >= store.headerWidth) {
            const borderCol = findColumnBorderNearPx(px);
            if (borderCol !== null) {
                if (store.editingCell()) commitEdit(0, 0);
                resizingCol = borderCol;
                resizeStartX = e.clientX;
                resizeStartWidth = store.colWidths[borderCol];
                document.body.style.cursor = "col-resize";
                (e.target as Element).setPointerCapture(e.pointerId);
                return;
            }
        }

        if (store.editingCell()) commitEdit(0, 0);

        const extend = e.shiftKey;

        // 列ヘッダクリック
        if (py < store.headerHeight && px >= store.headerWidth) {
            const cell = pixelToCell(store, metrics(), store.scroll(), px, store.headerHeight + 1);
            if (cell) {
                store.selectColumn(cell.col, extend);
                isSelecting = true;
            }
            inputEl.focus();
            requestAnimationFrame(render);
            return;
        }
        // 行ヘッダクリック
        if (px < store.headerWidth && py >= store.headerHeight) {
            const cell = pixelToCell(store, metrics(), store.scroll(), store.headerWidth + 1, py);
            if (cell) {
                store.selectRow(cell.row, extend);
                isSelecting = true;
            }
            inputEl.focus();
            requestAnimationFrame(render);
            return;
        }
        // 左上コーナー -> 全選択
        if (px < store.headerWidth && py < store.headerHeight) {
            store.selectAll();
            requestAnimationFrame(render);
            return;
        }

        const cell = pixelToCell(store, metrics(), store.scroll(), px, py);
        if (!cell) return;

        // pointerdown で preventDefault しているとブラウザは互換用マウスイベント
        // （click/dblclick）の発火を抑制することがあるため、ここで手動判定する。
        const clickPoint: ClickPoint = { row: cell.row, col: cell.col, x: px, y: py, time: performance.now() };
        const doubleClicked = isDoubleClick(lastClick, clickPoint, {
            maxIntervalMs: DOUBLE_CLICK_MS,
            maxDistancePx: DOUBLE_CLICK_PX,
        });
        lastClick = clickPoint;

        if (doubleClicked && !extend) {
            lastClick = null; // 3回連続クリックで再度ダブルクリック判定されないようにリセット
            store.selectCell(cell.row, cell.col);
            const value = store.getCell(cell.row, cell.col);
            const result = props.onCellDoubleClick?.({
                row: cell.row,
                col: cell.col,
                value,
                displayValue: formatCellValue(value, getEffectiveFormat(cell.row, cell.col)),
                event: e,
            });
            if (result !== false) {
                beginEdit(caretIndexFromClick(cell.row, cell.col, px));
            }
            requestAnimationFrame(render);
            return;
        }

        store.selectCell(cell.row, cell.col, extend);
        props.onActiveCellChange?.(cell.row, cell.col);
        isSelecting = true;
        inputEl.focus();
        requestAnimationFrame(render);
    }

    function handlePointerMove(e: PointerEvent) {
        if (resizingCol !== null) {
            const dx = e.clientX - resizeStartX;
            const newWidth = Math.max(MIN_COL_WIDTH, resizeStartWidth + dx);
            store.setColWidths(resizingCol, newWidth);
            requestAnimationFrame(render);
            return;
        }
        if (dragScrollbar) {
            const vp = viewportSize();
            if (dragScrollbar === "v") {
                const trackH = size().height - store.headerHeight - SCROLLBAR_SIZE;
                const ratio = scrollbarDragRatio({ viewport: vp.h, content: totalHeight(), scroll: store.scroll().y, track: trackH });
                const dy = (e.clientY - dragScrollbarStartPx) * ratio;
                store.setScroll(clampScroll(store.scroll().x, dragScrollbarStartScroll + dy));
            } else {
                const trackW = size().width - store.headerWidth - SCROLLBAR_SIZE;
                const ratio = scrollbarDragRatio({ viewport: vp.w, content: totalWidth(), scroll: store.scroll().x, track: trackW });
                const dx = (e.clientX - dragScrollbarStartPx) * ratio;
                store.setScroll(clampScroll(dragScrollbarStartScroll + dx, store.scroll().y));
            }
            requestAnimationFrame(render);
            return;
        }
        if (!isSelecting) return;
        const rect = canvasEl.getBoundingClientRect();
        const px = clamp(e.clientX - rect.left, store.headerWidth, rect.width - SCROLLBAR_SIZE - 1);
        const py = clamp(e.clientY - rect.top, store.headerHeight, rect.height - SCROLLBAR_SIZE - 1);
        const cell = pixelToCell(store, metrics(), store.scroll(), px, py);
        if (!cell) return;
        const mode = store.selection().mode;
        if (mode === "col") store.selectColumn(cell.col, true);
        else if (mode === "row") store.selectRow(cell.row, true);
        else store.selectCell(cell.row, cell.col, true);
        requestAnimationFrame(render);
    }

    function handlePointerUp() {
        if (resizingCol !== null) {
            const col = resizingCol;
            const after = store.colWidths[col];
            resizingCol = null;
            document.body.style.cursor = "";
            store.recordColumnWidthChange(col, resizeStartWidth, after);
            requestAnimationFrame(render);
        }
        if (dragScrollbar) {
            canvasEl.style.cursor = "cell";
        }
        isSelecting = false;
        dragScrollbar = null;
    }

    function handleHoverMove(e: PointerEvent) {
        // ドラッグ中（範囲選択・スクロールバー・リサイズ）はこちらでは何もしない
        if (isSelecting || dragScrollbar || resizingCol !== null) return;
        if (busy()) {
            canvasEl.style.cursor = "wait";
            return;
        }
        const rect = canvasEl.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        const hit = scrollbarHitTest(px, py, rect.width, rect.height);
        if (hit.overVertical || hit.overHorizontal) {
            canvasEl.style.cursor = "default";
            return;
        }

        if (py < store.headerHeight && px >= store.headerWidth && findColumnBorderNearPx(px) !== null) {
            canvasEl.style.cursor = "col-resize";
        } else {
            canvasEl.style.cursor = "cell";
        }
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const { x, y } = store.scroll();
        store.setScroll(clampScroll(x + e.deltaX, y + e.deltaY));
        requestAnimationFrame(render);
    }

    // ---------- キーボード / IME ----------
    function handleInput() {
        if (locked()) return; // onChange 処理中は編集開始を禁止
        if (!store.editingCell() && inputEl.value !== "") {
            // 直接入力（IME含む）でセル編集を開始
            const target = store.activeCell();
            store.setEditingCell(target);
            openDropdownIfNeeded(target.row, target.col);
            requestAnimationFrame(render);
        }
        setEditText(inputEl.value);
    }

    function handleCompositionStart() {
        if (locked()) return; // onChange 処理中は編集開始を禁止
        composing = true;
        if (!store.editingCell()) {
            const target = store.activeCell();
            store.setEditingCell(target);
            openDropdownIfNeeded(target.row, target.col);
            requestAnimationFrame(render);
        }
    }
    function handleCompositionEnd() {
        composing = false;
        setEditText(inputEl.value);
    }

    /** input への実際のテキスト挿入（IMEの確定含む）を、busy中は最終防衛ラインとして止める */
    function handleBeforeInput(e: InputEvent) {
        if (locked()) e.preventDefault();
    }

    function handleKeyDown(e: KeyboardEvent) {
        const editing = store.editingCell();
        const bindings = keyBindings();
        const is = (action: GridAction) => matchesAction(e, action, bindings);

        if (is("cancelEdit")) {
            if (editing) {
                e.preventDefault();
                cancelEdit();
            } else if (copiedRange()) {
                setCopiedRange(null);
            }
            return;
        }

        if (composing) return; // IME変換中はナビゲーションキーを奪わない

        // 日付・時刻の挿入（編集中かどうかに関わらず使える。編集中はカーソル位置に挿入する）
        if (is("insertTime")) {
            e.preventDefault();
            insertQuickValue(formatNowTime());
            return;
        }
        if (is("insertDate")) {
            e.preventDefault();
            insertQuickValue(formatTodayDate());
            return;
        }

        // 編集中にドロップダウンが開いていれば、上下キーはハイライト移動に使う
        if (editing && dropdown()) {
            const list = filteredOptions();
            if (is("arrowDown") && list.length > 0) {
                e.preventDefault();
                setHighlightedIndex((i) => clampHighlightIndex(i, list.length, 1));
                return;
            }
            if (is("arrowUp") && list.length > 0) {
                e.preventDefault();
                setHighlightedIndex((i) => clampHighlightIndex(i, list.length, -1));
                return;
            }
        }

        if (is("commitEnter")) {
            e.preventDefault();
            if (editing) {
                const list = dropdown() ? filteredOptions() : [];
                const idx = highlightedIndex();
                if (idx >= 0 && idx < list.length) selectDropdownOption(list[idx], 1, 0);
                else commitEdit(1, 0);
            } else if (e.altKey) beginEdit();
            else moveActive(e.shiftKey ? -1 : 1, 0, false);
            return;
        }
        if (is("commitTab")) {
            e.preventDefault();
            if (editing) {
                const list = dropdown() ? filteredOptions() : [];
                const idx = highlightedIndex();
                if (idx >= 0 && idx < list.length) selectDropdownOption(list[idx], 0, e.shiftKey ? -1 : 1);
                else commitEdit(0, e.shiftKey ? -1 : 1);
            } else moveActive(0, e.shiftKey ? -1 : 1, false);
            return;
        }
        if (is("editF2")) {
            e.preventDefault();
            if (!editing && !locked()) beginEdit();
            return;
        }

        if (!editing) {
            if (is("undo")) {
                e.preventDefault();
                if (!locked()) {
                    store.undo();
                    const ac = store.activeCell();
                    ensureVisible(ac.row, ac.col);
                    requestAnimationFrame(render);
                }
                return;
            }
            if (is("redo")) {
                e.preventDefault();
                if (!locked()) {
                    store.redo();
                    const ac = store.activeCell();
                    ensureVisible(ac.row, ac.col);
                    requestAnimationFrame(render);
                }
                return;
            }
            if (is("selectAll")) {
                e.preventDefault();
                store.selectAll();
                requestAnimationFrame(render);
                return;
            }
            if (is("fillDown")) {
                // 選択範囲内で上のセルの内容・書式を下方向にコピーする
                e.preventDefault();
                fillDownShortcut();
                return;
            }
            if (is("documentHome")) {
                // ワークシートの先頭 (A1) セルへ移動
                e.preventDefault();
                moveActiveTo(0, 0, false);
                return;
            }
            if (is("documentEnd")) {
                // データが入っている最も右・最も下のセルへ移動
                e.preventDefault();
                const used = store.findUsedRange();
                moveActiveTo(used.row, used.col, false);
                return;
            }

            const arrowMap: Partial<Record<GridAction, [number, number]>> = {
                arrowUp: [-1, 0],
                arrowDown: [1, 0],
                arrowLeft: [0, -1],
                arrowRight: [0, 1],
            };
            for (const action in arrowMap) {
                if (is(action as GridAction)) {
                    e.preventDefault();
                    const [dr, dc] = arrowMap[action as GridAction]!;
                    moveActive(dr, dc, e.shiftKey);
                    return;
                }
            }
            if (is("home")) {
                // 現在行の先頭列(A列など)へ移動。Shift+Home なら選択を拡張する
                e.preventDefault();
                const rowRef = e.shiftKey ? store.selection().focus.row : store.activeCell().row;
                moveActiveTo(rowRef, 0, e.shiftKey);
                return;
            }
            if (is("end")) {
                // 現在行の最終列へ移動
                e.preventDefault();
                const rowRef = e.shiftKey ? store.selection().focus.row : store.activeCell().row;
                moveActiveTo(rowRef, store.cols - 1, e.shiftKey);
                return;
            }
            if (is("deleteCell")) {
                e.preventDefault();
                if (!locked()) {
                    const range = store.selection().range;
                    // セル範囲をクリアしつつ、変更されたトークンを取得する
                    const token: EditToken = store.clearRange(range);

                    // 範囲内の先頭セルなどを基準にして onChange を呼ぶ（または必要に応じて各セル）
                    if (token && token.edits.length > 0) {
                        const first = token.edits[0];
                        void runOnChange(first.row, first.col, store.getCell(first.row, first.col), token);
                    }
                    requestAnimationFrame(render);
                }
                return;
            }
        }
    }

    function jumpToCell(row: number, col: number) {
        const r = clamp(row, 0, store.rows - 1);
        const c = clamp(col, 0, store.cols - 1);

        // セルを選択
        store.selectCell(r, c, false);
        props.onActiveCellChange?.(r, c);

        // 画面内に表示されるようにスクロールを調整
        ensureVisible(r, c);

        // 必要に応じて入力欄にフォーカスを戻し、再描画
        inputEl.focus();
        requestAnimationFrame(render);
    }

    function focus() {
        inputEl.focus();
    }

    // ---------- ライフサイクル ----------
    onMount(() => {
        const ro = new ResizeObserver((entries) => {
            const box = entries[0].contentRect;
            setSize({ width: box.width, height: box.height });
        });
        ro.observe(rootEl);
        onCleanup(() => ro.disconnect());

        canvasEl.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        canvasEl.addEventListener("pointermove", handleHoverMove);
        canvasEl.addEventListener("wheel", handleWheel, { passive: false });
        inputEl.addEventListener("beforeinput", handleBeforeInput);
        onCleanup(() => {
            canvasEl.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            canvasEl.removeEventListener("pointermove", handleHoverMove);
            canvasEl.removeEventListener("wheel", handleWheel);
            inputEl.removeEventListener("beforeinput", handleBeforeInput);
        });

        inputEl.focus();
    });

    // busy中は input を readOnly にして、IME確定を含む書き込みを二重に防ぐ
    createEffect(() => {
        inputEl.readOnly = locked();
    });

    // 編集中に読み取り専用へ切り替えられたら、入力中の内容を破棄して編集を終える
    createEffect(() => {
        if (props.readOnly && store.editingCell()) cancelEdit();
    });

    // busy の変化を親コンポーネントへ通知
    createEffect(() => {
        props.onBusyChange?.(busy());
    });

    // 行数が減った（Undo で自動追加行が取り除かれた）とき、スクロール位置とコピー枠が範囲外にならないよう補正する
    createEffect(() => {
        totalHeight();
        const cur = untrack(() => store.scroll());
        const clamped = clampScroll(cur.x, cur.y);
        if (clamped.x !== cur.x || clamped.y !== cur.y) store.setScroll(clamped);
        const cr = untrack(copiedRange);
        if (cr && cr.r2 >= store.rows) setCopiedRange(null);
    });

    // 行数の変化を親コンポーネントへ通知（初回は通知しない）
    let lastNotifiedRows = store.rows;
    createEffect(() => {
        const rows = store.rows;
        if (rows !== lastNotifiedRows) {
            lastNotifiedRows = rows;
            props.onRowsChange?.(rows);
        }
    });

    createEffect(() => {
        const s = size();
        if (s.width === 0 || s.height === 0) return;
        canvasEl.width = s.width * dpr();
        canvasEl.height = s.height * dpr();
        canvasEl.style.width = `${s.width}px`;
        canvasEl.style.height = `${s.height}px`;
        render();
    });

    // data/selection/scroll の変化を購読して再描画
    createEffect(() => {
        store.data.cells;
        store.data.formats;
        store.selection();
        store.activeCell();
        store.editingCell();
        store.scroll();
        store.colWidths;
        store.rowHeights;
        copiedRange();
        render();
    });

    // ---------- ref のセッター（.tsx 側の JSX から呼ばれる） ----------
    function setRootEl(el: HTMLDivElement) {
        rootEl = el;
    }
    function setCanvasEl(el: HTMLCanvasElement) {
        canvasEl = el;
    }
    function setInputEl(el: HTMLInputElement) {
        inputEl = el;
    }

    const controller = {
        store,
        theme,
        setRootEl,
        setCanvasEl,
        setInputEl,
        handleInput,
        handleCompositionStart,
        handleCompositionEnd,
        handleKeyDown,
        handleCopy,
        handleCut,
        handlePaste,
        handleBlur: () => {
            if (store.editingCell() && !composing) commitEdit(0, 0);
        },
        dropdown,
        filteredOptions,
        highlightedIndex,
        setHighlightedIndex,
        selectDropdownOption,
        cellRect,
        jumpToCell,
        focus,
    };
    props.ref?.(controller);
    return controller;
}

export type GridController = ReturnType<typeof createGridController>;
