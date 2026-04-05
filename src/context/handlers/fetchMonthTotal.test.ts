import { beforeEach, describe, it, expect } from 'vitest';
import { type Database } from 'sql.js';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';
import { handleFetchMonthTotal } from './fetchMonthTotal';

describe('SQLite Query Test', () => {
    let db: Database | null = null;
    const testData = createTestData();

    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('2024年の月ごとの集計', async () => {
        const res = await handleFetchMonthTotal(db, {
            year: 2024
        });
        expect(res.length).toBe(3);
    });
    it('2024年の月ごとの集計(カード)', async () => {
        const res = await handleFetchMonthTotal(db, {
            year: 2024,
            account: "カード"
        });
        expect(res.length).toBe(2);
    });
});