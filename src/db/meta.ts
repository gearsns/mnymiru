export const SELECT_DB_VERSION = `
SELECT value FROM db_meta WHERE key = 'version';
`

export const UPDATE_DB_VERSION = `
INSERT INTO db_meta (key, value)
VALUES ('version', '2')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
`

export const EXISTS_CASH_TALBE = `
SELECT 1 as cnt FROM sqlite_master WHERE type='table' AND name='cash'
`