/**
 * 【部品: controller / 行のドラッグ＆ドロップ】
 * 選択済みの行番号（行ヘッダ）をドラッグして、行を並べ替える／ツリーの階層を変える。
 *
 * 操作の流れ:
 *   1. 行ヘッダで行を選択（行選択）しておく。選択済みの行番号の上ではカーソルが「掴める手」になる
 *   2. その行番号を押したまま動かすと、ドラッグが始まる（動かさずに離せば、通常のクリック＝その行だけの選択）
 *   3. ドラッグ中は、行の上端・下端・中央でドロップ位置（前／後ろ／子にする）が切り替わる。
 *      画面の上下の端に近づくと自動でスクロールする。Esc で取り消し
 *   4. 離すと移動する（Undo 1回で戻る）。移動できない位置（自分や自分の子孫の中など）では「禁止」カーソルになり、何も起きない
 *
 * 移動の内容の判定は store.previewMoveRows、実行は actions.moveRows に任せ、ここは「操作」だけを扱う。
 * 有効にするのは props.rowDrag。読み取り専用・onChange 処理中は動かせない。
 */
import { clamp } from "../lib/geometry";
import { SCROLLBAR_SIZE } from "../lib/scrollbar";
import type { DropPosition } from "../types";
import type { Actions } from "./actions";
import type { ChangeRunner } from "./changeRunner";
import type { GridContext } from "./context";
import type { RowDragState } from "./rowDragState";
import type { Viewport } from "./viewport";

/** ドラッグを始めるまでに動かす距離(px)。これ未満なら通常のクリック */
const DRAG_THRESHOLD = 4;
/** 画面の上下の端から、自動スクロールを始める距離(px) */
const AUTO_SCROLL_EDGE = 28;
const AUTO_SCROLL_INTERVAL_MS = 40;
const AUTO_SCROLL_MAX_STEP = 30;

export function createRowDrag(
    ctx: GridContext,
    deps: { viewport: Viewport; actions: Actions; changes: ChangeRunner; dragState: RowDragState; requestRender: () => void }
) {
    const { props, store, els } = ctx;
    const { viewport, actions, changes, dragState, requestRender } = deps;

    /** 押したが、まだドラッグになっていない（動かさずに離せば通常のクリック） */
    let pending: { row: number; x: number; y: number } | null = null;
    let active: {
        sources: number[];
        r1: number;
        r2: number;
        /** 最後のポインタ位置（clientX / clientY）。自動スクロール中の再判定に使う */
        x: number;
        y: number;
        /** 前回判定したドロップ位置。変わらなければ判定をやり直さない */
        key: string;
        target: { row: number; position: DropPosition; level: number } | null;
    } | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const isActive = () => active !== null;
    const isPending = () => pending !== null;

    /** 選択されている行の範囲（行選択のときだけ） */
    function selectedRows(): { r1: number; r2: number } | null {
        const sel = store.selection();
        return sel.mode === "row" ? { r1: sel.range.r1, r2: sel.range.r2 } : null;
    }

    /** その行の行番号から、ドラッグを始められるか（有効・編集可能・その行が行選択に含まれている） */
    function canStartAt(row: number): boolean {
        if (!props.rowDrag || changes.locked()) return false;
        const rg = selectedRows();
        return !!rg && row >= rg.r1 && row <= rg.r2;
    }

    /** 行ヘッダを押したとき。ドラッグの準備ができたら true（通常の行選択は行わない） */
    function begin(row: number, e: PointerEvent): boolean {
        if (e.shiftKey || !canStartAt(row)) return false;
        pending = { row, x: e.clientX, y: e.clientY };
        return true;
    }

    /** canvas 上のローカル y 座標 → ドロップ先（行と位置）。ツリーは上・中・下の3分割、そうでなければ上下の2分割 */
    function locate(localY: number): { row: number; position: DropPosition } {
        const rect = els.canvas.getBoundingClientRect();
        const y = clamp(localY, store.headerHeight + 1, rect.height - SCROLLBAR_SIZE - 1);
        const cell = viewport.hitCell(store.headerWidth + 1, y)!;
        const r = viewport.cellRect(cell.row, 0);
        const frac = (localY - r.y) / r.h;
        const position: DropPosition = store.treeEnabled
            ? frac < 0.25
                ? "before"
                : frac > 0.75
                  ? "after"
                  : "inside"
            : frac < 0.5
              ? "before"
              : "after";
        return { row: cell.row, position };
    }

    function setCursor(value: string) {
        els.canvas.style.cursor = value;
    }

    /** 現在のポインタ位置でドロップ先を判定し、表示を更新する */
    function update() {
        if (!active) return;
        const rect = els.canvas.getBoundingClientRect();
        const loc = locate(active.y - rect.top);
        const key = `${loc.row}:${loc.position}`;
        if (key === active.key) return;
        active.key = key;

        // 移動できる位置か（自分や子孫の中・動きなし・canMoveRows で拒否 は不可）
        const info = store.previewMoveRows(active.sources, loc);
        const allowed = !!info && props.canMoveRows?.(info) !== false;
        active.target = allowed ? { row: loc.row, position: loc.position, level: info!.level } : null;
        dragState.setDragState({ sources: { r1: active.r1, r2: active.r2 }, target: active.target });
        setCursor(allowed ? "grabbing" : "not-allowed");
        requestRender();
    }

    /** 画面の上下の端に近いとき、行をスクロールする */
    function autoScroll() {
        if (!active) return;
        const rect = els.canvas.getBoundingClientRect();
        const localY = active.y - rect.top;
        const top = store.headerHeight + viewport.paneSize().h + viewport.gap().h; // 上 pane（と分割バー）の下から（上 pane はこのスクロールの対象外）
        const bottom = rect.height - SCROLLBAR_SIZE;
        let dy = 0;
        if (localY < top + AUTO_SCROLL_EDGE) dy = -Math.min(AUTO_SCROLL_MAX_STEP, Math.ceil((top + AUTO_SCROLL_EDGE - localY) / 3));
        else if (localY > bottom - AUTO_SCROLL_EDGE) dy = Math.min(AUTO_SCROLL_MAX_STEP, Math.ceil((localY - (bottom - AUTO_SCROLL_EDGE)) / 3));
        if (dy === 0) return;
        const s = store.scroll();
        const next = viewport.clampScroll({ ...s, y: s.y + dy });
        if (next.y === s.y) return;
        store.setScroll(next);
        active.key = ""; // スクロールで同じ座標の行が変わるので、判定をやり直す
        update();
    }

    function activate() {
        const rg = selectedRows();
        pending = null;
        if (!rg) return;
        const sources: number[] = [];
        for (let r = rg.r1; r <= rg.r2; r++) sources.push(r);
        active = { sources, r1: rg.r1, r2: rg.r2, x: 0, y: 0, key: "", target: null };
        timer = setInterval(autoScroll, AUTO_SCROLL_INTERVAL_MS);
    }

    /** ドラッグ（または準備）を終え、表示を元に戻す */
    function stop() {
        if (timer !== null) clearInterval(timer);
        timer = null;
        active = null;
        pending = null;
        dragState.setDragState(null);
        setCursor("cell");
    }

    function move(e: PointerEvent) {
        if (pending && !active) {
            if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < DRAG_THRESHOLD) return;
            activate();
        }
        if (!active) return;
        active.x = e.clientX;
        active.y = e.clientY;
        update();
    }

    function up(e: PointerEvent) {
        if (active) {
            active.x = e.clientX;
            active.y = e.clientY;
            active.key = "";
            update();
            const { sources, target } = active;
            stop();
            if (target) actions.moveRows(sources, target);
            requestRender();
            return;
        }
        if (pending) {
            // 動かさずに離した: 通常の行ヘッダのクリック（その行だけを選択）
            const row = pending.row;
            stop();
            store.selectRow(row, false);
            els.input.focus();
            requestRender();
        }
    }

    /** Esc などでドラッグを取り消す（移動はしない） */
    function cancel() {
        const wasActive = active !== null;
        stop();
        if (wasActive) requestRender();
    }

    return { isActive, isPending, canStartAt, begin, move, up, cancel };
}

export type RowDrag = ReturnType<typeof createRowDrag>;
