import type { TableRow } from "../../../db/types"
import { isEmpty } from "../../../utils"

export { isEmpty };

export const isSameItem = (d1: TableRow, d2: TableRow, col: keyof TableRow): boolean => {
    const i1 = d1[col];
    const i2 = d2[col];

    // 1. 厳密等価なら即終了 (null === null, undefined === undefined, 同じ文字列など)
    if (i1 === i2) return true;

    // 2. 片方が isEmpty なら、もう片方も isEmpty である時のみ true
    // (既に i1 === i2 を抜けているので、ここでは「両方空」か「片方だけ空」かを判定)
    const empty1 = isEmpty(i1);
    const empty2 = isEmpty(i2);

    if (empty1 || empty2) {
        return empty1 && empty2;
    }

    // 3. どちらも空でない場合のみ、文字列として比較
    return String(i1) === String(i2);
}