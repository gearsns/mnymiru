import type { Database } from "sql.js";

export const fetchAll = <T>(db: Database, query: string, params: Record<string, (string | number)>): T[] => {
    const stmt = db.prepare(query);
    try {
        stmt.bind(params);
        const result: T[] = [];
        while (stmt.step()) result.push(stmt.getAsObject() as unknown as T);
        return result;
    } finally {
        stmt.free();
    }
};

export const fetchOne = <T>(db: Database, query: string, params: Record<string, (string | number)>): T | undefined => {
    const stmt = db.prepare(query);
    try {
        stmt.bind(params);
        if (stmt.step()){
            return stmt.getAsObject() as unknown as T;
        }
    } finally {
        stmt.free();
    }
};