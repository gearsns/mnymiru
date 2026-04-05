import type { Database } from "sql.js";
import type { WorkerActions } from "../../types/typesWorkers";
import { getTopValuesQuery } from "../../db/queries";
import { fetchAll } from "./utils";

type Action = WorkerActions['fetch_top_items'];

export const handleFetchTopItems = async (
    db: Database | null,
    {
        columnName,
        year_month
    }: Action['payload']
): Promise<Action['response']> => {
    if (!db) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    return fetchAll(db, getTopValuesQuery(columnName), { '@year_month': year_month });
}
