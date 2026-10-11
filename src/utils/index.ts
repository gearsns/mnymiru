// 値が null, undefined, または空文字かどうかを判定する
export const isEmpty = (e: unknown): boolean => e == null || e === undefined || (typeof e === 'string' && e.length === 0)

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

export const getNextMonth = (inc: number, data: Date = new Date()) => {
    const newDate = new Date(data);
    newDate.setMonth(newDate.getMonth() + inc);
    return newDate;
}

export function getLastDayOfMonth(date: Date): number {
    // 翌月の0日目を指定すると、前月（＝指定した月）の末日が取得される
    const year = date.getFullYear();
    const month = date.getMonth(); // 0〜11

    // new Date(年, 月 + 1, 0) で翌月の0日目（＝当月の末日）を指定
    const lastDay = new Date(year, month + 1, 0);

    return lastDay.getDate();
}
