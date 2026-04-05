import { describe, it, expect } from 'vitest';
import { calculateDayCell, parseYearMonth } from './calculateDay';

describe('myDayRenderer Logic', () => {
  it('正常な日付の場合、曜日付きのテキストと曜日クラスを返す', () => {
    // 2024年4月1日 (月曜) の想定
    const result = calculateDayCell(1, 2024, 3, false, false);
    
    expect(result.text).toBe('1 (月)');
    expect(result.classes).toContain('cell_mon');
  });

  it('isSameDayがtrueで、次行も同じ日の場合、bodyクラスが付与される', () => {
    const result = calculateDayCell(1, 2024, 3, true, true);
    
    expect(result.classes).toContain('cell_row_body');
    expect(result.classes).toContain('cell_day_same');
  });

  it('不正な日付数値の場合、エラークラスを返す', () => {
    const result = calculateDayCell(99, 2024, 3, false, false);
    expect(result.classes).toContain('cell_day_error');
  });

  it('sheetNameから年月を正しくパースできる', () => {
    const { year, month } = parseYearMonth("202604");
    expect(year).toBe(2026);
    expect(month).toBe(3); // JSのMonthは0始まり
  });
});