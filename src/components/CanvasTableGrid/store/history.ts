/**
 * 【部品: store / 履歴】
 * Undo/Redo のスタックと「保存済みか（dirty）」の管理だけを担当する。
 * コマンドを「どう実行するか」は知らない（それは undoRedo.ts の仕事）。
 */
import { createMemo, createSignal } from "solid-js";
import type { Command } from "./types";

const MAX_HISTORY = 200;

export function createHistory() {
    const undoStack: Command[] = [];
    const redoStack: Command[] = [];
    const [version, setVersion] = createSignal(0);
    const bump = () => setVersion((v) => v + 1);

    /** 新しい変更を積む（Redo は破棄される） */
    function push(cmd: Command) {
        undoStack.push(cmd);
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack.length = 0;
        bump();
    }

    /** 直近のコマンドを取り出し、apply で取り消してから Redo 側へ移す。無ければ undefined */
    function undo(apply: (cmd: Command) => void): Command | undefined {
        const cmd = undoStack.pop();
        if (!cmd) return undefined;
        apply(cmd);
        redoStack.push(cmd);
        bump();
        return cmd;
    }

    /** Redo 側の先頭を取り出し、apply でやり直してから Undo 側へ戻す。無ければ undefined */
    function redo(apply: (cmd: Command) => void): Command | undefined {
        const cmd = redoStack.pop();
        if (!cmd) return undefined;
        apply(cmd);
        undoStack.push(cmd);
        bump();
        return cmd;
    }

    /** Undo スタックの先頭（無ければ null） */
    function latest(): Command | null {
        return undoStack.length > 0 ? undoStack[undoStack.length - 1] : null;
    }

    /** Undo スタックの件数 */
    function size(): number {
        return undoStack.length;
    }

    /**
     * token が「まだ最新のコマンドのまま」か（その後に他の変更や Undo/Redo が無いか）。
     * 非同期の補完値を同じ Undo 単位にマージできるかの判定に使う。
     */
    function isLatest(token: Command | null): boolean {
        return token !== null && redoStack.length === 0 && latest() === token;
    }

    /** 履歴の中身を直接書き換えた（コマンドに追記した）ことを購読側に知らせる */
    function touch() {
        bump();
    }

    /** 履歴をすべて破棄する（データ全体を差し替えたとき用） */
    function clear() {
        undoStack.length = 0;
        redoStack.length = 0;
        bump();
    }

    function canUndo() {
        version();
        return undoStack.length > 0;
    }
    function canRedo() {
        version();
        return redoStack.length > 0;
    }

    // ---- dirty（未保存の変更があるか） ----
    const [dirtyCheckpoint, setDirtyCheckpoint] = createSignal<Command | null>(null);
    /**
     * 現在の状態を「変更なし（クリーン）」の基準としてマークする
     * （例：初期データ読み込み時や、サーバーへの保存成功時に呼ぶ）
     */
    function markClean() {
        setDirtyCheckpoint(latest());
    }
    const isDirty = createMemo(() => {
        version();
        return latest() !== dirtyCheckpoint();
    });

    return { push, undo, redo, latest, size, isLatest, touch, clear, canUndo, canRedo, markClean, isDirty };
}

export type GridHistory = ReturnType<typeof createHistory>;
