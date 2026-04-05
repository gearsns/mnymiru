import { useDataStore } from '../store/useDataStore';
import { sqliteClient } from '../services/sqliteClient';
import { historyService } from '../services/historyService';
import { message } from 'antd';
import { useCallback, useMemo } from 'react';

const FILE_TYPES: Record<'db' | 'csv', SaveFilePickerOptions> = {
    db: {
        suggestedName: 'cash.db',
        types: [{
            description: 'SQLite Database',
            accept: { 'application/x-sqlite3': ['.sqlite', '.db'] },
        }],
    },
    csv: {
        suggestedName: 'cash.csv',
        types: [{
            description: 'CSV File',
            accept: { 'text/csv': ['.csv'] },
        }],
    },
} as const; // readonlyにして型推論を正確にする
type FileType = keyof typeof FILE_TYPES;

export const useFileAction = () => {
    const { saveRegistry, setState } = useDataStore();

    // 許可を取る内部関数 (private的な扱い)
    const verifyPermission = async (handle: FileSystemFileHandle | FileSystemDirectoryHandle) => {
        const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
        if (await handle.queryPermission(opts) === 'granted') return true;
        return (await handle.requestPermission(opts)) === 'granted';
    };
    // ファイルピッカーの共通処理
    const getSaveHandle = async (type: FileType) => {
        try {
            return await window.showSaveFilePicker(FILE_TYPES[type]);
        } catch (e) {
            console.log('User cancelled or failed to get handle', e);
            return null;
        }
    };
    // 内部共通処理：メモリのクリアとDBの再接続
    const initializeWorkspace = useCallback(async (param?: { handle?: FileSystemFileHandle, dir?: FileSystemDirectoryHandle, isSession?: boolean }) => {
        // 1. sqliteClientを初期化（ハンドルがあれば読み込み、なければ新規）
        await sqliteClient.initDatabase(param);

        const lastSession = await historyService.getLastSession();
        let fileName = lastSession?.handle?.name ?? "New";
        if (lastSession?.dir) {
            fileName = `${lastSession.dir.name}/${fileName}`;
        }
        // 2. Storeの状態を一括更新
        setState({
            fileName: fileName,
            fileHandle: lastSession?.handle,
            isDirty: lastSession?.isDirty,
            fileSessionId: crypto.randomUUID(), // セッションを回してエディタを再マウントさせる
        });
    }, [setState]);
    // 新規作成
    const newFile = useCallback(async () => {
        await initializeWorkspace();
    }, [initializeWorkspace]);

    // ファイルを開く
    const openFile = useCallback(async (handle: FileSystemFileHandle, dir?: FileSystemDirectoryHandle) => {
        const ok = await verifyPermission(dir || handle); // ここで許可を取る
        if (!ok) return;
        await initializeWorkspace({ handle, dir });
    }, [initializeWorkspace]);

    const openSession = useCallback(async () => {
        await initializeWorkspace({ isSession: true });
    }, [initializeWorkspace]);

    // 全エディタの変更をDBに反映 (sync)
    const syncAll = useCallback(async () => {
        const promises = Object.values(saveRegistry).map(fn => fn());
        await Promise.all(promises);
        setState({ isDirty: false });
    }, [saveRegistry, setState]);

    // DBの内容を物理ファイルに書き出す (save)
    const saveToFile = useCallback(async () => {
        //const { fileHandle } = useDataStore.getState();
        await syncAll();
        const lastSession = await historyService.getLastSession();
        if (!lastSession) {
            return;
        }
        let handle = lastSession.dir || lastSession.handle;
        if (!handle) {
            // 新規保存：ユーザーに場所を聞く
            const newHandle = await getSaveHandle('db');
            if (!newHandle) return;
            handle = newHandle;
            lastSession.handle = newHandle;
        }
        if (!await verifyPermission(handle)) return;
        //
        await sqliteClient.saveDatabase();
        await historyService.savedPersistData(lastSession);
        message.success(`ファイル(${lastSession.handle?.name})を保存しました`);
        setState({ fileHandle: lastSession.handle, isDirty: false });
    }, [setState, syncAll]);

    const exportFile = useCallback(async (type: FileType) => {
        await syncAll();
        const handle = await getSaveHandle(type);
        if (!handle || !(await verifyPermission(handle))) return;
        const exportOk = await sqliteClient.exportFile(type, handle);
        if (exportOk) {
            message.success(`ファイル(${handle?.name})を保存しました`);
        }
    }, [syncAll]);

    return useMemo(() => ({
        newFile, openFile, openSession, saveToFile,
        exportToDbFile: () => exportFile('db'),
        exportToCsvFile: () => exportFile('csv')
    }), [newFile, openFile, openSession, saveToFile, exportFile]);
}