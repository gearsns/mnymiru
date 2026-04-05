export const SELECT_SHEAT_BY_MONTH = `
SELECT
  day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note,line_no
FROM
 cash_entries
WHERE year_month=@year_month AND is_deleted = 0
ORDER BY
 line_no
`

export const SELECT_ALL = `
SELECT
 year_month,day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note
FROM cash_entries WHERE is_deleted = 0
ORDER BY year_month, line_no
`

export const UPDATE_INVALID_LINE = `
UPDATE cash_entries SET is_deleted=1 WHERE year_month=@year_month
`

export const INSERT_VALUES = `
INSERT INTO cash_entries (
  year_month,day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note,line_no,is_deleted
) VALUES (
  @year_month,@day,@shop_name,@time,@item_name,@detail,@expenses,@quantity,@incomes,@total,@account,@note,@line_no,0
)
ON CONFLICT(year_month, line_no) DO UPDATE SET
    day = excluded.day,
    time = excluded.time,
    shop_name = excluded.shop_name,
    item_name = excluded.item_name,
    detail = excluded.detail,
    expenses = excluded.expenses,
    quantity = excluded.quantity,
    incomes = excluded.incomes,
    total = excluded.total,
    account = excluded.account,
    note = excluded.note,
    is_deleted = 0;
`

const ALLOWED_COLUMNS = ['shop_name', 'item_name', 'detail', 'account', 'note'];
export const getTopValueByColumnQuery = (srcColumnName: string, dstColumnName: string) => {
  if (!ALLOWED_COLUMNS.includes(srcColumnName)) {
    throw new Error(`Invalid column name: ${srcColumnName}`);
  }
  if (!ALLOWED_COLUMNS.includes(dstColumnName)) {
    throw new Error(`Invalid column name: ${dstColumnName}`);
  }
  return `
    SELECT * FROM (
      SELECT 
        ${dstColumnName} AS value, COUNT(*) AS cnt
      FROM cash_entries
      WHERE ${srcColumnName}=@value
        AND LENGTH(${dstColumnName}) > 0
        AND year_month>=@year_month AND is_deleted = 0
      GROUP BY value
    )
    ORDER BY cnt DESC LIMIT 1
  `;
}

export const getTopValuesQuery = (columnName: string) => {
  if (!ALLOWED_COLUMNS.includes(columnName)) {
    throw new Error(`Invalid column name: ${columnName}`);
  }
  return `
    SELECT * FROM (
      SELECT 
        ${columnName} as value, COUNT(*) as cnt
      FROM cash_entries
      WHERE year_month>=@year_month AND is_deleted = 0
      GROUP BY value
    )
    ORDER BY cnt DESC
  `;
}

export const SELECT_BY_KEYWORD = `
SELECT
 year_month,day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note,line_no
FROM cash_entries WHERE
 (  item_name LIKE @keyword ESCAPE '/'
 OR shop_name LIKE @keyword ESCAPE '/'
 OR detail LIKE @keyword ESCAPE '/'
 OR note LIKE @keyword ESCAPE '/'
 OR account LIKE @keyword ESCAPE '/'
 )
 AND is_deleted = 0
ORDER BY year_month,day,line_no ASC
`

export const SELECT_YEAR_TOP_BY_ACCOUNT = `
SELECT
  year_month,day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note,line_no
FROM 
  (
    SELECT 
      cash.*,
      row_number() over (partition by year_month order by total asc) as rank
    FROM cash_entries
    WHERE 
      year_month >= @year_min and year_month <= @year_max and is_deleted = 0
      AND note NOT LIKE '%#除外%'
      AND account = @account
  )
WHERE 
  rank <= 5
ORDER BY
  year_month, total
`

export const SELECT_YEAR_TOP = `
SELECT
  year_month,day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note,line_no
  FROM 
  (
    SELECT 
      cash_entries.*,
      row_number() over (partition by year_month order by total asc) as rank
    FROM cash_entries
    WHERE 
      year_month >= @year_min and year_month <= @year_max AND is_deleted = 0
      AND note NOT LIKE '%#除外%'
  )
WHERE 
  rank <= 5
ORDER BY
  year_month, total
`

export const SELECT_MONTH_TOTAL_BY_ACCOUNT = `
SELECT
  year_month, item_name, sum(total) as total
FROM cash_entries
WHERE
  year_month >= @year_min and year_month <= @year_max and total<0 and is_deleted = 0
  and detail!='繰り越し'
  and detail!='口座振替'
  and note not like '%#除外%'
  and account=@account
GROUP BY year_month,item_name
ORDER BY year_month,item_name
`

export const SELECT_MONTH_TOTAL = `
SELECT
  year_month, item_name, sum(total) as total
FROM cash_entries
WHERE
  year_month >= @year_min and year_month <= @year_max and total<0 and is_deleted = 0
  and detail!='繰り越し'
  and detail!='口座振替'
  and note not like '%#除外%'
  and (account!='' AND account IS NOT NULL)
GROUP BY year_month,item_name
ORDER BY year_month,item_name
`

export const SELECT_ACCOUNT = `
SELECT
  account
FROM cash_entries WHERE
  year_month >= @year_min and year_month <= @year_max and total<0 and is_deleted = 0
  and account!=''
GROUP BY account
ORDER BY account
`