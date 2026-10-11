import { saveRegistry, setState } from '@/store/dataStore';
import { sqliteClient } from '../services/sqliteClient';
import { historyService } from '../services/historyService';
import { message } from '@/components/Message';

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
} as const;

type FileType = keyof typeof FILE_TYPES;

export const createFileAction = () => {
    // 許可を取る内部関数
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
    const initializeWorkspace = async (param?: { handle?: FileSystemFileHandle, dir?: FileSystemDirectoryHandle, isSession?: boolean }) => {
        await sqliteClient.initDatabase(param);

        const lastSession = await historyService.getLastSession();
        let fileName = lastSession?.handle?.name ?? "New";
        if (lastSession?.dir) {
            fileName = `${lastSession.dir.name}/${fileName}`;
        }
        setState({
            fileName: fileName,
            fileHandle: lastSession?.handle,
            isDirty: lastSession?.isDirty,
            fileSessionId: crypto.randomUUID()
        });
    };

    // 新規作成
    const newFile = async () => {
        await initializeWorkspace();
    };

    // ファイルを開く
    const openFile = async (handle: FileSystemFileHandle, dir?: FileSystemDirectoryHandle) => {
        const ok = await verifyPermission(dir || handle);
        if (!ok) return;
        await initializeWorkspace({ handle, dir });
    };

    const openSession = async () => {
        await initializeWorkspace({ isSession: true });
    };

    // 全エディタの変更をDBに反映 (sync)
    const syncAll = async () => {
        // ストアから最新の saveRegistry を取得する必要がある場合は state から参照してください
        const promises = Object.values(saveRegistry).map(fn => fn());
        await Promise.all(promises);
        setState({ isDirty: false });
    };

    // DBの内容を物理ファイルに書き出す (save)
    const saveToFile = async () => {
        await syncAll();
        const lastSession = await historyService.getLastSession();
        if (!lastSession) {
            return;
        }
        let handle = lastSession.dir || lastSession.handle;
        if (!handle) {
            const newHandle = await getSaveHandle('db');
            if (!newHandle) return;
            handle = newHandle;
            lastSession.handle = newHandle;
        }
        if (!await verifyPermission(handle)) return;

        await sqliteClient.saveDatabase();
        await historyService.savedPersistData(lastSession);
        message.success(`ファイル(${lastSession.handle?.name})に保存しました`);
        setState({ fileHandle: lastSession.handle, isDirty: false });
    };

    const exportFile = async (type: FileType) => {
        await syncAll();
        const handle = await getSaveHandle(type);
        if (!handle || !(await verifyPermission(handle))) return;
        const exportOk = await sqliteClient.exportFile(type, handle);
        if (exportOk) {
            message.success(`ファイル(${handle?.name})に保存しました`);
        }
    };

    // SolidJSではメモ化オブジェクトで包む必要はないため、そのままプレーンなオブジェクトを返す
    return {
        newFile,
        openFile,
        openSession,
        saveToFile,
        exportToDbFile: () => exportFile('db'),
        exportToCsvFile: () => exportFile('csv')
    };
};
