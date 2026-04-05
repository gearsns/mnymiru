import { getWeekdayNames, isValidDay } from "../../../utils";

export const splitYearMonth = (year_month: number) => [Math.trunc(year_month / 100), year_month % 100 - 1];

export const getDayDisplayInfo = (value: unknown, yearMonth: number | null) => {
    if (value === null || value === undefined || value === '') return null;

    const day = Math.trunc(Number(value));
    if (day <= 0 || !yearMonth) return null;

    const [year, month] = splitYearMonth(yearMonth);
    if (isValidDay(year, month, day)) {
        const [week, week_en] = getWeekdayNames(year, month, day);
        return {
            text: `${day} (${week})`,
            className: `cell_${week_en}`
        };
    }
    return null;
};