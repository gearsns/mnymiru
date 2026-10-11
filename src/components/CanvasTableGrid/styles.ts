import type { JSX } from "solid-js";
import type { GridTheme } from "./types";

/**
 * CanvasTableGrid の見た目（インラインスタイル）を1箇所に集約したファイル。
 * - `xxxStyle` という名前の関数/定数は JSX の `style` 属性にそのまま渡せる
 *   `JSX.CSSProperties`（プロパティ名はケバブケース文字列）を返す。
 * - `editableInputStyle` だけは例外で、`Object.assign(el.style, ...)` で使う
 *   `CSSStyleDeclaration` 用（プロパティ名はキャメルケース）のオブジェクトを返す。
 * 色・フォントなどの値は極力 `GridTheme` から取るようにし、テーマを差し替えれば
 * 見た目全体に反映されるようにしている。
 */

/** ルート要素（外枠）のスタイル。`overrideStyle` には利用者が渡した `style` プロパティをそのまま重ねる。 */
export function rootStyle(theme: GridTheme, overrideStyle?: JSX.CSSProperties): JSX.CSSProperties {
  return {
    position: "relative",
    width: "100%",
    height: "100%",
    "min-height": "200px",
    overflow: "hidden",
    "font-family": theme.fontFamily,
    outline: "none",
    ...(overrideStyle ?? {}),
  };
}

/** canvas 要素のスタイル（テーマに依存しない固定値） */
export const canvasStyle: JSX.CSSProperties = {
  position: "absolute",
  inset: "0",
  "touch-action": "none",
  cursor: "cell",
};

/**
 * 裏の `<input>` の「初期」スタイル（JSXの `style` 属性用）。
 * 実際の位置・サイズ・見た目（編集中かどうか）は `positionInput()` が
 * `editableInputStyle()` を使って毎回上書きするため、ここは初期値のみでよい。
 */
export function inputBaseStyle(theme: GridTheme): JSX.CSSProperties {
  return {
    position: "absolute",
    "box-sizing": "border-box",
    outline: "none",
    "font-size": `${theme.fontSize}px`,
    "font-family": theme.fontFamily,
    border: "none",
    background: "transparent",
    color: "transparent",
    "caret-color": "transparent",
    padding: "0",
    "pointer-events": "none",
  };
}

/**
 * 裏の `<input>` の、編集中/非編集時それぞれの見た目。
 * `Object.assign(inputEl.style, editableInputStyle(...))` の形で使う想定
 * （CSSStyleDeclaration のプロパティ名なのでキャメルケース）。
 */
export function editableInputStyle(editing: boolean, theme: GridTheme): Partial<CSSStyleDeclaration> {
  if (editing) {
    return {
      background: "#ffffff",
      border: `2px solid ${theme.activeCellBorderColor}`,
      color: theme.textColor,
      caretColor: theme.textColor,
      zIndex: "2",
      padding: "0 5px",
      // 編集中はテキスト選択・カーソル移動のためクリックを受け取る
      pointerEvents: "auto",
    };
  }
  return {
    background: "transparent",
    border: "none",
    color: "transparent",
    caretColor: "transparent",
    zIndex: "0",
    padding: "0",
    // 非編集時はクリックを透過させ、下の canvas がイベントを受け取れるようにする。
    // これが無いと、アクティブセルの上に input が重なったままになり、
    // 同じセルへの2回目のクリック（ダブルクリック判定）が canvas に届かなくなる。
    pointerEvents: "none",
  };
}

/** ドロップダウンの候補一覧を囲む要素のスタイル */
export function dropdownContainerStyle(theme: GridTheme): JSX.CSSProperties {
  return {
    position: "absolute",
    "min-width": "160px",
    "max-height": "220px",
    "overflow-y": "auto",
    background: "#ffffff",
    border: `1px solid ${theme.gridLineColor}`,
    "border-radius": "4px",
    "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.15)",
    "z-index": "10",
    "font-family": theme.fontFamily,
    "font-size": `${theme.fontSize}px`,
  };
}

/** ドロップダウンの「読み込み中…」「該当なし」表示のスタイル */
export const dropdownMessageStyle: JSX.CSSProperties = {
  padding: "6px 10px",
  color: "#888888",
};

/** ドロップダウンの選択肢1件分のスタイル */
export function dropdownItemStyle(theme: GridTheme, highlighted: boolean): JSX.CSSProperties {
  return {
    padding: "6px 10px",
    cursor: "pointer",
    "white-space": "nowrap",
    color: theme.textColor,
    background: highlighted ? theme.headerActiveBackground : "transparent",
  };
}
