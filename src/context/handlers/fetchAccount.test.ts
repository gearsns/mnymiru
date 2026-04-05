import { beforeEach, describe, it, expect } from 'vitest';
import { type Database } from 'sql.js';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';
import { handleFetchAccount } from './fetchAccount';

describe('SQLite Query Test', () => {
    let db: Database | null = null;
    const testData = createTestData();

    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('2024', async () => {
        const res = await handleFetchAccount(db, {
            year: 2024
        });
        expect(res.length).toBe(2);
    });
});