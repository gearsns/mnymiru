import 'myhandsontable';

declare module 'myhandsontable' {
  // セルのメタデータ型を拡張
  interface GridSettings {
    sheetName?: string;
  }
  // 列設定の型も拡張しておくと columns で書くときも安心
  interface CellProperties {
    sheetName?: string;
  }
}