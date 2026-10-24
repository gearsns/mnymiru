import type { CellChange, CellValue, OnChangeHelpers } from "@/components/CanvasTableGrid";
import { parseNum } from "@/features/common/utils/numFormatter";
import { sqliteClient } from "@/services/sqliteClient";
import { isEmpty } from "@/utils";
import { ItemIndex } from "../constants";

/**
 * 時刻の文字列・数値を "HH:mm" 形式にフォーマットするヘルパー
 * 例: 710 -> "07:10", "710" -> "07:10", "7:10" -> "07:10", 7 -> "07:00"
 */
const formatTime = (val: CellValue): CellValue => {
    if (isEmpty(val)) return val;
    const str = String(val).trim();

    // 既に "HH:mm" 形式っぽい場合はそのままか軽く整形
    if (/^\d{1,2}:\d{2}$/.test(str)) {
        const [h, m] = str.split(":");
        return `${h.padStart(2, "0")}:${m}`;
    }

    // 数字のみの場合（例: "710", "0710", "7" など）
    const digits = str.replace(/\D/g, "");
    if (digits.length === 3) {
        // 710 -> 07:10
        const h = digits.slice(0, 1).padStart(2, "0");
        const m = digits.slice(1, 3);
        return `${h}:${m}`;
    } else if (digits.length === 4) {
        // 0710 -> 07:10
        const h = digits.slice(0, 2);
        const m = digits.slice(2, 4);
        return `${h}:${m}`;
    } else if (digits.length === 1 || digits.length === 2) {
        // 7 -> 07:00, 12 -> 12:00
        const h = digits.padStart(2, "0");
        return `${h}:00`;
    }

    // パースできない変な文字列ならそのまま返すか、必要に応じてハンドリング
    return val;
};

export const updateRelatedData = async (
    row: number, col: number, value: CellValue, helpers: OnChangeHelpers
    , rows: number
    , getCell: (row: number, col: number) => CellValue
) => {
    // 範囲編集（helpers.edits）がある場合はそれを優先し、なければ単一の変更として扱う
    const targetEdits = helpers.edits && helpers.edits.length > 0
        ? helpers.edits
        : [{ row, col, before: null, after: value }];

    // 行ごとに処理するため、rowでソート（上から順に処理）
    const sortedEdits = [...targetEdits].sort((a, b) => a.row - b.row);

    // 今回の変更や補完で確定した値を保持するマップ
    const currentValues = new Map<string, CellValue>();
    const getKey = (r: number, c: number): string => `${r}-${c}`;

    let isEmptyOnly = true;
    // まず初期の変更をマップに登録
    for (const edit of sortedEdits) {
        const valToRegister = edit.col === ItemIndex.time ? formatTime(edit.after) : edit.after;
        currentValues.set(getKey(edit.row, edit.col), valToRegister);
        if (!isEmpty(edit.after)) {
            isEmptyOnly = false;
        }
    }
    // deleteで削除されたときは補完しない
    if (isEmptyOnly) return;

    const changesToMerge: CellChange[] = [];

    // セル値を取得するヘルパー
    // currentValues（今回更新・補完された値）を優先し、なければ store から取得する
    const getVal = (r: number, c: number): CellValue => {
        const key = getKey(r, c);
        if (currentValues.has(key)) {
            return currentValues.get(key) ?? null;
        }
        return getCell(r, c);
    };

    // 値を更新・追加するヘルパー
    // currentValues と changesToMerge の両方に反映させることで、後続の行や同ループ内の getVal で取得可能になる
    const updateVal = (r: number, c: number, val: CellValue) => {
        const formattedVal = c === ItemIndex.time ? formatTime(val) : val;
        currentValues.set(getKey(r, c), formattedVal);
        changesToMerge.push({ row: r, col: c, value: formattedVal });
    };

    for (const edit of sortedEdits) {
        const r = edit.row;
        const c = edit.col;

        // 列のインデックス定義（0始まり）
        // 0: day, 1: shop_name, 2: time, 3: item_name, 4: detail, 
        // 5: expenses, 6: quantity, 7: incomes, 8: total, 9: account, 10: note

        // 1. shop_name (col: 1) に変更あり
        if (c === ItemIndex.shop_name && r > 0) {
            const day = getVal(r, ItemIndex.day);
            const time = getVal(r, ItemIndex.time);
            const account = getVal(r, ItemIndex.account);

            // day, time, account すべてが空白の場合、前の行からコピー
            if (isEmpty(day) && isEmpty(time) && isEmpty(account)) {
                // 前の行のデータも getVal を使って、今回更新された値（updateValされた値）を正しく拾う
                const prevDay = getVal(r - 1, ItemIndex.day);
                const prevTime = getVal(r - 1, ItemIndex.time);
                const prevAccount = getVal(r - 1, ItemIndex.account);

                if (!isEmpty(prevDay)) updateVal(r, ItemIndex.day, prevDay);
                if (!isEmpty(prevTime)) updateVal(r, ItemIndex.time, prevTime);
                if (!isEmpty(prevAccount)) updateVal(r, ItemIndex.account, prevAccount);
            }
        }

        // 2. detail (col: 4) に変更あり
        if (c === ItemIndex.detail && r > 0) {
            const day = getVal(r, ItemIndex.day);
            const shopName = getVal(r, ItemIndex.shop_name);
            const time = getVal(r, ItemIndex.time);
            const account = getVal(r, ItemIndex.account);

            // day, time, shop_name, account すべてが空白の場合、前の行からコピー
            if (isEmpty(day) && isEmpty(shopName) && isEmpty(time) && isEmpty(account)) {
                const prevDay = getVal(r - 1, ItemIndex.day);
                const prevShopName = getVal(r - 1, ItemIndex.shop_name);
                const prevTime = getVal(r - 1, ItemIndex.time);
                const prevAccount = getVal(r - 1, ItemIndex.account);

                if (!isEmpty(prevDay)) updateVal(r, ItemIndex.day, prevDay);
                if (!isEmpty(prevShopName)) updateVal(r, ItemIndex.shop_name, prevShopName);
                if (!isEmpty(prevTime)) updateVal(r, ItemIndex.time, prevTime);
                if (!isEmpty(prevAccount)) updateVal(r, ItemIndex.account, prevAccount);
            }
        }

        // 3. expenses (5), quantity (6), incomes (7) のいずれかに変更あり -> total (8) の計算
        if (c === ItemIndex.expenses || c === ItemIndex.quantity || c === ItemIndex.incomes) {
            const expenses = parseNum(getVal(r, ItemIndex.expenses));
            const rawQuantity = getVal(r, ItemIndex.quantity);
            // quantity は未設定または0なら1とみなす
            const quantity = (isEmpty(rawQuantity) || parseNum(rawQuantity) === 0) ? 1 : parseNum(rawQuantity);
            const incomes = parseNum(getVal(r, ItemIndex.incomes));

            const total = (incomes * quantity) - (expenses * quantity);
            updateVal(r, ItemIndex.total, total);
        }
    }

    if (targetEdits.length === 1) {
        const item = targetEdits[0];
        // time列が直接変更された場合、フォーマットされた値がマージされるようにする
        if (item.col === ItemIndex.time && !isEmpty(item.after)) {
            const formattedAfter = formatTime(item.after);
            if (formattedAfter !== item.after) {
                updateVal(item.row, ItemIndex.time, formattedAfter);
            }
        }
        if (!isEmpty(item.after)
            && getVal(item.row, ItemIndex.day)
            && (item.col === ItemIndex.day || item.col === ItemIndex.shop_name || item.col === ItemIndex.time || item.col === ItemIndex.account)) {
            const fillSameValue = () => {
                const r = item.row;
                const day = item.col === ItemIndex.day ? item.before : getVal(r, ItemIndex.day);
                const shopName = item.col === ItemIndex.shop_name ? item.before : getVal(r, ItemIndex.shop_name);
                const time = item.col === ItemIndex.time ? item.before : getVal(r, ItemIndex.time);
                const account = item.col === ItemIndex.account ? item.before : getVal(r, ItemIndex.account);
                if (isEmpty(day) && isEmpty(shopName) && isEmpty(time) && isEmpty(account)) {
                    return;
                }

                const prevDay = getVal(r - 1, ItemIndex.day);
                const prevShopName = getVal(r - 1, ItemIndex.shop_name);
                const prevTime = getVal(r - 1, ItemIndex.time);
                const prevAccount = getVal(r - 1, ItemIndex.account);
                // 先頭
                if (day !== prevDay
                    || shopName !== prevShopName
                    || time !== prevTime
                    || account !== prevAccount
                ) {
                    for (let rn = r + 1; rn < rows; ++rn) {
                        const nextDay = getVal(rn, ItemIndex.day);
                        const nextShopName = getVal(rn, ItemIndex.shop_name);
                        const nextTime = getVal(rn, ItemIndex.time);
                        const nextAccount = getVal(rn, ItemIndex.account);
                        if (day === nextDay
                            && shopName === nextShopName
                            && time === nextTime
                            && account === nextAccount
                        ) {
                            updateVal(rn, item.col, item.after);
                        } else {
                            return;
                        }
                    }
                }
            }
            fillSameValue();
        }
        if (!isEmpty(item.after) && item.col === ItemIndex.detail) {
            const date = new Date();
            date.setMonth(date.getMonth() - 24);
            const year_month = date.getFullYear() * 100 + date.getMonth() + 1;
            const detail = String(item.after);
            const r = item.row;
            const itemName = getVal(r, ItemIndex.item_name);
            const account = getVal(r, ItemIndex.account);
            const [itemRes, accountRes] = await Promise.all([
                isEmpty(itemName)
                    ? sqliteClient.fetchTopItemByColumn("detail", "item_name", detail, year_month)
                    : Promise.resolve(null),
                isEmpty(account)
                    ? sqliteClient.fetchTopItemByColumn("detail", "account", detail, year_month)
                    : Promise.resolve(null)
            ]);
            if (itemRes && itemRes.cnt > 0) {
                updateVal(item.row, ItemIndex.item_name, itemRes.value);
            }
            if (accountRes && accountRes.cnt > 0) {
                updateVal(item.row, ItemIndex.account, accountRes.value);
            }
        }
    }

    // まとめて変更を反映
    if (changesToMerge.length > 0) {
        helpers.mergeEdits(changesToMerge);
    }
}
