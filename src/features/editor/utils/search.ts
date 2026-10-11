import type { CellPos, CellValue } from "@/components/CanvasTableGrid";

export const searchValue = (
    value: string,
    pos: CellPos,
    data: CellValue[][]
): CellPos | undefined => {
    if (!value || data.length === 0) return;
    const rows = data.length;
    let startCol = pos.col + 1;
    for (let row = pos.row; row < rows; row++) {
        const cellValues = data[row] ?? [];
        const cols = cellValues.length;
        for (let col = startCol; col < cols; col++) {
            const cellValue = String(cellValues[col] ?? "");
            if (cellValue.includes(value)) {
                return { row, col };
            }
        }
        startCol = 0;
    }
    for (let row = 0; row <= pos.row; row++) {
        const cellValues = data[row] ?? [];
        const cols = cellValues.length;
        for (let col = 0; col < cols; col++) {
            const cellValue = String(cellValues[col] ?? "");
            if (cellValue.includes(value)) {
                return { row, col };
            }
        }
    }
}
