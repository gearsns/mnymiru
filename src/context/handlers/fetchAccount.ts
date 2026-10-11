import type { Database } from "sql.js";
import type { WorkerActions } from "../../types/typesWorkers";
import { SELECT_ACCOUNT } from "../../db/queries";
import { fetchAll } from "./utils";

type Action = WorkerActions['fetch_account'];
interface Account {
    account: string;
}
export const handleFetchAccount = async (
    db: Database | null,
    { year }: Action['payload']
): Promise<Action['response']> => {
    if (!db) {
        throw new Error('DB_NOT_INITIALIZED');
    }
    const year_min = year * 100 + 1;
    const year_max = year * 100 + 12;
    const data: Account[] = fetchAll(db, SELECT_ACCOUNT, { '@year_min': year_min, '@year_max': year_max });
    return data.map((item) => item.account);
}
