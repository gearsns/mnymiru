import { describe, expect, vi, it, beforeEach } from 'vitest';
import { getTimeString, updateRelatedConfig, updateRelatedData } from './change';
import type { CashTable, TableRow, TopItem } from '../../../../db/types';
import type Handsontable from 'myhandsontable';

const createHot = () => {
    const changes_stack: { type: string, changes: [number, keyof TableRow, string | number][] }[] = [];

    return {
        getChangesStack: () => changes_stack,
        getSourceDataAtRow: (_row: number): TableRow => {
            const data: TableRow = {};
            return data;
        },
        setDataAtRowProp: (changes: [number, keyof TableRow, string | number][], type: string) => {
            changes_stack.push({ type, changes });
        }
    }
}
vi.mock('../../../../services/sqliteClient', () => ({
    sqliteClient: {
        fetchTopItemByColumn: async (_srcColumnName: keyof CashTable, dstColumnName: keyof CashTable, _value: string, _year_month: number): Promise<TopItem> => {
            const ret: TopItem = { value: "1", cnt: 1 };
            if (dstColumnName === "item_name") {
                ret.value = "項目";
            } else if (dstColumnName === "account") {
                ret.value = "口座";
            }
            return ret;
        }
    }
}));

describe('Editor logic change test', () => {
    it("updateRelatedData: Nop col=day", async () => {
        const hot = createHot();
        await updateRelatedData(hot as unknown as Handsontable, 0, "day");
        expect(hot.getChangesStack().length).toBe(0);
    });
    it("updateRelatedData: Changes", async () => {
        const hot = createHot();
        await updateRelatedData(hot as unknown as Handsontable, 0, "detail");
        const ret = hot.getChangesStack();
        expect(ret.length).toBeGreaterThan(0);
        if (ret.length > 0) {
            for (const c of ret[0].changes) {
                if (c[1] === "item_name") {
                    expect(c[2]).toBe("項目");
                } else if (c[1] === "account") {
                    expect(c[2]).toBe("口座");
                }
            }
        }
    });
    it("getTimeString: 10 -> 10:00", () => {
        const ret = getTimeString("10");
        expect(ret).toBe("10:00");
    });
    it("getTimeString: 1:0 -> 01:00", () => {
        const ret = getTimeString("1:0");
        expect(ret).toBe("01:00");
    });
    it("getTimeString: 123:0 -> 123:00", () => {
        const ret = getTimeString("123:0");
        expect(ret).toBe("123:00");
    });
    it("getTimeString: 831 -> 08:31", () => {
        const ret = getTimeString("831");
        expect(ret).toBe("08:31");
    });
    it("getTimeString: X831 -> undefined", () => {
        const ret = getTimeString("X831");
        expect(ret).toBe(undefined);
    });
    it("getTimeString: 1:2:3 -> undefined", () => {
        const ret = getTimeString("1:2:3");
        expect(ret).toBe(undefined);
    });
});

describe('updateRelatedConfig', () => {
    const mockProcessRow = vi.fn();
    // ダミーデータ（5行分）
    const mockData = [
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }
    ] as unknown as TableRow[];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('指定された行とその前後が処理されること (基本ケース)', () => {
        // 2行目(index: 2)を変更
        const changes: [number, string | number, unknown, unknown][] = [
            [2, 'col', 'old', 'new']
        ];

        updateRelatedConfig(changes, mockData, mockProcessRow);

        // index 1, 2, 3 が呼ばれるはず
        expect(mockProcessRow).toHaveBeenCalledTimes(3);
        expect(mockProcessRow).toHaveBeenNthCalledWith(1, mockData, 1);
        expect(mockProcessRow).toHaveBeenNthCalledWith(2, mockData, 2);
        expect(mockProcessRow).toHaveBeenNthCalledWith(3, mockData, 3);
    });

    it('配列の境界（0行目）で負のインデックスを無視すること', () => {
        const changes: [number, string | number, unknown, unknown][] = [[0, '', '', '']];

        updateRelatedConfig(changes, mockData, mockProcessRow);

        // -1 は無視され、0, 1 のみが呼ばれる
        expect(mockProcessRow).toHaveBeenCalledTimes(2);
        expect(mockProcessRow).toHaveBeenCalledWith(mockData, 0);
        expect(mockProcessRow).toHaveBeenCalledWith(mockData, 1);
    });

    it('配列の境界（末尾）でインデックス外を無視すること', () => {
        const lastIndex = mockData.length - 1; // 4
        const changes: [number, string | number, unknown, unknown][] = [[lastIndex, '', '', '']];

        updateRelatedConfig(changes, mockData, mockProcessRow);

        // 4+1=5 は無視され、3, 4 のみが呼ばれる
        expect(mockProcessRow).toHaveBeenCalledTimes(2);
        expect(mockProcessRow).toHaveBeenCalledWith(mockData, 3);
        expect(mockProcessRow).toHaveBeenCalledWith(mockData, 4);
    });

    it('連続する行の変更で重複して処理されないこと', () => {
        // 1行目と2行目を変更
        // 1の前後 -> 0, 1, 2
        // 2の前後 -> 1, 2, 3
        // 合計 -> 0, 1, 2, 3 (重複なし)
        const changes: [number, string | number, unknown, unknown][] = [
            [1, '', '', ''],
            [2, '', '', '']
        ];

        updateRelatedConfig(changes, mockData, mockProcessRow);

        expect(mockProcessRow).toHaveBeenCalledTimes(4);
        const calledIndices = mockProcessRow.mock.calls.map(call => call[1]);
        expect(calledIndices).toEqual([0, 1, 2, 3]);
    });

    it('changesが空の場合は何も実行されないこと', () => {
        updateRelatedConfig([], mockData);
        expect(mockProcessRow).not.toHaveBeenCalled();
    });
});