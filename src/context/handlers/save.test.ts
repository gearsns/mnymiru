import { beforeEach, describe, it, expect, vi } from 'vitest';
import { type Database } from 'sql.js';
import { createTestData, getSqlDatabase, insertData } from '../../test/setup-sqlite';
import { handleSave } from './save';
import { historyService } from '../../services/historyService';

vi.mock('../../services/historyService', () => ({
    historyService: {
        getLastSession: vi.fn()
    }
}));

const createMockFileHandle = (initialContent = "") => {
    let content = initialContent;

    return {
        kind: 'file',
        name: 'mock.txt',
        getFile: async () => new File([content], 'mock.txt'),
        createWritable: async () => ({
            truncate: (_: number) => { },
            write: async (newData: string) => { content = newData; },
            close: async () => { }
        })
    };
};
const createMockDirectoryHandle = (initialContent = "") => {
    let content = initialContent;
    const files: string[] = [];

    return {
        kind: 'dir',
        name: 'mock',
        getFileHandle: (name: string, _: unknown) => {
            files.push(name);
            return createMockFileHandle();
        },
        getFile: async () => new File([content], 'mock.txt'),
        createWritable: async () => ({
            truncate: (_: number) => { },
            write: async (newData: string) => { content = newData; },
            close: async () => { }
        }),
        getFiles: () => files
    };
};

describe('SQLite Query Test', () => {
    const mockDir = createMockDirectoryHandle();
    const mockSession = {
        id: "", data: new Uint8Array(),
        dir: mockDir as unknown as FileSystemDirectoryHandle,
        handle: createMockFileHandle() as unknown as FileSystemFileHandle,
        isDirty: false, timestamp: 0
    };
    vi.mocked(historyService.getLastSession).mockResolvedValue(mockSession);
    let db: Database | null = null;
    const testData = createTestData();

    beforeEach(async () => {
        db = await getSqlDatabase();
        insertData(db, testData);
    });

    it('Save', async () => {
        const res = await handleSave(db);
        const f = mockDir.getFiles()[0];
        expect(f).toMatch(/mock\.[0-9]+\.txt/);
        expect(res).toBe(true);
    });
});