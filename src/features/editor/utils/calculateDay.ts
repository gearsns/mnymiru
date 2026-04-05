import { getWeekdayNames, isValidDay } from "../../../utils";

// 型定義
export type DayInfo = {
    text?: string;
    classes: string[];
};

/** 1. 年月の解析ロジック */
export const parseYearMonth = (sheetName: string | undefined, fallbackDate: Date = new Date()) => {
    const m = sheetName?.match(/^(\d{4})(\d{2})$/);
    return m
        ? { year: Number(m[1]), month: Number(m[2]) - 1 }
        : { year: fallbackDate.getFullYear(), month: fallbackDate.getMonth() };
};

/** 2. 表示内容とクラスの判定ロジック */
export const calculateDayCell = (
    value: unknown,
    year: number,
    month: number,
    isSameDay: boolean,
    nextIsSameDay: boolean | undefined
): DayInfo => {
    let day = -1;
    if (typeof value === 'string' && value.match(/^\s*[0-9]+\s*$/)) {
        day = Math.trunc(Number(value));
    } else if (typeof value === 'number') {
        day = value;
    }

    const classes: string[] = [];
    let text: string | undefined = undefined;

    if (isValidDay(year, month, day)) {
        const [week, week_en] = getWeekdayNames(year, month, day);

        if (isSameDay) {
            classes.push(nextIsSameDay ? 'cell_row_body' : 'cell_row_bottom');
            classes.push('cell_day_same');
        } else if (nextIsSameDay) {
            classes.push('cell_row_top');
        }

        classes.push(`cell_${week_en}`);
        text = `${day} (${week})`;
    } else if (day === 0 || day == null) {
        text = "";
    } else if ((typeof value === 'string' && value.length > 0) || typeof value === 'number') {
        classes.push('cell_day_error');
    }

    return { text, classes };
};