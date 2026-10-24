import type { CellFormat, CellValue } from "./types";

const YOUBI_JA = ["日", "月", "火", "水", "木", "金", "土"];
const YOUBI_JA_LONG = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

/** "#,##0.00" のような数値パターンをパースして適用する */
export function formatNumber(value: number, pattern: string): string {
  if (Number.isNaN(value)) return "";

  const isPercent = pattern.trim().endsWith("%");
  let workingValue = value;
  let pat = pattern;
  if (isPercent) {
    workingValue = value * 100;
    pat = pat.trim().slice(0, -1);
  }

  const useThousands = pat.includes(",");
  const decimalMatch = pat.match(/\.(0+)/);
  const decimals = decimalMatch ? decimalMatch[1].length : 0;

  const fixed = Math.abs(workingValue).toFixed(decimals);
  let [intPart, decPart] = fixed.split(".");

  if (useThousands) {
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const sign = workingValue < 0 ? "-" : "";
  let result = sign + intPart + (decPart ? "." + decPart : "");
  if (isPercent) result += "%";
  return result;
}

function toDate(value: CellValue): Date | null {
  if (value == null) return null;
  if (typeof value === "number") {
    // シリアル値ではなく unixtime(ms) として扱う簡易対応
    return new Date(value);
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "YYYY/MM/DD", "M/D(ddd)" のようなパターンを日付に適用する */
export function formatDate(value: CellValue, pattern: string): string {
  const d = toDate(value);
  if (!d) return value == null ? "" : String(value);

  const yyyy = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = d.getHours();
  const mm = d.getMinutes();
  const ss = d.getSeconds();
  const w = d.getDay();

  const pad = (n: number) => String(n).padStart(2, "0");

  return pattern
    .replace(/YYYY/g, String(yyyy))
    .replace(/YY/g, String(yyyy).slice(-2))
    .replace(/MM/g, pad(m))
    .replace(/M/g, String(m))
    .replace(/DD/g, pad(day))
    .replace(/D/g, String(day))
    .replace(/hh/g, pad(hh))
    .replace(/mm/g, pad(mm))
    .replace(/ss/g, pad(ss))
    .replace(/dddd/g, YOUBI_JA_LONG[w])
    .replace(/ddd/g, YOUBI_JA[w]);
}

/** セルの値と書式から、canvas に描画する表示文字列を作る */
export function formatCellValue(value: CellValue, format?: CellFormat): string {
  if (format?.formatter) return format.formatter(value);
  if (value == null) return "";

  switch (format?.type) {
    case "number": {
      const num = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(num)) return String(value);
      return formatNumber(num, format.pattern ?? "#,##0");
    }
    case "date":
      return formatDate(value, format.pattern ?? "YYYY/MM/DD");
    default:
      return String(value);
  }
}

/** 表示上の水平方向の既定値（number は右寄せ、それ以外は左寄せ） */
export function defaultAlign(value: CellValue, format?: CellFormat): "left" | "center" | "right" {
  if (format?.align) return format.align;
  if (format?.type === "number" || (format?.type == null && typeof value === "number")) {
    return "right";
  }
  return "left";
}

/** 既定の列ヘッダラベル (A, B, ... Z, AA, AB, ...) */
export function defaultColumnHeaderLabel(colIndex: number): string {
  let n = colIndex;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/** 既定の行ヘッダラベル (1-origin) */
export function defaultRowHeaderLabel(rowIndex: number): string {
  return String(rowIndex + 1);
}

/**
 * columnHeaderLabel / rowHeaderLabel は「関数」または「文字列配列」のどちらでも受け取れるので、
 * 内部用の関数に正規化する（配列の範囲外・未指定は fallback）。
 */
export function normalizeHeaderLabel(
  option: ((index: number) => string) | string[] | undefined,
  fallback: (index: number) => string
): (index: number) => string {
  if (option == null) return fallback;
  if (Array.isArray(option)) {
    return (index: number) => option[index] ?? fallback(index);
  }
  return option;
}
