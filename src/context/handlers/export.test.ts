import { beforeEach, describe, it, expect } from 'vitest';
import { type Database } from 'sql.js';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';
import { handleExport } from './export';

const createMockFileHandle = (initialContent = "") => {
    let content = initialContent;

    return {
        kind: 'file',
        name: 'mock.txt',
        getFile: async () => new File([content], 'mock.txt'),
        createWritable: async () => ({
            truncate: (_: number) => {},
            write: async (newData: string) => { content = newData; },
            close: async () => { }
        })
    };
};

describe('SQLite Query Test', () => {
    let db: Database | null = null;
    const testData = createTestData();

    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('Export', async () => {
        const mockHandle = createMockFileHandle() as unknown as FileSystemFileHandle;
        const res = await handleExport(db, {
            type: 'csv',
            handle: mockHandle
        });
        expect(res).toBe(true);
        const file = await mockHandle.getFile();
        expect(await file.text()).includes("2024,1,1,コンビニ,12:00,ランチ,弁当,0,1,600,-600,現金,特記事項なし");
    });
});