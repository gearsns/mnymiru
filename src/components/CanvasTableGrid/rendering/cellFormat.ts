/**
 * 【部品: rendering / 書式の解決】
 * 「保存されている基本書式」に getCellFormat コールバックの上書きをマージして、
 * そのセルで実際に使う書式を求める。描画と、編集用 input の見た目の両方で使う。
 */
import type { CellFormat, CellFormatProvider, CellValue } from "../types";

export interface CellDataSource {
  getCell(row: number, col: number): CellValue;
  getFormat(row: number, col: number): CellFormat | undefined;
}

export function resolveCellFormat(
  source: CellDataSource,
  provider: CellFormatProvider | undefined,
  row: number,
  col: number,
  value: CellValue = source.getCell(row, col)
): CellFormat | undefined {
  const baseFormat = source.getFormat(row, col);
  const override = provider?.(row, col, { value, getCell: source.getCell, baseFormat });
  return override ? { ...baseFormat, ...override } : baseFormat;
}
