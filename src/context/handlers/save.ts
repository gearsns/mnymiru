import type { Database } from "sql.js";
import type { WorkerActions } from "../../types/typesWorkers";
import { historyService } from "../../services/historyService";
import dayjs from "dayjs";

type Action = WorkerActions['save'];

export const handleSave = async (
    db: Database | null
): Promise<Action['response']> => {
    if (!db) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    const lastSession = await historyService.getLastSession()
    if (!lastSession) {
        throw new Error('SESSION_MISSING');
    }
    const handle = lastSession.handle;
    const dir = lastSession.dir;
    if (!handle) {
        throw new Error('FILE_HANDLE_MISSING');
    }
    // 1. メモリ上のデータを取得 (SharedArrayBuffer が含まれている可能性がある)
    const exportedData = db.export();

    // 2. 新しい「共有されていない」バッファにコピーする
    const dataToSave = new Uint8Array(exportedData);

    // 3. バックアップ
    if (dir) {
        const fileName = handle.name;
        const lastDotIndex = fileName.lastIndexOf('.');
        const baseName = lastDotIndex === -1 ? fileName : fileName.slice(0, lastDotIndex);
        const ext = lastDotIndex === -1 ? '' : fileName.slice(lastDotIndex); // ".txt" など
        // 
        const destName = `${baseName}.${dayjs(Date.now()).format('YYYYMMDDHHmmss')}${ext}`;
        try {
            const srcFile = await handle.getFile();

            // コピー先を作成（または上書き準備）
            const destHandle = await dir.getFileHandle(destName, { create: true });
            const writable = await destHandle.createWritable();
            await srcFile.stream().pipeTo(writable);
            await writable.close();
        } catch {
            // ファイルが存在しない場合はスキップ
        }
    }
    // 4. 書き込みを実行
    const writable = await handle.createWritable();
    // .buffer を渡すか、コピーした Uint8Array そのものを渡す
    await writable.write(dataToSave);
    await writable.close();
    return true;
}