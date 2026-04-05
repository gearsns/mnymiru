import dayjs from "dayjs";

export const getNextSheetId = (currentId: string, offset: number): string => {
    const current = dayjs(currentId, "YYYYMM").isValid()
        ? dayjs(currentId, "YYYYMM")
        : dayjs();
    return current.add(offset, "month").format("YYYYMM");
};

export const getSheetIdFromDate = (date: unknown): string | null => {
    return dayjs.isDayjs(date) ? date.format("YYYYMM") : null;
};