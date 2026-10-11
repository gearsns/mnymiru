import type { CellValue } from "@/components/CanvasTableGrid";

// 数値変換用ヘルパー
export const parseNum = (val: CellValue): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string" && val.trim() !== "") {
        const num = Number(val);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};
export const getNumFormat = (val?: number | null) => {
    const i = val ?? 0;
    if (Number.isNaN(i)) {
        return { color: "#f00", type: "text" as const };
    }
    let c = "#ffff";
    if (i > 0) c = "#6495ed"; // ※quantity等は好みで調整してください
    else if (i < 0) c = "coral";
    return { color: c, type: "number" as const };
};
