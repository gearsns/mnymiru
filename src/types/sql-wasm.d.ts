declare module '*/sql-wasm.js' {
  import { SqlJsStatic } from 'sql.js';
  const initSqlJs: (config?: any) => Promise<SqlJsStatic>;
  export default initSqlJs;
}
