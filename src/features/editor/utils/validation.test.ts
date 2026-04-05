import { describe, it, expect } from 'vitest';
import { isSameItem } from './validation';
import type { TableRow } from '../../../db/types';

describe('isSameItem', () => {
  const col: keyof TableRow = 'detail';
  const col_num: keyof TableRow = 'incomes';

  // --- パターン1: 厳密一致 ---
  it('同じ文字列や数値の場合は true を返すこと', () => {
    const d1 = { [col]: 'apple' } as TableRow;
    const d2 = { [col]: 'apple' } as TableRow;
    expect(isSameItem(d1, d2, col)).toBe(true);

    const n1 = { [col_num]: 123 } as TableRow;
    const n2 = { [col_num]: 123 } as TableRow;
    expect(isSameItem(n1, n2, col)).toBe(true);
  });

  // --- パターン2: isEmpty の境界条件 ---
  it('両方が null または undefined の場合は true を返すこと', () => {
    // i1 === i2 のケース
    expect(isSameItem({ [col]: null } as unknown as TableRow, { [col]: null } as unknown as TableRow, col)).toBe(true);
    // i1(null) !== i2(undefined) だが、両方 isEmpty のケース
    expect(isSameItem({ [col]: null } as unknown as TableRow, { [col]: undefined }, col)).toBe(true);
  });

  it('片方だけが空値の場合は false を返すこと', () => {
    expect(isSameItem({ [col]: 'data' }, { [col]: null } as unknown as TableRow, col)).toBe(false);
    expect(isSameItem({ [col]: '' }, { [col]: 'data' }, col)).toBe(false);
  });

  // --- パターン3: 文字列変換比較 ---
  it('数値と文字列で内容が同じ場合は true を返すこと (String変換確認)', () => {
    const d1 = { [col]: 100 } as unknown as TableRow;
    const d2 = { [col]: '100' };
    expect(isSameItem(d1, d2, col)).toBe(true);
  });

  it('真偽値と文字列の比較', () => {
    const d1 = { [col]: true } as unknown as TableRow;
    const d2 = { [col]: 'true' };
    expect(isSameItem(d1, d2, col)).toBe(true);
  });

  // --- パターン4: 不一致 ---
  it('全く異なる値の場合は false を返すこと', () => {
    const d1 = { [col]: 'apple' };
    const d2 = { [col]: 'orange' };
    expect(isSameItem(d1, d2, col)).toBe(false);
  });
});