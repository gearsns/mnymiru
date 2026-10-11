import { formatDate, type CellValue } from "@/components/CanvasTableGrid";

export const getDayFormat = (year_month: CellValue, val?: CellValue) => {
    if (!val) {
        return { formatter: () => "" };
    }
    const m = String(year_month).match(/(\d{4})(\d{2})/);
    const d = m ? `${m[1]}/${m[2]}/${val}` : null;
    let color;
    if (m) {
        const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(val));
        switch (day.getDay()) {
            case 0: color = "coral"; break;
            case 6: color = "#6495ed"; break;
        }
    }

    return {
        color,
        formatter: (_value: CellValue): string => {
            return d ? formatDate(d, "D(ddd)") : "";
        }
    };
}

export const getYearMonthFormat = (_value: CellValue) => {
    return {
        formatter: (value: CellValue): string => {
            const m = String(value).match(/(\d{4})(\d{2})/);
            return m ? formatDate(`${m[1]}/${m[2]}`, "YYYY年M月") : "";
        }
    };
}

