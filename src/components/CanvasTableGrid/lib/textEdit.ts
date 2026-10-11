export interface SpliceResult {
  /** 挿入後の全文 */
  value: string;
  /** 挿入後のカーソル位置（挿入した文字列の直後） */
  caret: number;
}

/** 文字列の [start, end) を text で置き換える（end省略時は start と同じ＝カーソル位置に挿入） */
export function spliceAtCursor(current: string, start: number, end: number, text: string): SpliceResult {
  const value = current.slice(0, start) + text + current.slice(end);
  return { value, caret: start + text.length };
}
