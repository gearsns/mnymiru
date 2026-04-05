import type { Database } from "sql.js";
import type { WorkerActions } from "../../types/typesWorkers";
import { SELECT_BY_KEYWORD } from "../../db/queries";
import { fetchAll } from "./utils";

type Action = WorkerActions['fetch_by_keyword'];

export const handleFetchByKeyword = async (
    db: Database | null,
    { keyword }: Action['payload']
): Promise<Action['response']> => {
    if (!db) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    return fetchAll(db, SELECT_BY_KEYWORD, { '@keyword': `%${keyword.replace(/[%_]/g, "/$&")}%` });
}
