export const MIGRATION = `
BEGIN TRANSACTION;

INSERT OR IGNORE INTO cash_entries (
    year_month, line_no, day, time, shop_name, item_name, 
    detail, expenses, incomes, quantity, total, account, note
)
SELECT 
    year_month, line_no, day, time, shop_name, item_name, 
    detail, expenses, incomes, quantity, total, account, note
FROM cash
WHERE
 day >= 0
;

DROP TABLE cash;

COMMIT;
`