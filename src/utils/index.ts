// 値が null, undefined, または空文字かどうかを判定する
export const isEmpty = (e: unknown): boolean => e == null || (typeof e === 'string' && e.length === 0)

const WEEKS = ["日", "月", "火", "水", "木", "金", "土"];
const WEEKS_ENGLISH = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const getWeekdayNames = (year: number, monthIndex: number, date: number): [string, string] => {
    const day = (new Date(year, monthIndex, date)).getDay();
    return [WEEKS[day], WEEKS_ENGLISH[day]];
}

export const isValidDay = (year: number, monthIndex: number, date: number): boolean => {
    const dayofmonth = (new Date(year, monthIndex + 1, 0)).getDate();
    return date > 0 && date <= dayofmonth;
}