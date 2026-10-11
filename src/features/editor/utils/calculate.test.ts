import { describe, it, expect } from 'vitest';
import { calculateRange, calculateShopTotal } from './calculate';
import { ItemIndex } from '../constants';
import type { CellValue, SelectionRange } from '@/components/CanvasTableGrid/types';

// テスト用のダミーデータを表現する型やヘルパー
type MockData = Record<number, Record<number, CellValue>>;

const createMockGetCell = (data: MockData) => {
    return (row: number, col: number): CellValue => {
        return data[row]?.[col] ?? null;
    };
};

describe('calculate.ts のユニットテスト', () => {

    describe('calculateRange', () => {
        it('単一セルを選択した場合、そのセルの値を文字列にして返すこと', () => {
            const data: MockData = {
                0: { 0: 'テスト値' }
            };
            const getCell = createMockGetCell(data);
            const range: SelectionRange = { r1: 0, c1: 0, r2: 0, c2: 0 };

            const result = calculateRange(range, getCell);
            expect(result).toBe('テスト値');
        });

        it('単一セルで数値の場合も文字列として返すこと', () => {
            const data: MockData = {
                2: { 1: 12345 }
            };
            const getCell = createMockGetCell(data);
            const range: SelectionRange = { r1: 2, c1: 1, r2: 2, c2: 1 };

            const result = calculateRange(range, getCell);
            expect(result).toBe('12345');
        });

        it('複数行の範囲を選択した場合、合計列（ItemIndex.total）の合計をフォーマットして返すこと', () => {
            const data: MockData = {
                0: { [ItemIndex.total]: 1000 },
                1: { [ItemIndex.total]: 2500 },
                2: { [ItemIndex.total]: 1500 },
            };
            const getCell = createMockGetCell(data);
            const range: SelectionRange = { r1: 0, c1: 0, r2: 2, c2: 2 };

            const result = calculateRange(range, getCell);
            // 1000 + 2500 + 1500 = 5000 -> フォーマットされて "5,000" になる想定
            expect(result).toBe('選択範囲の合計：5,000');
        });
    });

    describe('calculateShopTotal', () => {
        it('店舗名が空の場合は空文字を返すこと', () => {
            const data: MockData = {
                0: { [ItemIndex.shop_name]: '' }
            };
            const getCell = createMockGetCell(data);

            const result = calculateShopTotal(0, 1, getCell);
            expect(result).toBe('');
        });

        it('同一の条件（day, shop_name, time, account）が上下に連続する場合、合計を計算して返すこと', () => {
            const data: MockData = {
                0: {
                    [ItemIndex.day]: '2026-10-11',
                    [ItemIndex.shop_name]: 'スーパーA',
                    [ItemIndex.time]: '12:00',
                    [ItemIndex.account]: '現金',
                    [ItemIndex.total]: 1000,
                },
                1: {
                    [ItemIndex.day]: '2026-10-11',
                    [ItemIndex.shop_name]: 'スーパーA',
                    [ItemIndex.time]: '12:00',
                    [ItemIndex.account]: '現金',
                    [ItemIndex.total]: 500,
                },
                2: {
                    [ItemIndex.day]: '2026-10-11',
                    [ItemIndex.shop_name]: 'スーパーA',
                    [ItemIndex.time]: '12:00',
                    [ItemIndex.account]: '現金',
                    [ItemIndex.total]: 1500,
                },
            };
            const getCell = createMockGetCell(data);

            // 行 1 を基準に上下を走査（1000 + 500 + 1500 = 3000）
            const result = calculateShopTotal(1, 3, getCell);
            expect(result).toBe('スーパーA 3,000');
        });

        it('条件（時間や勘定科目など）が途中で異なる場合は、そこで範囲を区切って合計すること', () => {
            const data: MockData = {
                0: {
                    [ItemIndex.day]: '2026-10-11',
                    [ItemIndex.shop_name]: 'ストアB',
                    [ItemIndex.time]: '12:00',
                    [ItemIndex.account]: '現金',
                    [ItemIndex.total]: 1000,
                },
                1: {
                    [ItemIndex.day]: '2026-10-11',
                    [ItemIndex.shop_name]: 'ストアB',
                    [ItemIndex.time]: '13:00', // 時間が違うので別グループ扱いになる
                    [ItemIndex.account]: '現金',
                    [ItemIndex.total]: 2000,
                },
            };
            const getCell = createMockGetCell(data);

            // 行 0 は単体、または上側のみ（今回は他に行がないため 1000 のみ）
            const result0 = calculateShopTotal(0, 2, getCell);
            expect(result0).toBe('ストアB 1,000');

            // 行 1 も単体（1000とは条件が合致しないため 2000 のみ）
            const result1 = calculateShopTotal(1, 2, getCell);
            expect(result1).toBe('ストアB 2,000');
        });
    });
});
