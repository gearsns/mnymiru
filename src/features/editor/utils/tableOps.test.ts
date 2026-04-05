import { describe, it, expect } from 'vitest';
import { duplicateData, searchTableData, sortTableData } from './tableOps';
import type { TableData } from '../../../db/types';
import { columnDefs } from '../constants';

// テスト用のモックデータ
const mockData = [
    { id: 1, day: "2", time: "10:00", shop_name: "Shop B", account: "Acc 1" },
    { id: 2, day: "1", time: "09:00", shop_name: "Shop A", account: "Acc 2" },
    { id: 3, day: "0", time: "12:00", shop_name: "Shop C", account: "Acc 3" }, // day 0 はソートで後ろにくる想定
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
});