import { beforeEach, describe, it, expect } from 'vitest';
import { type Database } from 'sql.js';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';
import { handleFetchByKeyword } from './fetchByKeyword';

describe('SQLite Query Test', () => {
    let db: Database | null = null;
    const testData = createTestData();

    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('日用品', async () => {
        const res = await handleFetchByKeyword(db, {
            keyword: "日用品"
        });
        expect(res.length).toBe(13);
    });
    it('洗', async () => {
        const res = await handleFetchByKeyword(db, {
            keyword: "洗"
        });
        expect(res.length).toBe(13);
    });
});