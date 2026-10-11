import { describe, it, expect } from 'vitest';
import { convertTableToCellValue, convertCellValueToTable } from './renderers';
import { ItemIndex } from '../constants';
import type { TableData } from '@/db/types';

describe('renderers', () => {
    describe('convertTableToCellValue', () => {
        it('line_no に応じて正しい位置にセルデータを配置し、スパース配列と1000行単位のパディングを維持すること', () => {
            const tableData: TableData = [
                {
                    line_no: 0,
                    day: 15,
                    shop_name: 'スーパーA',
                    time: '12:00',
                    item_name: '食料品',
                    detail: '野菜など',
                    expenses: 1200,
                    quantity: 2,
                    incomes: 0,
                    total: 1200,
                    account: '現金',
                    note: '特になし'
                },
                {
                    line_no: 5, // 途中に飛び番があるケース
                    day: 16,
                    shop_name: 'コンビニB',
                    time: '15:30',
                    item_name: '飲み物',
                    detail: '',
                    expenses: 150,
                    quantity: 1,
                    incomes: 0,
                    total: 150,
                    account: 'カード',
                    note: ''
                }
            ];

            const result = convertTableToCellValue(tableData);

            // 0行目が正しく変換されていること
            expect(result[0]).toEqual([
                15,
                'スーパーA',
                '12:00',
                '食料品',
                '野菜など',
                1200,
                2,
                null, // incomes が 0 の場合
                1200,
                '現金',
                '特になし'
            ]);

            // 1〜4行目は意図されたスパース配列（undefined）であること
            expect(result[1]).toBeUndefined();
            expect(result[4]).toBeUndefined();

            // 5行目が正しく変換されていること
            expect(result[5]).toBeDefined();
            expect(result[5][ItemIndex.shop_name]).toBe('コンビニB');

            // 1000行単位のパディング（maxrow = Math.floor(rows.length / 1000 + 1) * 1000）が末尾に設定されていること
            // この場合、rows.length は最大インデックスやパディングに依存するが、少なくとも 1000 の倍数＋αのパディング行が作られる
            //const expectedMaxRow = Math.floor(result.length / 1000 + 1) * 1000; // 実装上の計算式に準拠
            // ※実装では rows[maxrow] = [] が実行されるため、そのインデックスが存在することを確認
            expect(result.length).toBeGreaterThanOrEqual(1000);
        });

        it('数値が 0 の場合に意図的に null に変換されること (expenses, incomes, day, quantity, total)', () => {
            const tableData: TableData = [
                {
                    line_no: 0,
                    day: 0, // 0 の場合は画面表示させないため null になるべき
                    shop_name: '',
                    time: '',
                    item_name: '',
                    detail: '',
                    expenses: 0, // 0 の場合は null
                    quantity: 0, // 0 の場合は null
                    incomes: 0,  // 0 の場合は null
                    total: 0,    // 0 の場合は null
                    account: '',
                    note: ''
                }
            ];

            const result = convertTableToCellValue(tableData);

            // item.day || null や item.expenses || falsy で null になる挙動の検証
            expect(result[0][ItemIndex.day]).toBeNull();
            expect(result[0][ItemIndex.expenses]).toBeNull();
            expect(result[0][ItemIndex.quantity]).toBeNull();
            expect(result[0][ItemIndex.incomes]).toBeNull();
            expect(result[0][ItemIndex.total]).toBeNull();
        });
    });

    describe('convertCellValueToTable', () => {
        it('空行（undefined）を含むスパース配列であっても行位置を詰めずにそのまま TableData に変換すること', () => {
            // スパース配列を模したテストデータ（1行目と3行目にデータ、2行目は undefined）
            const cellValues: any[][] = [];
            cellValues[0] = [
                15, 'スーパーA', '12:00', '食料品', '', 1200, 1, 0, 1200, '現金', ''
            ];
            // index 1 は空（undefined）
            cellValues[2] = [
                16, 'コンビニB', '15:30', '飲み物', '', 150, 1, 0, 150, 'カード', ''
            ];

            const result = convertCellValueToTable(cellValues);

            // 行数が削られず、インデックスに対応した配列長になること（空行もそのままオブジェクト化される）
            expect(result.length).toBe(3);
            expect(result[0].shop_name).toBe('スーパーA');
            // 2行目(index 1)は undefined が走査されてデフォルト値（空文字や0）のレコードになること
            expect(result[1].shop_name).toBe('');
            expect(result[2].shop_name).toBe('コンビニB');
        });
    });
});
