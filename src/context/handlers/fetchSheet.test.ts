import { beforeEach, describe, it, expect } from 'vitest';
import { type Database } from 'sql.js';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';
import { handleFetchSheet } from './fetchSheet';

describe('SQLite Query Test', () => {
    let db: Database | null = null;
    const testData = createTestData();

    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('year_month=202401のデータを取得', async () => {
        const res = await handleFetchSheet(db, {
            key: "202401",
        });
        expect(res.length).toBe(11); // 最大 line_no + 1
    });
    it('year_month=100のデータを取得(0件)', async () => {
        const res = await handleFetchSheet(db, {
            key: "100",
        });
        expect(res.length).toBe(0); // 最大 line_no + 1
    });
});