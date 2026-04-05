import type { Database } from "sql.js";
import type { WorkerActions } from "../../types/typesWorkers";
import initSqlJs from "sql.js";
import { historyService } from "../../services/historyService";
import { INITIAL_SCHEMA } from "../../db/schema";
import { EXISTS_CASH_TALBE, SELECT_DB_VERSION, UPDATE_DB_VERSION } from "../../db/meta";
import { fetchOne } from "./utils";
import { MIGRATION } from "../../db/migration";

type Action = WorkerActions['init'];

export const handleInit = async (
    ctx: { db: Database | null }, { handle, dir, isSession }: Action['payload']
): Promise<Action['response']> => {
    const SQL = await initSqlJs({
        locateFile: () => '../sql-wasm.wasm' // `./${file}` // または自分のpublicパス
    });
    // ファイルハンドルがあれば読み込み、なければ新規
    const lastSession =
        (isSession)
            ? await historyService.getLastSession()
            : undefined;
    if (lastSession) {
        ctx.db = new SQL.Database(new Uint8Array(lastSession.data));
    } else if (handle) {
        const fileHandle = handle;
        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        ctx.db = new SQL.Database(data);
        historyService.initPersistData({ data, handle: fileHandle, dir: dir });
        const fileName = (dir)
            ? `${dir.name}/${fileHandle.name}`
            : fileHandle.name;
        await historyService.addHistory(fileName, fileHandle, dir);
    } else {
        ctx.db = new SQL.Database();
        historyService.initPersistData();
    }
    ctx.db.exec(INITIAL_SCHEMA);
    const db_version = fetchOne(ctx.db, SELECT_DB_VERSION, {}) as { value: string };
    if (db_version?.value !== '2') {
        const is_exists_cash = fetchOne(ctx.db, EXISTS_CASH_TALBE, {}) as { cnt: number };
        if (is_exists_cash?.cnt > 0) {
            ctx.db.exec(MIGRATION);
        }
        ctx.db.exec(UPDATE_DB_VERSION);
    }
    return true;
}