import { beforeEach, describe, it, expect } from 'vitest';
import { type Database } from 'sql.js';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';
import { handleFetchTopItems } from './fetchTopItems';

const rawData: unknown[][] = [
    [1, 1, 1, 'shop', 'time', 'item0', 'detail', 1, 1, 1, 1, 'acc', 'note', 0],
    [1, 1, 2, 'shop', 'time', 'item', 'detail', 1, 1, 1, 1, 'acc', 'note', 0],
    [1, 1, 3, 'shop', 'time', 'item', 'detail', 1, 1, 1, 1, 'acc', 'note', 0],
    [1, 1, 4, 'shop', 'time', 'item', 'detail', 1, 1, 1, 1, 'acc', 'note', 0],
    [1, 1, 5, 'shop', 'time', 'item', 'detail', 1, 1, 1, 1, 'acc', 'note', 0],
    [2, 1, 1, 'shop', 'time', 'item1', 'detail', 1, 1, 1, 1, 'acc', 'note', 0],
    [2, 1, 2, 'shop', 'time', 'item1', 'detail', 1, 1, 1, 1, 'acc', 'note', 0],
    [2, 1, 3, 'shop', 'time', 'item1', 'detail', 1, 1, 1, 1, 'acc', 'note', 0],
    [2, 1, 4, 'shop', 'time', 'item1', 'detail', 1, 1, 1, 1, 'acc', 'note', 0],
    [3, 1, 1, 'shop', 'time', 'item2', 'detail', 1, 1, 1, 1, 'acc1', 'note', 0],
    [3, 1, 2, 'shop', 'time', 'item2', 'detail', 1, 1, 1, 1, 'acc1', 'note', 0],
    [3, 1, 3, 'shop', 'time', 'item2', 'detail', 1, 1, 1, 1, 'acc1', 'note', 0],
    [3, 1, 4, 'shop', 'time', 'item', 'detail', 1, 1, 1, 1, 'acc1', 'note', 0],
];

describe('SQLite Query Test', () => {
    let db: Database | null = null;
    const testData = createTestData(rawData);
    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('項目名の一覧', async () => {
        const res = await handleFetchTopItems(db, {
            columnName: "item_name",
            year_month: 1
        });
        expect(res.length).toBe(4);
        expect(res[0].value).toBe("item");
    });
    it('店名の一覧', async () => {
        const res = await handleFetchTopItems(db, {
            columnName: "shop_name",
            year_month: 1
        });
        expect(res.length).toBe(1);
        expect(res[0].value).toBe("shop");
    });
    it('口座の一覧', async () => {
        const res = await handleFetchTopItems(db, {
            columnName: "account",
            year_month: 1
        });
        expect(res.length).toBe(2);
        expect(res[0].value).toBe("acc");
    });
});