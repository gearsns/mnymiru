import type { Database } from "sql.js";
import { SELECT_SHEAT_BY_MONTH } from "../../db/queries";
import type { WorkerActions } from "../../types/typesWorkers";
import { fetchAll } from "./utils";
import type { TableData, TableRow } from "../../db/types";

type Action = WorkerActions['fetch_sheet'];

export const handleFetchSheet = async (
    db: Database | null, { key }: Action['payload']
): Promise<Action['response']> => {
    if (!db) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    const data: TableData = fetchAll(db, SELECT_SHEAT_BY_MONTH, { '@year_month': key });
    const result: TableData = new Array(data.length > 0 ? (data[data.length - 1].line_no as number) + 1 : 0);
    for (const item of data as Array<TableRow & { line_no: number }>) {
        result[item.line_no] = item;
    }
    return result;
}
