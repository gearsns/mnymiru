/**
 * 【部品: store / ツリーの状態】
 * 各データ行の階層の深さ(levels)と、開閉状態(expanded)。
 * 「どの行が見えるか」の計算は rowModel.ts、開閉操作と選択の付け替えは treeOps.ts が担当する。
 *
 * ツリーを使わない（options.tree が無い）場合は何も保持せず、各操作は何もしない。
 * 配列は不変（更新のたびに新しい配列に置き換える）で、signal で購読される。
 *
 * 開閉状態（expanded）は閲覧の操作の結果なので、Undo/Redo の対象にしない（履歴には積まない）。
 * ソート・行の移動では、開閉状態は行と一緒に動く（permuteExpanded）が、Undo はその並べ替えを元に戻すだけで、
 * 利用者が行った開閉は巻き戻さない。
 */
import { createSignal } from "solid-js";
import { initExpanded, normalizeLevels, parentOf } from "../lib/tree";
import type { GridOptions } from "../types";

export function createTreeState(options: GridOptions) {
    const cfg = options.tree;
    const enabled = !!cfg;
    const [levels, setLevels] = createSignal<number[]>(enabled ? normalizeLevels(cfg!.levels, options.rows) : []);
    const [expanded, setExpanded] = createSignal<boolean[]>(enabled ? initExpanded(cfg!.expanded, options.rows) : []);
    /** 構造（階層・開閉）が変わるたびに増える。コピー枠のように「行の位置に依存する表示」を消すのに使う */
    const [version, setVersion] = createSignal(0);
    const bump = () => setVersion((v) => v + 1);

    /** 末尾に n 行追加された（新しい行はルート階層・展開状態） */
    function append(n: number) {
        if (!enabled || n <= 0) return;
        setLevels((l) => [...l, ...Array<number>(n).fill(0)]);
        setExpanded((e) => [...e, ...Array<boolean>(n).fill(true)]);
    }

    /** 行数が count に減った（末尾の行が取り除かれた） */
    function truncate(count: number) {
        if (!enabled) return;
        setLevels((l) => l.slice(0, count));
        setExpanded((e) => e.slice(0, count));
    }

    /** データ全体の差し替え。levels を省略するとすべてルート階層（平坦）になる */
    function reset(count: number, newLevels?: ArrayLike<number>, newExpanded?: boolean | boolean[] | ((row: number) => boolean)) {
        if (!enabled) return;
        setLevels(normalizeLevels(newLevels, count));
        setExpanded(initExpanded(newExpanded, count));
        bump();
    }

    /** 行 start から始まる範囲の階層を丸ごと置き換える（ソート・行の移動の Undo/Redo 用） */
    function patchLevels(start: number, newLevels: number[]) {
        if (!enabled) return;
        const l = levels().slice();
        newLevels.forEach((v, i) => (l[start + i] = v));
        setLevels(l);
        bump();
    }

    /**
     * 開閉状態を、行の並べ替え（order）に合わせて動かす。order[i] = 「start + i 行目に来る、元の行」。
     * 開閉状態は「行に付いて」動く。値を上書きするのではなく現在の状態を並べ替えるだけなので、
     * 並べ替えのあとに利用者が行った開閉は失われない。
     */
    function permuteExpanded(start: number, order: number[]) {
        if (!enabled) return;
        const cur = expanded();
        const e = cur.slice();
        order.forEach((old, i) => (e[start + i] = cur[old]));
        setExpanded(e);
        bump();
    }

    /** permuteExpanded の逆（元の並びに戻す）。やはり現在の状態を並べ替えるだけで、開閉は上書きしない */
    function unpermuteExpanded(start: number, order: number[]) {
        if (!enabled) return;
        const cur = expanded();
        const e = cur.slice();
        order.forEach((old, i) => (e[old] = cur[start + i]));
        setExpanded(e);
        bump();
    }

    /** 行 row の開閉状態を設定する */
    function setExpandedAt(row: number, value: boolean) {
        if (!enabled || expanded()[row] === value) return;
        const e = expanded().slice();
        e[row] = value;
        setExpanded(e);
        bump();
    }

    /** すべて展開 / すべて折りたたみ */
    function setAllExpanded(value: boolean) {
        if (!enabled) return;
        setExpanded(Array<boolean>(levels().length).fill(value));
        bump();
    }

    /** row のすべての祖先を展開する（row を画面に表示させる） */
    function expandAncestors(row: number) {
        if (!enabled) return;
        const lv = levels();
        let e: boolean[] | null = null;
        for (let p = parentOf(lv, row); p >= 0; p = parentOf(lv, p)) {
            if (!(e ?? expanded())[p]) {
                e ??= expanded().slice();
                e[p] = true;
            }
        }
        if (e) {
            setExpanded(e);
            bump();
        }
    }

    return {
        enabled,
        levels,
        expanded,
        version,
        append,
        truncate,
        reset,
        patchLevels,
        permuteExpanded,
        unpermuteExpanded,
        setExpandedAt,
        setAllExpanded,
        expandAncestors,
    };
}

export type TreeState = ReturnType<typeof createTreeState>;
