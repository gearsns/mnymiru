export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS cash_entries (
   year_month INTEGER NOT NULL,
   day INTEGER NOT NULL,
   time TEXT NOT NULL,
   line_no INTEGER NOT NULL,
   shop_name TEXT NOT NULL,
   item_name TEXT NOT NULL,
   detail TEXT NOT NULL,
   expenses INTEGER NOT NULL,
   incomes INTEGER NOT NULL,
   quantity INTEGER NOT NULL,
   total INTEGER NOT NULL,
   account TEXT NOT NULL,
   note TEXT NOT NULL,
   is_deleted INTEGER DEFAULT 0,
   PRIMARY KEY (year_month, line_no)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS db_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);
`