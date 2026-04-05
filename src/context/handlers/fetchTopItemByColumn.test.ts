import { beforeEach, describe, it, expect } from 'vitest';
import { type Database } from 'sql.js';
import { handleFetchTopItemByColumn } from './fetchTopItemByColumn';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';

describe('SQLite Query Test', () => {
    let db: Database | null = null;
    const testData = createTestData();
    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('内訳から項目名をサジェスト', async () => {
        const res = await handleFetchTopItemByColumn(db, {
            srcColumnName: "detail",
            dstColumnName: "item_name",
            value: "弁当",
            year_month: 1
        });
        expect(res.cnt).toBe(1);
        expect(res.value).toBe("ランチ");
    });
    it('内訳から口座名をサジェスト', async () => {
        const res = await handleFetchTopItemByColumn(db, {
            srcColumnName: "detail",
            dstColumnName: "account",
            value: "洗剤",
            year_month: 1
        });
        expect(res.cnt).toBe(12);
        expect(res.value).toBe("カード");
    });
});