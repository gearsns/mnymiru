import { describe, expect, it } from "vitest";
import { createGridStore } from "./GridStore";

function makeStore(rows = 5, cols = 4) {
  return createGridStore({ rows, cols });
}

describe("setCellValue / getCell / undo / redo", () => {
  it("値を設定して取得できる", () => {
    const store = makeStore();
    store.setCellValue(0, 0, "hello");
    expect(store.getCell(0, 0)).toBe("hello");
  });

  it("同じ値を設定してもUndo履歴には積まれない", () => {
    const store = makeStore();
    store.setCellValue(0, 0, "hello");
    expect(store.canUndo()).toBe(true);
    // 一旦Undoして履歴をリセット
    store.undo();
    expect(store.canUndo()).toBe(false);
  });

  it("undo/redoで値が往復する", () => {
    const store = makeStore();
    store.setCellValue(1, 1, "A");
    expect(store.getCell(1, 1)).toBe("A");
    store.undo();
    expect(store.getCell(1, 1)).toBeNull();
    store.redo();
    expect(store.getCell(1, 1)).toBe("A");
  });

  it("undo/redoすると影響したセルにアクティブセル・選択範囲が移動する", () => {
    const store = makeStore();
    store.selectCell(3, 3); // 別の場所を選択しておく
    store.setCellValue(1, 2, "X");
    store.undo();
    expect(store.activeCell()).toEqual({ row: 1, col: 2 });
    expect(store.selection().range).toEqual({ r1: 1, c1: 2, r2: 1, c2: 2 });
    store.redo();
    expect(store.activeCell()).toEqual({ row: 1, col: 2 });
  });

  it("何もUndoできない状態でundo()を呼んでも安全", () => {
    const store = makeStore();
    expect(() => store.undo()).not.toThrow();
    expect(() => store.redo()).not.toThrow();
  });
});

describe("mergeCellEdits", () => {
  it("直前のコマンドがまだ先頭にあれば同じコマンドにマージされる（1回のUndoでまとめて戻る）", () => {
    const store = makeStore();
    const token = store.setCellValue(0, 0, "2024-09-01");
    store.mergeCellEdits(token, [{ row: 0, col: 1, value: "日曜日" }]);

    expect(store.getCell(0, 0)).toBe("2024-09-01");
    expect(store.getCell(0, 1)).toBe("日曜日");

    // 1回のUndoで両方戻る
    store.undo();
    expect(store.getCell(0, 0)).toBeNull();
    expect(store.getCell(0, 1)).toBeNull();
    expect(store.canUndo()).toBe(false);
  });

  it("1回のRedoで両方やり直せる", () => {
    const store = makeStore();
    const token = store.setCellValue(0, 0, "A");
    store.mergeCellEdits(token, [{ row: 0, col: 1, value: "B" }]);
    store.undo();
    store.redo();
    expect(store.getCell(0, 0)).toBe("A");
    expect(store.getCell(0, 1)).toBe("B");
  });

  it("間に別の変更が挟まった場合は独立したコマンドとしてマージされる", () => {
    const store = makeStore();
    const token = store.setCellValue(0, 0, "A");
    store.setCellValue(2, 2, "別の変更"); // token が先頭ではなくなる
    store.mergeCellEdits(token, [{ row: 0, col: 1, value: "B" }]);

    // 3つの独立したコマンドがあるはず: setCellValue(0,0), setCellValue(2,2), mergeの分
    store.undo(); // mergedEdits を取り消す -> (0,1) が消える
    expect(store.getCell(0, 1)).toBeNull();
    expect(store.getCell(0, 0)).toBe("A"); // まだ残っている
    expect(store.getCell(2, 2)).toBe("別の変更"); // まだ残っている
  });

  it("トークンが null でも独立したコマンドとして追加できる", () => {
    const store = makeStore();
    store.mergeCellEdits(null, [{ row: 0, col: 0, value: "X" }]);
    expect(store.getCell(0, 0)).toBe("X");
    store.undo();
    expect(store.getCell(0, 0)).toBeNull();
  });

  it("値に変化がない変更は無視される", () => {
    const store = makeStore();
    const before = store.canUndo();
    store.mergeCellEdits(null, [{ row: 0, col: 0, value: null }]); // 元々null
    expect(store.canUndo()).toBe(before);
  });
});

describe("setRangeValues", () => {
  it("範囲内の複数セルをまとめて変更し、Undoは1回で戻る", () => {
    const store = makeStore();
    store.setRangeValues({ r1: 0, c1: 0, r2: 1, c2: 1 }, (r, c) => `${r}-${c}`);
    expect(store.getCell(0, 0)).toBe("0-0");
    expect(store.getCell(1, 1)).toBe("1-1");
    store.undo();
    expect(store.getCell(0, 0)).toBeNull();
    expect(store.getCell(1, 1)).toBeNull();
  });

  it("変化がなければ null を返しUndo履歴に積まれない", () => {
    const store = makeStore();
    const token = store.setRangeValues({ r1: 0, c1: 0, r2: 0, c2: 0 }, () => null);
    expect(token).toBeNull();
    expect(store.canUndo()).toBe(false);
  });
});

describe("setRangeFormat / clearRange", () => {
  it("値は変えずに書式だけ変更する", () => {
    const store = makeStore();
    store.setCellValue(0, 0, 1000);
    store.setRangeFormat({ r1: 0, c1: 0, r2: 0, c2: 0 }, { type: "number", pattern: "#,##0" });
    expect(store.getCell(0, 0)).toBe(1000);
    expect(store.getFormat(0, 0)).toMatchObject({ type: "number", pattern: "#,##0" });
  });

  it("clearRangeで範囲の値がnullになり、Undoで戻る", () => {
    const store = makeStore();
    store.setCellValue(0, 0, "A");
    store.setCellValue(0, 1, "B");
    store.clearRange({ r1: 0, c1: 0, r2: 0, c2: 1 });
    expect(store.getCell(0, 0)).toBeNull();
    expect(store.getCell(0, 1)).toBeNull();
    store.undo();
    expect(store.getCell(0, 0)).toBe("A");
    expect(store.getCell(0, 1)).toBe("B");
  });
});

describe("選択操作", () => {
  it("selectCellでアクティブセルと選択範囲を設定する", () => {
    const store = makeStore();
    store.selectCell(2, 3);
    expect(store.activeCell()).toEqual({ row: 2, col: 3 });
    expect(store.selection().range).toEqual({ r1: 2, c1: 3, r2: 2, c2: 3 });
  });

  it("extend=trueで範囲を拡張する（アクティブセルは動かない）", () => {
    const store = makeStore();
    store.selectCell(1, 1);
    store.selectCell(3, 3, true);
    expect(store.activeCell()).toEqual({ row: 1, col: 1 });
    expect(store.selection().range).toEqual({ r1: 1, c1: 1, r2: 3, c2: 3 });
  });

  it("selectColumnで列全体を選択する", () => {
    const store = makeStore(5, 4);
    store.selectColumn(2);
    expect(store.selection()).toMatchObject({ mode: "col", range: { r1: 0, c1: 2, r2: 4, c2: 2 } });
  });

  it("selectRowで行全体を選択する", () => {
    const store = makeStore(5, 4);
    store.selectRow(1);
    expect(store.selection()).toMatchObject({ mode: "row", range: { r1: 1, c1: 0, r2: 1, c2: 3 } });
  });

  it("selectAllで全セルを選択する", () => {
    const store = makeStore(5, 4);
    store.selectAll();
    expect(store.selection().range).toEqual({ r1: 0, c1: 0, r2: 4, c2: 3 });
  });
});

describe("recordColumnWidthChange", () => {
  it("列幅変更をUndo履歴に記録し、Undo/Redoできる", () => {
    const store = makeStore();
    const before = store.colWidths[0];
    store.setColWidths(0, 200);
    store.recordColumnWidthChange(0, before, 200);
    expect(store.colWidths[0]).toBe(200);
    store.undo();
    expect(store.colWidths[0]).toBe(before);
    store.redo();
    expect(store.colWidths[0]).toBe(200);
  });

  it("列幅変更コマンドはセル範囲を伴わないため、undo/redoでカーソルは動かさない", () => {
    const store = makeStore();
    store.selectCell(2, 2);
    const before = store.colWidths[0];
    store.setColWidths(0, 200);
    store.recordColumnWidthChange(0, before, 200);
    store.undo();
    expect(store.activeCell()).toEqual({ row: 2, col: 2 });
  });
});

describe("ヘッダラベル", () => {
  it("省略時はA,B,C...と1,2,3...になる", () => {
    const store = makeStore();
    expect(store.columnHeaderLabel(0)).toBe("A");
    expect(store.rowHeaderLabel(0)).toBe("1");
  });

  it("配列で指定した名前を優先し、範囲外は既定値にフォールバックする", () => {
    const store = createGridStore({ rows: 3, cols: 5, columnHeaderLabel: ["日付", "商品名"] });
    expect(store.columnHeaderLabel(0)).toBe("日付");
    expect(store.columnHeaderLabel(1)).toBe("商品名");
    expect(store.columnHeaderLabel(2)).toBe("C"); // 配列の範囲外はフォールバック
  });

  it("関数で指定することもできる", () => {
    const store = createGridStore({ rows: 3, cols: 3, rowHeaderLabel: (i) => `#${i + 1}` });
    expect(store.rowHeaderLabel(0)).toBe("#1");
  });
});

describe("fillDown（Ctrl+D 相当）", () => {
  it("単一セル選択: 1つ上のセルの値と書式をコピーする", () => {
    const store = makeStore();
    store.setCellValue(0, 0, 100);
    store.setRangeFormat({ r1: 0, c1: 0, r2: 0, c2: 0 }, { type: "number", pattern: "#,##0" });

    store.fillDown({ r1: 1, c1: 0, r2: 1, c2: 0 });

    expect(store.getCell(1, 0)).toBe(100);
    expect(store.getFormat(1, 0)).toMatchObject({ type: "number", pattern: "#,##0" });
  });

  it("複数行選択: 先頭行の値と書式を残りの行すべてにコピーする", () => {
    const store = makeStore();
    store.setCellValue(0, 0, "A");
    store.setRangeFormat({ r1: 0, c1: 0, r2: 0, c2: 0 }, { color: "#ff0000" });

    store.fillDown({ r1: 0, c1: 0, r2: 2, c2: 0 });

    expect(store.getCell(1, 0)).toBe("A");
    expect(store.getCell(2, 0)).toBe("A");
    expect(store.getFormat(1, 0)).toMatchObject({ color: "#ff0000" });
    expect(store.getFormat(2, 0)).toMatchObject({ color: "#ff0000" });
  });

  it("1回のUndoでまとめて戻る", () => {
    const store = makeStore();
    store.setCellValue(0, 0, "A");
    store.fillDown({ r1: 0, c1: 0, r2: 2, c2: 0 });
    expect(store.getCell(1, 0)).toBe("A");
    store.undo(); // fillDown分を取り消す
    expect(store.getCell(1, 0)).toBeNull();
    expect(store.getCell(2, 0)).toBeNull();
    expect(store.getCell(0, 0)).toBe("A"); // コピー元は別コマンドなので残る
  });

  it("先頭行が0行目の単一セル選択では上に行が無いので何もしない", () => {
    const store = makeStore();
    const token = store.fillDown({ r1: 0, c1: 0, r2: 0, c2: 0 });
    expect(token).toBeNull();
  });

  it("変化が無ければ null を返しUndo履歴に積まれない", () => {
    const store = makeStore();
    const token = store.fillDown({ r1: 1, c1: 0, r2: 1, c2: 0 }); // 両方nullで変化なし
    expect(token).toBeNull();
  });
});

describe("findUsedRange", () => {
  it("データが無ければ (0,0) を返す", () => {
    const store = makeStore();
    expect(store.findUsedRange()).toEqual({ row: 0, col: 0 });
  });

  it("データがある最も右・最も下のセルを返す", () => {
    const store = makeStore(10, 10);
    store.setCellValue(2, 5, "A");
    store.setCellValue(7, 1, "B");
    expect(store.findUsedRange()).toEqual({ row: 7, col: 5 });
  });
});

describe("行の追加（可変行数）", () => {
  it("appendRows で行数・セル・行の高さが増える", () => {
    const store = makeStore(3, 2);
    store.appendRows(2);
    expect(store.rows).toBe(5);
    expect(store.getCell(4, 1)).toBeNull();
    expect(store.rowHeights.length).toBe(5);
    store.setCellValue(4, 1, "X");
    expect(store.getCell(4, 1)).toBe("X");
  });

  it("0以下の行数を指定しても何もしない", () => {
    const store = makeStore(3, 2);
    store.appendRows(0);
    store.appendRows(-1);
    expect(store.rows).toBe(3);
  });

  it("ensureRows は足りない分だけ追加し、足りていれば何もしない", () => {
    const store = makeStore(3, 2);
    store.ensureRows(6);
    expect(store.rows).toBe(6);
    store.ensureRows(4);
    expect(store.rows).toBe(6);
  });

  it("autoAppendRows 未指定なら最終行に入力しても行は増えない", () => {
    const store = makeStore(3, 2);
    store.setCellValue(2, 0, "A");
    expect(store.rows).toBe(3);
  });

  it("autoAppendRows 指定時、最終行に値を入れると n 行追加される", () => {
    const store = createGridStore({ rows: 3, cols: 2, autoAppendRows: 5 });
    store.setCellValue(1, 0, "A"); // 最終行ではない
    expect(store.rows).toBe(3);
    store.setCellValue(2, 0, "B"); // 最終行
    expect(store.rows).toBe(8);
  });

  it("最終行を空にする変更では行を追加しない", () => {
    const store = createGridStore({ rows: 3, cols: 2, autoAppendRows: 5 });
    store.setRangeValues({ r1: 2, c1: 0, r2: 2, c2: 0 }, () => null);
    expect(store.rows).toBe(3);
  });

  it("貼り付け(setRangeValues)・Ctrl+D・mergeCellEdits でも最終行に値が入れば追加される", () => {
    const a = createGridStore({ rows: 2, cols: 2, autoAppendRows: 3 });
    a.setRangeValues({ r1: 1, c1: 0, r2: 1, c2: 1 }, () => "v");
    expect(a.rows).toBe(5);

    const b = createGridStore({ rows: 3, cols: 2, autoAppendRows: 3 });
    b.setCellValue(0, 0, "A");
    b.fillDown({ r1: 0, c1: 0, r2: 2, c2: 0 });
    expect(b.rows).toBe(6);

    const c = createGridStore({ rows: 2, cols: 2, autoAppendRows: 3 });
    const token = c.setCellValue(0, 0, "A");
    c.mergeCellEdits(token, [{ row: 1, col: 1, value: "補完" }]);
    expect(c.rows).toBe(5);
  });

  it("自動追加された行は、その入力の Undo で取り除かれ、Redo で再追加される", () => {
    const store = createGridStore({ rows: 2, cols: 2, autoAppendRows: 3 });
    store.setCellValue(1, 0, "A");
    expect(store.rows).toBe(5);
    store.undo();
    expect(store.getCell(1, 0)).toBeNull();
    expect(store.rows).toBe(2);
    expect(store.rowHeights.length).toBe(2);
    store.redo();
    expect(store.rows).toBe(5);
    expect(store.getCell(1, 0)).toBe("A");
  });

  it("Undo は入力と行追加を1回でまとめて戻す（mergeCellEdits で追加された行も含む）", () => {
    const store = createGridStore({ rows: 2, cols: 2, autoAppendRows: 3 });
    const token = store.setCellValue(0, 0, "A"); // 最終行ではない → 追加なし
    store.mergeCellEdits(token, [{ row: 1, col: 1, value: "補完" }]); // 最終行 → +3
    expect(store.rows).toBe(5);
    store.undo();
    expect(store.rows).toBe(2);
    expect(store.getCell(0, 0)).toBeNull();
    expect(store.getCell(1, 1)).toBeNull();
  });

  it("行追加を伴う入力を連続で行っても、Undo は新しい入力から順に戻る", () => {
    const store = createGridStore({ rows: 2, cols: 1, autoAppendRows: 2 });
    store.setCellValue(1, 0, "A"); // rows: 2 → 4
    store.setCellValue(3, 0, "B"); // rows: 4 → 6
    expect(store.rows).toBe(6);
    store.undo();
    expect(store.rows).toBe(4);
    expect(store.getCell(3, 0)).toBeNull();
    expect(store.getCell(1, 0)).toBe("A");
    store.undo();
    expect(store.rows).toBe(2);
  });

  it("手動の appendRows は Undo しても残る", () => {
    const store = makeStore(3, 2);
    store.appendRows(2);
    store.setCellValue(0, 0, "A");
    store.undo();
    expect(store.rows).toBe(5);
  });

  it("setRangeValues(growRows) は範囲が行数を超える分の行追加を同じUndo単位に含める", () => {
    const store = createGridStore({ rows: 2, cols: 1, autoAppendRows: 2 });
    store.setRangeValues({ r1: 1, c1: 0, r2: 4, c2: 0 }, (r) => `v${r}`, { growRows: true });
    expect(store.getCell(4, 0)).toBe("v4");
    expect(store.rows).toBe(7); // 必要な3行 + 最終行(4)に値が入ったので自動追加2行
    store.undo();
    expect(store.rows).toBe(2);
    expect(store.getCell(1, 0)).toBeNull();
  });

  it("growRows なしなら範囲外の行には書き込まない扱い（従来どおり）", () => {
    const store = makeStore(3, 1);
    store.setRangeValues({ r1: 0, c1: 0, r2: 1, c2: 0 }, () => "x");
    expect(store.rows).toBe(3);
  });

  it("行が増えた後、全選択・列選択・Ctrl+End の範囲が新しい行数に追従する", () => {
    const store = makeStore(3, 2);
    store.appendRows(2);
    store.selectAll();
    expect(store.selection().range).toEqual({ r1: 0, c1: 0, r2: 4, c2: 1 });
    store.selectColumn(1);
    expect(store.selection().range).toEqual({ r1: 0, c1: 1, r2: 4, c2: 1 });
    store.setCellValue(4, 0, "末尾");
    expect(store.findUsedRange()).toEqual({ row: 4, col: 0 });
  });
});
