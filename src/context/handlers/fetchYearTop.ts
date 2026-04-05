import type { Database } from "sql.js";
import type { WorkerActions } from "../../types/typesWorkers";
import { SELECT_YEAR_TOP, SELECT_YEAR_TOP_BY_ACCOUNT } from "../../db/queries";
import { fetchAll } from "./utils";

type Action = WorkerActions['fetch_year_top'];

export const handleFetchYearTop = async (
    db: Database | null,
    { year, account }: Action['payload']
): Promise<Action['response']> => {
    if (!db) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    const params = {
        '@year_min': year * 100 + 1,
        '@year_max': year * 100 + 12,
        ...(account && { '@account': account }) // accountがある場合のみプロパティを追加
    };
    const query = account ? SELECT_YEAR_TOP_BY_ACCOUNT : SELECT_YEAR_TOP;
    return fetchAll(db, query, params);
}
