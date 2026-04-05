import type { Database } from "sql.js";
import type { TopItem } from "../../db/types";
import type { WorkerActions } from "../../types/typesWorkers";
import { getTopValueByColumnQuery } from "../../db/queries";
import { fetchOne } from "./utils";

type Action = WorkerActions['fetch_top_item_by_column'];

export const handleFetchTopItemByColumn = async (
    db: Database | null,
    {
        srcColumnName,
        dstColumnName,
        value,
        year_month
    }: Action['payload']
): Promise<Action['response']> => {
    if (!db) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    return (fetchOne(db, getTopValueByColumnQuery(srcColumnName, dstColumnName), { '@value': value, '@year_month': year_month })
        || { cnt: 0, value: "" }) as TopItem;
}