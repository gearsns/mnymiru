import { beforeEach, describe, it, expect } from 'vitest';
import { type Database } from 'sql.js';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';
import { handleSyncSheet } from './syncSheet';
import { handleFetchSheet } from './fetchSheet';

const rawData: unknown[][] = [
    [202401, 1, 0, "コンビニ", "12:00", "ランチ", "弁当", 600, 1, 0, -600, "現金", "特記事項なし", 0],
    [202401, 2, 1, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 3, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 4, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 5, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "現金", "", 0],
    [202401, 2, 6, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 7, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "", 0],
    [202401, 2, 10, "スーパー", "18:00", "日用品", "洗剤", 300, 1, 0, -300, "カード", "",0],
];

describe('SQLite Query Test', () => {
    let db: Database | null = null;
    const testData = createTestData();
    const toTestData = createTestData(rawData);

    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('DBへの書き込み', async () => {
        const res = await handleSyncSheet(db, {
            year_month: 202401,
            tableData: toTestData
        });
        expect(res).toBe(true);
        const data = await handleFetchSheet(db, {key: "202401"});
        expect(data.length).toBe(8);
    });
});