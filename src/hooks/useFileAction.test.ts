import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFileAction } from './useFileAction';
import { useDataStore } from '../store/useDataStore';
import { sqliteClient } from '../services/sqliteClient';
import { message } from 'antd';

// モックの設定
vi.mock('../store/useDataStore');
vi.mock('../services/sqliteClient');
vi.mock('../services/historyService');
vi.mock('antd', () => ({
    message: { success: vi.fn(), error: vi.fn() }
}));

type PermissionMethod = (descriptor?: FileSystemHandlePermissionDescriptor) => Promise<PermissionState>;

interface MockFileHandle extends Omit<FileSystemFileHandle, 'queryPermission' | 'requestPermission' | 'getFile' | 'createWritable'> {
    queryPermission: MockInstance<PermissionMethod>;
    requestPermission: MockInstance<PermissionMethod>;
    getFile: MockInstance<() => Promise<File>>;
    createWritable: MockInstance<() => Promise<FileSystemWritableFileStream>>;
}

describe('useFileAction', () => {
    const mockSetState = vi.fn();
    const mockedDataStore = vi.mocked(useDataStore);
    const mockedSqliteClient = vi.mocked(sqliteClient);

    // FileSystemHandleのモック作成関数
    const createMockHandle = (name: string, permissionStatus: PermissionState = 'granted'): MockFileHandle => {
        const mockObject = {
            name,
            kind: 'file' as const,
            queryPermission: vi.fn<PermissionMethod>().mockResolvedValue(permissionStatus),
            requestPermission: vi.fn<PermissionMethod>().mockResolvedValue(permissionStatus),
            getFile: vi.fn().mockResolvedValue(new File([], name)),
            createWritable: vi.fn(),
            isSameEntry: vi.fn(),
        } as unknown;

        return mockObject as MockFileHandle;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Storeの初期状態
        mockedDataStore.mockReturnValue({
            saveRegistry: {},
            setState: mockSetState,
        });

        // window.showSaveFilePicker のモック化
        if (typeof window !== 'undefined') {
            // 関数シグネチャを型として定義
            type ShowSaveFilePickerFn = (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
            // vi.fn に関数型を渡す
            const showSaveMock = vi.fn<ShowSaveFilePickerFn>();
            (window as unknown as { showSaveFilePicker: typeof showSaveMock }).showSaveFilePicker = showSaveMock;
        }

        // crypto.randomUUID のモック化
        vi.stubGlobal('crypto', {
            randomUUID: () => 'test-uuid-1234'
        });
    });
    describe('Permission Logic (verifyPermission)', () => {
        it('既に "granted" の場合、ユーザーへの許可リクエストを表示せずに処理を続行すること', async () => {
            const mockHandle = createMockHandle('existing.db', 'granted');
            const { result } = renderHook(() => useFileAction());

            await result.current.openFile(mockHandle as unknown as FileSystemFileHandle);

            expect(mockHandle.queryPermission).toHaveBeenCalled();
            expect(mockHandle.requestPermission).not.toHaveBeenCalled();
            expect(mockedSqliteClient.initDatabase).toHaveBeenCalledWith({ handle: mockHandle, dir: undefined });
        });

        it('"prompt" 状態の時、リクエストを投げ、承認されたら処理を続行すること', async () => {
            const mockHandle = createMockHandle('new.db', 'prompt');
            mockHandle.requestPermission.mockResolvedValue('granted');
            const { result } = renderHook(() => useFileAction());

            await result.current.openFile(mockHandle as unknown as FileSystemFileHandle);

            expect(mockHandle.requestPermission).toHaveBeenCalled();
            expect(sqliteClient.initDatabase).toHaveBeenCalled();
        });

        it('リクエストが拒否された場合、初期化処理を行わないこと', async () => {
            const mockHandle = createMockHandle('private.db', 'prompt');
            mockHandle.requestPermission.mockResolvedValue('denied');

            const { result } = renderHook(() => useFileAction());
            await result.current.openFile(mockHandle as unknown as FileSystemFileHandle);

            expect(mockedSqliteClient.initDatabase).not.toHaveBeenCalled();
            expect(mockSetState).not.toHaveBeenCalled();
        });
    });

    describe('File Export Logic', () => {
        it('CSVエクスポート時、ファイルピッカーでキャンセルされたら処理を中断すること', async () => {
            const showSaveMock = vi.mocked(window.showSaveFilePicker);
            showSaveMock.mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));

            const { result } = renderHook(() => useFileAction());
            await result.current.exportToCsvFile();

            // sqliteClient.exportFile が呼ばれていないことを確認
            expect(mockedSqliteClient.exportFile).not.toHaveBeenCalled();
        });

        it('エクスポート成功時に成功メッセージを表示すること', async () => {
            const mockHandle = createMockHandle('export.csv');
            const showSaveMock = vi.mocked(window.showSaveFilePicker);
            showSaveMock.mockResolvedValue(mockHandle as unknown as FileSystemFileHandle);
            mockedSqliteClient.exportFile.mockResolvedValue(true);

            const { result } = renderHook(() => useFileAction());
            await result.current.exportToCsvFile();

            expect(mockedSqliteClient.exportFile).toHaveBeenCalledWith('csv', mockHandle);
            expect(message.success).toHaveBeenCalledWith(expect.stringContaining('export.csv'));
        });
    });
    describe('Session Logic', () => {
        it('新規作成時、引数なしで initDatabase を呼び出すこと', async () => {
            const { result } = renderHook(() => useFileAction());
            await result.current.newFile();

            expect(mockedSqliteClient.initDatabase).toHaveBeenCalledWith(undefined);
            expect(mockSetState).toHaveBeenCalledWith(expect.objectContaining({
                fileName: 'New',
                fileSessionId: 'test-uuid-1234'
            }));
        });
    });
});