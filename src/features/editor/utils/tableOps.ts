import type { TableData } from "../../../db/types";
import { MyColumnIndexToName } from "../constants";

export const searchTableData = (
    value: string,
    data: TableData, selected: number[][] | undefined, colCount: number,
    direction: 'next' | 'prev'
): { row: number, col: number } | null => {
    const rowCount = data.length;
    const totalCells = rowCount * colCount;

    // 1. 現在の開始位置を「通し番号」に変換
    const [startRow, startCol] = selected?.[0] ?? [0, 0];
    const startPos = startRow * colCount + startCol;
    const step = direction === 'next' ? 1 : -1;

    // 2. 検索の向きに合わせてループを設定
    for (let i = 1; i <= totalCells; i++) {
        // directionに応じてインデックスを計算（1周するように剰余演算を使う）
        const currentPos = (startPos + i * step + totalCells) % totalCells;

        const r = Math.floor(currentPos / colCount);
        const c = currentPos % colCount;

        // 3. 判定 (includesなど)
        const cellData = String(data[r][MyColumnIndexToName[c]] ?? '');
        if (cellData.includes(value)) {
            return { row: r, col: c };
        }
    }
    return null;
}

export const sortTableData = (data: TableData) => {
    // 1. ソート用の「軽量な参照用配列」を作成（メモリと計算を節約）
    // 比較に必要な値だけを事前に準備する
    const mapped = data.map((row, index) => ({
        index,
        row,
        day: parseFloat(String(row.day)) || 0, // NaNを避ける
        time: String(row.time || ''),
        shop: String(row.shop_name || ''),
        account: String(row.account || ''),
    }));

    // 2. ソートの実行
    mapped.sort((a, b) => {
        // Day の比較 (0は後方にするなどの特殊ルールがある場合はここを調整)
        if (a.day !== b.day) {
            if (a.day === 0) return 1;
            if (b.day === 0) return -1;
            return a.day - b.day;
        }

        // 文字列の比較
        if (a.time !== b.time) return a.time.localeCompare(b.time);
        if (a.shop !== b.shop) return a.shop.localeCompare(b.shop);
        if (a.account !== b.account) return a.account.localeCompare(b.account);

        // 念のための安定ソート担保（不要なら削除可）
        return a.index - b.index;
    });
    // 3. データの書き戻し
    return mapped.map(v => v.row);
};

export const duplicateData = (data: TableData, selected: [startRow: number, startCol: number, endRow: number, endCol: number][])
    : [{ startRow: number, startCol: number, endRow: number, endCol: number } | undefined, (string | number)[][]] => {
    if (selected.length === 0) return [undefined, []];

    // 1. 全体の境界（Bounding Box）を計算
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const [r1, c1, r2, c2] of selected) {
        minR = Math.min(minR, r1, r2); maxR = Math.max(maxR, r1, r2);
        minC = Math.min(minC, c1, c2); maxC = Math.max(maxC, c1, c2);
    }
    const range = { startRow: minR, startCol: minC, endRow: maxR, endCol: maxC };

    // 2. afterData を元のデータで初期化（スライスで高速化）
    const afterData: (string | number)[][] = [];
    for (let r = minR; r <= maxR; r++) {
        const row: (string | number)[] = [];
        for (let c = minC; c <= maxC; c++) {
            row.push(data[r][MyColumnIndexToName[c]] as (string | number));
        }
        afterData.push(row);
    }
    // 3. 各選択範囲ごとに「最上段」の値を「それより下」へコピー
    for (const [r1, c1, r2, c2] of selected) {
        const sr = Math.min(r1, r2), er = Math.max(r1, r2);
        const sc = Math.min(c1, c2), ec = Math.max(c1, c2);

        if (sr === er) continue; // 1行しか選択されていない列は変化なし

        for (let c = sc; c <= ec; c++) {
            // 選択された「この列」の「最上段」の値を取得
            const topValue = data[sr][MyColumnIndexToName[c]] as (string | number);

            // 2行目から末尾までコピー
            for (let r = sr + 1; r <= er; r++) {
                // afterData内での相対座標に書き込み
                afterData[r - minR][c - minC] = topValue;
            }
        }
    }
    return [range, afterData];
}