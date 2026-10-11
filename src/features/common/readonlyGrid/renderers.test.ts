import { describe, expect, it } from 'vitest';
import { convertCashTableToCellValue } from './renderers';
import type { CashTable } from '@/db/types';

describe('convertCashTableToCellValue', () => {
    it('CashTableの配列をCellValueの行とline_noの配列に正しく変換できること', () => {
        const inputData: CashTable[] = [
            {
                year_month: 202310,
                day: 15,
                shop_name: 'スーパーA',
                time: '12:30',
                item_name: '食料品',
                detail: '野菜と肉',
                expenses: 1500,
                quantity: 2,
                incomes: 0,
                total: 1500,
                account: '食費',
                note: '特売日',
                line_no: 1,
            },
            {
                year_month: 202310,
                day: 16,
                shop_name: 'カフェB',
                time: '15:00',
                item_name: 'コーヒー',
                detail: 'ブレンド',
                expenses: 0,
                quantity: 0,
                incomes: 3000,
                total: 3000,
                account: '売上',
                note: '',
                line_no: 2,
            },
        ];

        const result = convertCashTableToCellValue(inputData);

        expect(result).toEqual({
            rows: [
                [
                    202310,
                    15,
                    'スーパーA',
                    '12:30',
                    '食料品',
                    '野菜と肉',
                    1500,
                    2,
                    null,
                    1500,
                    '食費',
                    '特売日',
                ],
                [
                    202310,
                    16,
                    'カフェB',
                    '15:00',
                    'コーヒー',
                    'ブレンド',
                    null,
                    null,
                    3000,
                    3000,
                    '売上',
                    '',
                ],
            ],
            lines: [1, 2],
        });
    });

    it('expenses や quantity が undefined の場合に null に変換されること', () => {
        const inputData: CashTable[] = [
            {
                year_month: 202310,
                day: 17,
                shop_name: 'ストアC',
                time: '10:00',
                item_name: '雑貨',
                detail: '',
                // @ts-expect-error テスト用に型定義外のundefinedを許容させる場合
                expenses: undefined,
                // @ts-expect-error テスト用に型定義外のundefinedを許容させる場合
                quantity: undefined,
                incomes: 500,
                total: 500,
                account: '雑収入',
                note: 'なし',
                line_no: 5,
            },
        ];

        const result = convertCashTableToCellValue(inputData);

        expect(result.rows[0][6]).toBeNull(); // expenses
        expect(result.rows[0][7]).toBeNull(); // quantity
        expect(result.lines).toEqual([5]);
    });

    it('空の配列が渡された場合に空のrowsとlinesを返すこと', () => {
        const result = convertCashTableToCellValue([]);

        expect(result).toEqual({
            rows: [],
            lines: [],
        });
    });
});
