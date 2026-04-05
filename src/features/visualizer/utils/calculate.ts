import type { BarPropsState, ChartLabel, ChartValue } from "../constants";

/** グラフの表示切り替え初期状態を作成 */
export const createInitialBarProps = (labels: ChartLabel[]): BarPropsState => {
    const props: BarPropsState = { hover: null };
    labels.forEach(l => {
        props[l.key] = false; // デフォルトは表示（非表示フラグがfalse）
    });
    return props;
};

/** 合計と平均を計算する（純粋な計算ロジック） */
export const calculateStats = (
    values: ChartValue[],
    labels: ChartLabel[],
    barProps: BarPropsState
) => {
    let total = 0;
    const activeMonths = new Set<number>();

    values.forEach(val => {
        labels.forEach(label => {
            if (barProps[label.key]) return; // 非表示（true）なら除外
            
            const amount = val[label.key];
            if (typeof amount === 'number') {
                total += amount;
                activeMonths.add(val.month);
            }
        });
    });

    return {
        monthTotal: total,
        monthAverage: activeMonths.size ? total / activeMonths.size : 0
    };
};