/**
 * Ctrl+; / Ctrl+Shift+: で挿入する日付・時刻の文字列化。
 * テストで決定的に検証できるよう、現在時刻は引数として注入できるようにしている
 * （省略時は `new Date()`）。
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 現在日付を "YYYY/MM/DD" 形式にする（Excel の Ctrl+; 相当） */
export function formatTodayDate(now: Date = new Date()): string {
  return `${now.getFullYear()}/${pad2(now.getMonth() + 1)}/${pad2(now.getDate())}`;
}

/** 現在時刻を "HH:MM" 形式(24時間表記)にする（Excel の Ctrl+Shift+: 相当） */
export function formatNowTime(now: Date = new Date()): string {
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/**
 * キー入力が「日付を挿入」「時刻を挿入」ショートカットに該当するか判定する。
 * Ctrl(⌘)+; は日付、Ctrl(⌘)+Shift+; (":" キーとして入力されることが多い) は時刻。
 * mod (Ctrl/Cmd) の判定は呼び出し側で行い、この関数には渡さない。
 */
export function classifyQuickInsertKey(key: string, shiftKey: boolean): "date" | "time" | null {
  if (key === ":" || (shiftKey && key === ";")) return "time";
  if (key === ";" && !shiftKey) return "date";
  return null;
}

