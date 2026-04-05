import { beforeEach, describe, it, expect } from 'vitest';
import { type Database } from 'sql.js';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';
import { handleFetchYearTop } from './fetchYearTop';

describe('SQLite Query Test', () => {
    let db: Database | null = null;
    const testData = createTestData();

    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('2024年の月ごとの集計', async () => {
        const res = await handleFetchYearTop(db, {
            year: 2024
        });
        expect(res.length).toBe(10);
		expect(res[0].detail).toBe("弁当");
    });
});