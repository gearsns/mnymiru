import { describe, it, expect } from 'vitest';
import { createChanges, duplicateData, searchTableData, sortTableData } from './tableOps';
import type { TableData } from '../../../db/types';
import { columnDefs } from '../constants';

// テスト用のモックデータ
const mockData = [
    { id: 1, day: "2", time: "10:00", shop_name: "Shop B", account: "Acc 1" },
    { id: 2, day: "1", time: "09:00", shop_name: "Shop A", account: "Acc 2" },
    { id: 3, day: "0", time: "12:00", shop_name: "Shop C", account: "Acc 3" }, // day 0 はソートで後ろにくる想定
] as unknown as TableData;

const mockData2 = [
    { id: 1, day: "13", time: "", shop_name: "JR", account: "Acc P", note: "Check1" },
    { id: 2, day: "13", time: "06:00", shop_name: "JR", account: "Acc I", note: "Check2" },
    { id: 3, day: "13", time: "06:00", shop_name: "駐車場", account: "Acc W", note: "Check3" },
    { id: 4, day: "13", time: "08:00", shop_name: "Shop A", account: "Acc Q", note: "Check4" },
    { id: 5, day: "13", time: "08:00", shop_name: "Shop A", account: "Acc Q", note: "Check5" },
    { id: 6, day: "17", time: "12:00", shop_name: "Shop B", account: "Acc W", note: "Check6" },
    { id: 7, day: "17", time: "", shop_name: "JR", account: "Acc P", note: "Check7" },
    { id: 8, day: "17", time: "06:00", shop_name: "JR", account: "Acc I", note: "Check8" },
    { id: 9, day: "17", time: "06:00", shop_name: "駐車場", account: "Acc W", note: "Check9" },
    { id: 10, day: "17", time: "12:00", shop_name: "JR", account: "Acc I", note: "Check10" },
] as unknown as TableData;

describe('Table Logic Tests', () => {

    describe('searchTableData', () => {
        it('次へ検索して、ヒットしたセルの座標を返すこと', () => {
            const result = searchTableData("Shop B", mockData, [[0, 0]], columnDefs.findIndex((n) => n.data === "account"), 'next');
            expect(result).toEqual({ row: 0, col: columnDefs.findIndex((n) => n.data === "shop_name") });
        });

        it('見つからない場合は null を返すこと', () => {
            const result = searchTableData("NonExistent", mockData, [[0, 0]], 5, 'next');
            expect(result).toBeNull();
        });
    });

    describe('sortTableData', () => {
        it('Day順にソートされ、0が末尾になること', () => {
            const sorted = sortTableData(mockData);
            expect(sorted[0].day).toBe("1");
            expect(sorted[1].day).toBe("2");
            expect(sorted[2].day).toBe("0"); // 特殊ルール: 0は後方
        });

        it('Dayが同じならTimeでソートされること', () => {
            const sameDayData = [
                { day: "1", time: "11:00" },
                { day: "1", time: "09:00" }
            ] as unknown as TableData;
            const sorted = sortTableData(sameDayData);
            expect(sorted[0].time).toBe("09:00");
        });

        it('Day,Time,Shopの順に並ぶこと', () => {
            const sorted = sortTableData(mockData2);
            console.log(sorted)
            expect(sorted[5].note).toBe("Check7");
        });
    });

    describe('duplicateData', () => {
        it('選択範囲の最上段の値が、下の行にコピーされること', () => {
            const shop_index = columnDefs.findIndex((n) => n.data === "shop_name");
            // [r1, c1, r2, c2] -> 0行目から1行目の、特定の列を選択
            const selected: [number, number, number, number][] = [[0, shop_index, 1, shop_index]];
            const [_range, afterData] = duplicateData(mockData, selected);

            // 0行2列目の値が "Shop B" だとしたら、1行2列目も "Shop B" に書き換わっているか
            const topValue = mockData[0].shop_name;
            expect(afterData[1][0]).toBe(topValue); // 抽出後の相対座標での比較
        });
    });

    describe('createChanges', () => {
        it('データに差分がない場合、空の配列を返すこと', () => {
            const sourceData: TableData = [
                { day: 1, line_no: 1, shop_name: 'Shop A', time: '10:00', item_name: 'Apple', detail: '', expenses: 100, quantity: 1, incomes: 0, total: 100, account: 'Cash', note: '' }
            ];
            const newData: TableData = JSON.parse(JSON.stringify(sourceData)); // 完全なコピー

            const result = createChanges(sourceData, newData);
            expect(result).toEqual([]);
        });

        it('特定のプロパティに変更がある場合、正しい形式で差分を抽出すること', () => {
            const sourceData: TableData = [
                { day: 1, line_no: 1, shop_name: 'Shop A', time: '10:00', item_name: 'Apple', detail: '', expenses: 100, quantity: 1, incomes: 0, total: 100, account: 'Cash', note: '' }
            ];
            const newData: TableData = [
                { ...sourceData[0], expenses: 200, note: 'updated' }
            ];

            const result = createChanges(sourceData, newData);

            // 期待される戻り値: [[行インデックス, キー, 新しい値], ...]
            expect(result).toEqual([
                [0, 'expenses', 200],
                [0, 'note', 'updated']
            ]);
        });

        it('複数行のデータで、変更があった行のみ抽出すること', () => {
            const sourceData: TableData = [
                { day: 1, line_no: 1, shop_name: 'Shop A', time: '10:00', item_name: 'Apple', detail: '', expenses: 100, quantity: 1, incomes: 0, total: 100, account: 'Cash', note: '' },
                { day: 2, line_no: 2, shop_name: 'Shop B', time: '11:00', item_name: 'Orange', detail: '', expenses: 150, quantity: 2, incomes: 0, total: 300, account: 'Card', note: '' }
            ];
            const newData: TableData = [
                { ...sourceData[0] }, // 変更なし
                { ...sourceData[1], item_name: 'Grape' } // 2行目のみ変更
            ];

            const result = createChanges(sourceData, newData);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual([1, 'item_name', 'Grape']);
        });

        it('sourceDataに存在しないインデックスがnewDataにある場合、スキップすること', () => {
            const sourceData: TableData = [];
            const newData: TableData = [
                { day: 1, line_no: 1, shop_name: 'Shop A', time: '10:00', item_name: 'Apple', detail: '', expenses: 100, quantity: 1, incomes: 0, total: 100, account: 'Cash', note: '' }
            ];

            const result = createChanges(sourceData, newData);
            expect(result).toEqual([]);
        });
    });
});