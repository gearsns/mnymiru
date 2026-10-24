/**
 * キー操作の「意味」（アクション）と「実際に押すキー」を分離する。
 * デフォルトのキー割り当ては defaultKeyBindings に集約してあり、
 * CanvasTableGrid の `keyBindings` プロパティで一部だけ上書き・無効化できる。
 *
 * 注意：Shift / Alt は多くのアクションで「補助フラグ」（範囲選択の拡張、Enterでの
 * 上方向への移動、編集開始など）として個別に扱われるため、バインディング側では
 * 明示的に指定しない限り「どちらでもよい」扱いになる。曖昧になる組み合わせ
 * （例: Ctrl+Z と Ctrl+Shift+Z）だけ、区別のために明示的に指定してある。
 */

export type GridAction =
  | "arrowUp"
  | "arrowDown"
  | "arrowLeft"
  | "arrowRight"
  | "home"
  | "end"
  | "documentHome"
  | "documentEnd"
  | "deleteCell"
  | "undo"
  | "redo"
  | "selectAll"
  | "fillDown"
  | "insertDate"
  | "insertTime"
  | "editF2"
  | "commitEnter"
  | "commitTab"
  | "cancelEdit"
  | "treeExpand"
  | "treeCollapse";

export interface KeyBinding {
  /** KeyboardEvent.key の値（大文字小文字は区別しない） */
  key: string;
  /** true なら Ctrl(Win/Linux) または Cmd(Mac) が押されていることが必須。省略時は「押されていないこと」が必須。 */
  mod?: boolean;
  /** true/false ならその状態が必須。省略時（undefined）はどちらでもよい。 */
  shift?: boolean;
  alt?: boolean;
}

export type KeyBindingMap = Partial<Record<GridAction, KeyBinding[] | null>>;

/** デフォルトのキー割り当て。1つのアクションに複数のキーを割り当てることもできる（例: redo）。 */
export const defaultKeyBindings: Record<GridAction, KeyBinding[]> = {
  arrowUp: [{ key: "ArrowUp" }],
  arrowDown: [{ key: "ArrowDown" }],
  arrowLeft: [{ key: "ArrowLeft" }],
  arrowRight: [{ key: "ArrowRight" }],
  home: [{ key: "Home" }],
  end: [{ key: "End" }],
  documentHome: [{ key: "Home", mod: true }],
  documentEnd: [{ key: "End", mod: true }],
  deleteCell: [{ key: "Delete" }, { key: "Backspace" }],
  undo: [{ key: "z", mod: true, shift: false }],
  redo: [
    { key: "y", mod: true },
    { key: "z", mod: true, shift: true },
  ],
  selectAll: [{ key: "a", mod: true }],
  fillDown: [{ key: "d", mod: true }],
  insertDate: [{ key: ";", mod: true, shift: false }],
  insertTime: [
    { key: ":", mod: true },
    { key: ";", mod: true, shift: true },
  ],
  editF2: [{ key: "F2" }],
  commitEnter: [{ key: "Enter" }],
  commitTab: [{ key: "Tab" }],
  cancelEdit: [{ key: "Escape" }],
  // ツリーグリッドのみ。通常の矢印キーでセル移動するため、Alt を必須にして区別する
  treeExpand: [{ key: "ArrowRight", alt: true }],
  treeCollapse: [{ key: "ArrowLeft", alt: true }],
};

/** 判定に必要な最小限のキーイベント情報（実際の KeyboardEvent からも、テスト用の素のオブジェクトからも渡せる） */
export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function bindingMatches(e: KeyLike, b: KeyBinding): boolean {
  if (e.key.toLowerCase() !== b.key.toLowerCase()) return false;
  const mod = e.ctrlKey || e.metaKey;
  if (!!b.mod !== mod) return false;
  if (b.shift !== undefined && b.shift !== e.shiftKey) return false;
  if (b.alt !== undefined && b.alt !== e.altKey) return false;
  return true;
}

/**
 * ユーザー指定の overrides をデフォルトにマージする。
 * - アクションを配列で指定すればデフォルトを完全に置き換える。
 * - `null` を指定すると、そのアクションのキー割り当てを無効化する（何も反応しなくなる）。
 * - 指定しなかったアクションはデフォルトのまま。
 */
export function mergeKeyBindings(overrides?: KeyBindingMap): Record<GridAction, KeyBinding[]> {
  const merged = { ...defaultKeyBindings };
  if (!overrides) return merged;
  for (const key in overrides) {
    const action = key as GridAction;
    const value = overrides[action];
    merged[action] = value ?? [];
  }
  return merged;
}

/** そのキーイベントが、指定したアクションのいずれかのバインディングに一致するか */
export function matchesAction(e: KeyLike, action: GridAction, bindings: Record<GridAction, KeyBinding[]>): boolean {
  return bindings[action].some((b) => bindingMatches(e, b));
}
