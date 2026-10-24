/**
 * 【部品: controller / 組み立て】
 * CanvasTableGrid の振る舞いを、controller/ の各部品を組み合わせて作る。
 * ここにロジックは置かない（部品の生成順と、DOM への取り付けだけ）。
 *
 * 部品の依存の向き（左が先に作られる／右は左の部品を使う）:
 *
 *   context ─ copiedRange ─ viewport ─ inputOverlay ─ renderer ─ changeRunner
 *      ─ dropdownState ─ navigation ─ editor ─ actions ─ clipboard ─ pointer ─ keyboard
 *
 * 新しい部品を足すときは、依存する部品より後ろで作り、必要なものだけ引数で受け取る。
 */
import { onCleanup, onMount } from "solid-js";
import { createActions } from "./actions";
import { createChangeRunner } from "./changeRunner";
import { createClipboard } from "./clipboard";
import { createGridContext } from "./context";
import { createCopiedRange } from "./copiedRange";
import { createDropdownState } from "./dropdownState";
import { createEditor } from "./editor";
import { createInputOverlay } from "./inputOverlay";
import { createKeyboard } from "./keyboard";
import { createNavigation } from "./navigation";
import { bindParentNotifications } from "./notifications";
import { createPointer } from "./pointer";
import type { CanvasTableGridProps } from "./props";
import { createRenderer } from "./renderer";
import { createRowDrag } from "./rowDrag";
import { createRowDragState } from "./rowDragState";
import { createViewport } from "./viewport";

export function createGridController(props: CanvasTableGridProps) {
    const ctx = createGridContext(props);
    const { store, theme, els } = ctx;

    // 親への通知は他の effect より先に登録する（初回通知の順序：選択範囲 → busy）
    bindParentNotifications(ctx);
    const copied = createCopiedRange(ctx);
    const viewport = createViewport(ctx);
    const overlay = createInputOverlay(ctx, viewport);
    const rowDragState = createRowDragState();
    const renderer = createRenderer(ctx, { viewport, copied, overlay, rowDragState });
    const { render, requestRender } = renderer;
    const changes = createChangeRunner(ctx, requestRender);
    const dropdown = createDropdownState(ctx);
    const navigation = createNavigation(ctx, viewport, requestRender);
    const editor = createEditor(ctx, { overlay, dropdown, navigation, changes, requestRender, render });
    const actions = createActions(ctx, { viewport, changes, dropdown, navigation, requestRender });
    const clipboard = createClipboard(ctx, { viewport, changes, copied, requestRender });
    const rowDrag = createRowDrag(ctx, { viewport, actions, changes, dragState: rowDragState, requestRender });
    const pointer = createPointer(ctx, { viewport, overlay, editor, changes, actions, rowDrag, requestRender });
    const keyboard = createKeyboard(ctx, { editor, actions, navigation, dropdown, copied, changes, rowDrag });

    // ---------- ライフサイクル ----------
    onMount(() => {
        const ro = new ResizeObserver((entries) => {
            const box = entries[0].contentRect;
            viewport.setSize({ width: box.width, height: box.height });
        });
        ro.observe(els.root);
        onCleanup(() => ro.disconnect());

        const unbindPointer = pointer.bind();
        els.input.addEventListener("beforeinput", editor.handleBeforeInput);
        onCleanup(() => {
            rowDrag.cancel(); // ドラッグ中に外されたら、自動スクロールのタイマーを止める
            unbindPointer();
            els.input.removeEventListener("beforeinput", editor.handleBeforeInput);
        });

        els.input.focus();
    });

    // 再描画の effect は、onMount（サイズ設定）より後に登録する
    renderer.startRedraw();

    // ---------- ref のセッター（.tsx 側の JSX から呼ばれる） ----------
    function setRootEl(el: HTMLDivElement) {
        els.root = el;
    }
    function setCanvasEl(el: HTMLCanvasElement) {
        els.canvas = el;
    }
    function setInputEl(el: HTMLInputElement) {
        els.input = el;
    }

    const controller = {
        store,
        theme,
        setRootEl,
        setCanvasEl,
        setInputEl,
        handleInput: editor.handleInput,
        handleCompositionStart: editor.handleCompositionStart,
        handleCompositionEnd: editor.handleCompositionEnd,
        handleKeyDown: keyboard.handleKeyDown,
        handleCopy: clipboard.handleCopy,
        handleCut: clipboard.handleCut,
        handlePaste: clipboard.handlePaste,
        handleBlur: editor.handleBlur,
        dropdown: dropdown.dropdown,
        filteredOptions: dropdown.filteredOptions,
        highlightedIndex: dropdown.highlightedIndex,
        setHighlightedIndex: dropdown.setHighlightedIndex,
        selectDropdownOption: editor.selectDropdownOption,
        cellRect: viewport.cellRect,
        jumpToCell: navigation.jumpToCell,
        focus: () => els.input.focus(),
    };
    props.ref?.(controller);
    return controller;
}

export type GridController = ReturnType<typeof createGridController>;
