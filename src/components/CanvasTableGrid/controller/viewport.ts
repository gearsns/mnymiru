/**
 * 【部品: controller / ビューポート（座標系）】
 * canvas のサイズ、列・行のオフセット表、pane ごとの表示サイズとスクロール範囲、
 * 「ピクセル ⇔ セル」の変換、セルを画面内に表示するスクロール補正、スクロールバーと分割バーの当たり判定。
 * 座標の計算そのものは lib/geometry・lib/scrollbar・lib/split の純粋関数に任せ、ここは store と結びつけるだけ。
 *
 * 分割（左右・上下の pane）している場合、スクロールは pane ごとに独立していて、同じ軸を共有する pane は同じ量を使う:
 *   x … 右 pane の横、y … 下 pane の縦、lx … 左 pane の横、ty … 上 pane の縦（分割しなければ x / y が表全体）
 * 各 pane のスクロール範囲は、その pane のコンテンツの大きさと見えている大きさから決まる。
 */
import { createEffect, createMemo, createSignal, untrack } from "solid-js";
import {
    cellRect as computeCellRect,
    clamp,
    computeEnsureVisibleScroll,
    computeMetrics,
    findColumnBorderNear,
    paneExtent,
    paneGap,
    pixelToCell,
    type PaneViewport,
    type ScrollPosition,
} from "../lib/geometry";
import { SCROLLBAR_SIZE, computeScrollbars, hitScrollbar } from "../lib/scrollbar";
import { hitSplitBar, maxPaneHeight, maxPaneWidth } from "../lib/split";
import type { GridContext } from "./context";

export const RESIZE_HANDLE_PX = 5;

export function createViewport(ctx: GridContext) {
    const { store } = ctx;

    const [size, setSize] = createSignal({ width: 0, height: 0 });
    const metrics = createMemo(() => computeMetrics(store));

    /** 左 pane の表示幅 w・上 pane の表示高さ h（px。分割していない軸は 0） */
    const paneSize = createMemo(() => paneExtent(store, metrics()));

    /** 分割バーの隙間（px。分割モードで分割している軸だけ SPLIT_BAR_SIZE、それ以外は 0）。右・下の pane はこの分だけずれる */
    const gap = createMemo(() => paneGap(store));

    /** 各 pane のコンテンツ全体の大きさ（左 = 左の列の合計幅、右 = 残りの列の合計幅、上・下も同様） */
    const content = createMemo(() => {
        const m = metrics();
        const k = store.splitCols;
        const n = store.splitRows;
        return {
            left: m.colOffsets[k],
            right: m.colOffsets[store.cols] - m.colOffsets[k],
            top: m.rowOffsets[n],
            bottom: m.rowOffsets[store.rows] - m.rowOffsets[n],
        };
    });

    /** 各 pane の、スクロールする領域の見えている大きさ（スクロールバーの分を除く） */
    function paneViewport(): PaneViewport {
        const s = size();
        const p = paneSize();
        return {
            leftW: p.w,
            rightW: Math.max(0, s.width - store.headerWidth - SCROLLBAR_SIZE - p.w - gap().w),
            topH: p.h,
            bottomH: Math.max(0, s.height - store.headerHeight - SCROLLBAR_SIZE - p.h - gap().h),
        };
    }

    /** スクロール位置を、各 pane のスクロール範囲に収める */
    function clampScroll(s: ScrollPosition): Required<ScrollPosition> {
        const v = paneViewport();
        const c = content();
        return {
            x: clamp(s.x, 0, Math.max(0, c.right - v.rightW)),
            y: clamp(s.y, 0, Math.max(0, c.bottom - v.bottomH)),
            lx: clamp(s.lx ?? 0, 0, Math.max(0, c.left - v.leftW)),
            ty: clamp(s.ty ?? 0, 0, Math.max(0, c.top - v.topH)),
        };
    }

    /** セル(row,col)の canvas ローカル座標での矩形 */
    function cellRect(row: number, col: number) {
        return computeCellRect(store, metrics(), store.scroll(), row, col);
    }

    /** ピクセル座標 -> セル位置。ヘッダ領域内なら null */
    function hitCell(px: number, py: number) {
        return pixelToCell(store, metrics(), store.scroll(), px, py);
    }

    /** 表示するスクロールバー（pane ごと。内容が収まっている pane のバーは含まれない） */
    const scrollbars = createMemo(() =>
        computeScrollbars({
            width: size().width,
            height: size().height,
            headerWidth: store.headerWidth,
            headerHeight: store.headerHeight,
            leftW: paneSize().w,
            topH: paneSize().h,
            splitCols: store.splitCols,
            splitRows: store.splitRows,
            gapW: gap().w,
            gapH: gap().h,
            content: content(),
            scroll: store.scroll(),
            freeze: store.splitMode === "freeze",
        })
    );

    /** 座標 (px, py) がスクロールバー（実際に表示されているもの）の上なら、そのバー。クリック判定・ホバー時のカーソル変更の両方で使う */
    function scrollbarAt(px: number, py: number) {
        return hitScrollbar(scrollbars(), px, py);
    }

    /** 座標 (px, py) が分割の境界のバーの上なら、その向き（縦・横・交点）。サイズ変更できない設定のときは null */
    function splitBarAt(px: number, py: number) {
        if (!store.splitResizable) return null;
        const s = size();
        return hitSplitBar({
            px,
            py,
            width: s.width,
            height: s.height,
            headerWidth: store.headerWidth,
            headerHeight: store.headerHeight,
            leftW: paneSize().w,
            topH: paneSize().h,
            splitCols: store.splitCols,
            splitRows: store.splitRows,
            gapW: gap().w,
            gapH: gap().h,
        });
    }

    /** 列ヘッダ上で、境界線付近(px)にいるかを判定し、あればその左側の列番号を返す */
    function findColumnBorderNearPx(px: number): number | null {
        const sc = store.scroll();
        return findColumnBorderNear({
            metrics: metrics(),
            cols: store.cols,
            headerWidth: store.headerWidth,
            scrollX: sc.x,
            px,
            resizeHandlePx: RESIZE_HANDLE_PX,
            splitCols: store.splitCols,
            leftWidth: paneSize().w,
            leftScrollX: sc.lx,
            gap: gap().w,
        });
    }

    /** 指定したセルが見えるようにスクロール位置を補正する（そのセルが属する pane のスクロールだけが動く） */
    function ensureVisible(row: number, col: number) {
        const next = computeEnsureVisibleScroll(metrics(), store.scroll(), paneViewport(), row, col, {
            rows: store.splitRows,
            cols: store.splitCols,
        });
        store.setScroll(clampScroll(next));
    }

    // 行数が減った（Undo で自動追加行が取り除かれた）・サイズや分割が変わったとき、スクロール位置が範囲外にならないよう補正する
    createEffect(() => {
        content();
        paneViewport();
        const cur = untrack(() => store.scroll());
        const clamped = clampScroll(cur);
        if (clamped.x !== cur.x || clamped.y !== cur.y || clamped.lx !== cur.lx || clamped.ty !== cur.ty) store.setScroll(clamped);
    });

    // 画面が小さくなって pane が収まらなくなったら、上限まで縮める（右・下の pane に最低限の大きさを残す）。固定モードでは pane のサイズは変えない
    createEffect(() => {
        const s = size();
        if (s.width === 0 || s.height === 0) return;
        if (store.splitMode !== "split") return;
        const p = paneSize();
        if (store.splitCols > 0) {
            const max = maxPaneWidth(s.width, store.headerWidth);
            if (p.w > max) store.setSplit({ leftWidth: max });
        }
        if (store.splitRows > 0) {
            const max = maxPaneHeight(s.height, store.headerHeight);
            if (p.h > max) store.setSplit({ topHeight: max });
        }
    });

    return {
        size,
        setSize,
        metrics,
        paneSize,
        gap,
        content,
        paneViewport,
        clampScroll,
        cellRect,
        hitCell,
        scrollbars,
        scrollbarAt,
        splitBarAt,
        findColumnBorderNearPx,
        ensureVisible,
    };
}

export type Viewport = ReturnType<typeof createViewport>;
