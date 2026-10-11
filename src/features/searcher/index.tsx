import CanvasTableGrid, { type GridStore } from "@/components/CanvasTableGrid";
import { SearchInput } from "@/components/SearchInput";
import { sqliteClient } from "@/services/sqliteClient";
import styles from './style.module.css';
import { convertCashTableToCellValue, getCellFormat, getOptions, setNavigation } from "../common/readonlyGrid";

export function Searcher() {
    let store: GridStore | undefined;
    let lines: number[] = [];

    const handleSearch = async (value: string) => {
        const data = await sqliteClient.fetchByKeyword(value);
        const { rows, lines: newLines } = convertCashTableToCellValue(data);
        lines = newLines;
        store?.replaceData(rows);
    }

    return (
        <div class={styles.root}>
            <div class={styles.main}>
                <SearchInput onSearch={handleSearch} />
            </div>
            <div class={styles.grid}>
                <CanvasTableGrid
                    options={getOptions()}
                    onCellDoubleClick={(e) => setNavigation(e.row, e.col, lines, store!)}
                    getCellFormat={getCellFormat}
                    refStore={(s) => (store = s)}
                    readOnly={true} />
            </div>
        </div>
    );
}
