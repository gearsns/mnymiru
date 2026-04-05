import type { Database } from "sql.js";
import type { WorkerActions } from "../../types/typesWorkers";
import { SELECT_MONTH_TOTAL, SELECT_MONTH_TOTAL_BY_ACCOUNT } from "../../db/queries";
import { fetchAll } from "./utils";

type Action = WorkerActions['fetch_month_total'];

export const handleFetchMonthTotal = async (
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
    const query = account ? SELECT_MONTH_TOTAL_BY_ACCOUNT : SELECT_MONTH_TOTAL;
    return fetchAll(db, query, params);
}