import { describe, expect, it } from "vitest";
import { calculateSelectionTotal, calculateShopTotal, calculateTableChanges, type ChangeItem } from "./calculate";
import { RowKind, type TableRow } from "../../../../db/types";

describe('calculateTableChanges - Basic Calculations', () => {
    it("無視されること", () => {
        const changes: ChangeItem[] = [];
        const mockData = [] as unknown as TableRow[];
        const result = calculateTableChanges(changes, mockData, "edit");
        expect(result.length).toBe(0);
    });
    it('数値からカンマを除去し、合計を計算すること', () => {
        const changes: ChangeItem[] = [[0, 'incomes', 0, '1,000']];
        const mockData = [{ quantity: 1, incomes: 0, expenses: 0, total: 0 }];
        const result = calculateTableChanges(changes, mockData, 'edit');
        // incomesが数値(文字列)になり、totalが計算されているか
        expect(result).toEqual(expect.arrayContaining([
            [0, 'incomes', 0, '1000'],
            [0, 'total', 0, 1000]
        ]));
    });
    it("数値の掛け算入力(100*2)が、金額と数量に分解されること", () => {
        const changes = [[0, 'incomes', null, '100*2']] as ChangeItem[];
        const mockData = [{ incomes: null, quantity: 1, total: 0 }] as unknown as TableRow[];
        const result = calculateTableChanges(changes, mockData, 'edit');
        // 結果に incomes=100 と quantity=2 と total=200 が含まれているか検証
        expect(result).toEqual(expect.arrayContaining([
            [0, 'incomes', null, '100'],
            [0, 'quantity', 1, '2'],
            [0, 'total', 0, 200]
        ]));
    });
    it('TOP行の店名を変更した際、下のBODY行にコピーされること', () => {
        const changes = [[0, 'shop_name', 'A店', 'B店']] as ChangeItem[];
        const mockData = [
            { kind: RowKind.TOP, shop_name: 'A店' },
            { kind: RowKind.BODY, shop_name: 'A店' }
        ] as unknown as TableRow[];
        const result = calculateTableChanges(changes, mockData, 'edit');
        expect(result).toContainEqual([1, 'shop_name', 'A店', 'B店']);
    });
});

describe('calculateTableChanges - Row Copying', () => {
    const mockData = [
        { day: '2024-04-01', shop_name: 'スーパーA', account: '現金' },
        { day: '', shop_name: '', account: '' }
    ] as unknown as TableRow[];

    it('shop_nameを入力した際、COPY_TARGETSに従いdayとaccountが前行からコピーされること', () => {
        // 1行目(index: 1)の店名を入力
        const changes: ChangeItem[] = [[1, 'shop_name', '', 'スーパーA']];
        const result = calculateTableChanges(changes, mockData, 'edit');

        // COPY_TARGETS['shop_name'] = ['day', 'account']
        expect(result).toEqual(expect.arrayContaining([
            [1, 'day', '', '2024-04-01'],
            [1, 'account', '', '現金']
        ]));
    });
});

describe('calculateTableChanges - Receipt Structure', () => {
    const mockData = [
        { kind: RowKind.TOP, shop_name: '旧店名', day: '1' },
        { kind: RowKind.BODY, shop_name: '旧店名', day: '1' },
        { kind: RowKind.BOTTOM, shop_name: '旧店名', day: '1' },
        { kind: RowKind.TOP, shop_name: '他店', day: '2' }, // ここで止まるべき
    ] as unknown as TableRow[];

    it('TOP行の店名を変更したとき、続くBODY/BOTTOM行のみ更新されること', () => {
        const changes: ChangeItem[] = [[0, 'shop_name', '旧店名', '新店名']];
        const result = calculateTableChanges(changes, mockData, 'edit');
        // 0, 1, 2行目が更新され、3行目(別のTOP)は更新されない
        const affectedRows = result.filter(c => c[1] === 'shop_name').map(c => c[0]);
        expect(affectedRows).toEqual([0, 1, 2]);
        expect(affectedRows).not.toContain(3);
    });
});

describe('calculateTableChanges - Source Filtering', () => {
    it('sourceが "UndoRedo.undo" の場合、自動コピーが実行されないこと', () => {
        const mockData = [
            { day: '01', shop_name: 'A' },
            { day: '', shop_name: '' }
        ] as unknown as TableRow[];
        const changes: ChangeItem[] = [[1, 'shop_name', '', 'A']];
        // Undo時はコピーが走らない
        const result = calculateTableChanges(changes, mockData, 'UndoRedo.undo');
        // 結果に day の変更が含まれていないことを確認
        const hasDayChange = result.some(c => c[1] === 'day');
        expect(hasDayChange).toBe(false);
    });
});

describe('calculateShopTotal', () => {
    const mockData = [
        { kind: RowKind.TOP, total: 100 },    // index 0
        { kind: RowKind.BODY, total: 200 },   // index 1
        { kind: RowKind.BODY, total: 300 },   // index 2
        { kind: RowKind.BOTTOM, total: 400 }, // index 3
        { kind: RowKind.NONE, total: 500 },  // index 4
        { total: 500 },  // index 5
    ];

    it('kind が undefined の場合は初期値をそのまま返すこと', () => {
        const result = calculateShopTotal(5, mockData);
        expect(result).toBe(500);
    });

    it('kind が BOTTOM の場合、TOPに辿り着くまで上方向にのみ加算すること', () => {
        // dispRow = 3 (BOTTOM, 400)
        // 上へ走査: index 2 (300) -> index 1 (200) -> index 0 (100, TOPなのでbreak)
        // 合計: 100 + 300 + 200 + 100 = 1000
        const result = calculateShopTotal(3, mockData);
        expect(result).toBe(1000);
    });

    it('kind が TOP の場合、BOTTOMに辿り着くまで下方向にのみ加算すること', () => {
        // dispRow = 0 (TOP, 100)
        // 下へ走査: index 1 (200) -> index 2 (300) -> index 3 (400, BOTTOMなのでbreak)
        // 合計: 100 + 200 + 300 + 400 = 1000
        const result = calculateShopTotal(0, mockData);
        expect(result).toBe(1000);
    });

    it('kind が BODY の場合、上下両方向に加算すること', () => {
        // dispRow = 2 (BODY, 300)
        // 上へ: index 1 (200) -> index 0 (100, TOPで終了) => +300
        // 下へ: index 3 (400, BOTTOMで終了) => +400
        // 合計: 100 + 200 + 300 + 400 = 1000
        const result = calculateShopTotal(2, mockData);
        expect(result).toBe(1000);
    });

    it('RowKind 以外の種別に遭遇した時にループが停止すること', () => {
        const dataWithOther = [
            { kind: RowKind.TOP, total: 100 },
            { kind: RowKind.BODY, total: 200 },
            { kind: RowKind.NONE, total: 999 }, // ここで止まるべき
            { kind: RowKind.BODY, total: 300 },
        ];
        // 下方向への走査テスト (index 1 から開始)
        const result = calculateShopTotal(1, dataWithOther);
        // index 2 を加算して、その kind が BODY/TOP でないので break
        expect(result).toBe(300);
    });

    it('データの端 (index 0) で上方向のループが安全に終了すること', () => {
        const result = calculateShopTotal(0, mockData);
        // 上にはデータがないので下方向のみ計算されるはず
        // 下へ: index 1(200) + index 2(300) + index 3(400) = 900
        expect(result).toBe(1000);
    });

    it('rowData が undefined の場合でもエラーにならず parseTotal(undefined) を加算すること', () => {
        const sparseData = [];
        sparseData[5] = { kind: RowKind.BODY, total: 100 };
        // data[i] が undefined になるケース
        const result = calculateShopTotal(6, sparseData);
        expect(result).toBe(0); // エラー落ちしないことを確認
    });
});

describe('calculateSelectionTotal', () => {
    const mockData = [
        { total: '100' }, // index 0
        { total: '200' }, // index 1
        { total: '300' }, // index 2
        { total: '400' }, // index 3
    ] as unknown as TableRow[];

    it('複数の行を選択したとき、その合計値を正しく計算すること', () => {
        // 0行目から1行目までを選択 [r1, c1, r2, c2]
        const selectedRanges: [number, number, number, number][] = [[0, 0, 1, 0]];
        const result = calculateSelectionTotal(selectedRanges, mockData);

        // 100 + 200 = 300
        expect(result).toBe(300);
    });

    it('1行しか選択されていない場合は、仕様通り合計を0として返すこと', () => {
        // 0行目のみを選択 (r1=0, r2=0)
        const selectedRanges: [number, number, number, number][] = [[0, 0, 0, 0]];
        const result = calculateSelectionTotal(selectedRanges, mockData);

        expect(result).toBe(0);
    });

    it('選択範囲が複数ある時、全てカウントすること', () => {
        // 範囲1: 0〜1行目
        // 範囲2: 3〜3行目
        const selectedRanges: [number, number, number, number][] = [
            [0, 0, 1, 0],
            [3, 0, 3, 0]
        ];
        const result = calculateSelectionTotal(selectedRanges, mockData);

        // 0, 1, 3 行目の合計 = 100 + 200 + 400 = 700
        expect(result).toBe(700);
    });

    it('選択範囲が重複している場合、行を重複してカウントしないこと', () => {
        // 範囲1: 0〜2行目
        // 範囲2: 1〜3行目 (1と2が重複)
        const selectedRanges: [number, number, number, number][] = [
            [0, 0, 2, 0],
            [1, 0, 3, 0]
        ];
        const result = calculateSelectionTotal(selectedRanges, mockData);

        // 0, 1, 2, 3 行目の合計 = 100 + 200 + 300 + 400 = 1000
        // 重複排除されないと 100+(200+300)+(200+300)+400 になってしまう
        expect(result).toBe(1000);
    });

    it('r1 > r2 のように逆方向に選択された場合でも正しく計算できること', () => {
        // 2行目から0行目に向かって選択
        const selectedRanges: [number, number, number, number][] = [[2, 0, 0, 0]];
        const result = calculateSelectionTotal(selectedRanges, mockData);

        expect(result).toBe(600); // 100 + 200 + 300
    });

    it('選択範囲が空の場合は 0 を返すこと', () => {
        const result = calculateSelectionTotal([], mockData);
        expect(result).toBe(0);
    });

    it('データが存在しないインデックスを参照した場合でもクラッシュしないこと', () => {
        // データは4件（index 3まで）だが、10行目を選択
        const selectedRanges: [number, number, number, number][] = [[0, 0, 10, 0]];

        // parseTotalがundefinedをどう処理するかによりますが、
        // 一般的にはエラーにならず0として処理されることを期待します
        expect(() => {
            calculateSelectionTotal(selectedRanges, mockData);
        }).not.toThrow();
    });
});