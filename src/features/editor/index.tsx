import CustomDatePicker from "@/components/DatePicker";
import styles from './style.module.css';
import CanvasTableGrid, { type CellValue, type DropdownOption, type GridStore, type OnChangeHelpers, type SelectionRange } from "@/components/CanvasTableGrid";
import { ChevronLeft, ChevronRight } from "lucide-solid";
import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { SearchInput } from "@/components/SearchInput";
import { CASH_FIELD_LABELS, type TopItem } from "@/db/types";
import { columnDefs, INPUTSHEET_INIT_ROWS, ColumnIndexToName, ColumnNameToIndex } from "./constants";
import { sqliteClient } from "@/services/sqliteClient";
import { clearNavigation, dataStore, registerSyncAction, setIsDirty, setIsLoading, unregisterSyncAction } from "@/store/dataStore";
import type { GridController } from "@/components/CanvasTableGrid/gridController";
import { getMigemo } from "@/services/migemo";
import { filterResults, getSortedCounts, isAutocompleteIndex } from "./utils/autocomplete";
import type { Migemo } from "jsmigemo";
import { createFileAction } from "@/hooks/fileAction";
import { CommonButton } from "@/components/CommonButton";
import { getNextMonth } from "@/utils";
import { getCellFormat } from "./utils/cellFormat";
import { calculateRange, calculateShopTotal } from "./utils/calculate";
import { convertCellValueToTable, convertTableToCellValue } from "./utils/renderers";
import { rowsCompare } from "./utils/sort";
import { searchValue } from "./utils/search";
import { updateRelatedData } from "./utils/updateData";
import { createShortcuts } from "./utils/shortcuts";

let migemo: Migemo;
migemo = await getMigemo()!;

export function Editor() {
    let store: GridStore | undefined;
    let gridController: GridController;
    let activeSheetID = "";
    let editorId = "";
    const colHeaders = columnDefs.map(c => CASH_FIELD_LABELS[c.data]);
    const colWidths = columnDefs.map(c => c.width);
    const [currentDate, setCurrentDate] = createSignal(new Date());
    const [status, setStatus] = createSignal<string>();
    const [shopTotal, setSthopTotal] = createSignal<string>();
    const { saveToFile } = createFileAction();

    const syncCurrentSheet = async () => {
        if (!store!.isDirty) return;

        const tableData = convertCellValueToTable(store!.data.cells);
        await sqliteClient.syncSheet(Number(activeSheetID), tableData);
        store!.markClean();
    };

    onMount(() => {
        editorId = `editor-${crypto.randomUUID()}`;
        registerSyncAction(editorId, syncCurrentSheet);
        createShortcuts({
            'ctrl+s': handleSave,
        });
    });

    onCleanup(() => {
        unregisterSyncAction(editorId);
    });

    createEffect(
        on(() => store!.isDirty(), () => {
            setIsDirty(true);
        })
    )

    createEffect(
        on(currentDate, (newDate, prevDate) => {
            if (!prevDate) {
                search(newDate);
                return;
            }
            const saveData = async () => {
                await syncCurrentSheet();
                search(newDate);
            };
            saveData();
        })
    );
    createEffect(on(() => dataStore.fileSessionId, (id) => {
        if (!id) return;
        store!.markClean();          // 旧ファイルの未同期フラグを捨てる
        activeSheetID = "";
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (getSheetId(currentDate()) !== getSheetId(thisMonth)) {
            setCurrentDate(thisMonth);   // currentDate の effect 経由で search される
        } else {
            search(thisMonth);
        }
    }));

    createEffect(
        on(() => dataStore.navigationTarget,
            (target) => {
                if (!target) return;
                const jumpCell = async () => {
                    if (target.sheetId === activeSheetID) {
                        const col = target.col ? ColumnNameToIndex[target.col] : store!.activeCell().col;
                        const row = target.row ?? store!.activeCell().row;
                        gridController!.jumpToCell(row, col);
                    } else {
                        const m = String(target.sheetId).match(/(\d{4})(\d{2})/);
                        if (m) {
                            await search(new Date(Number(m[1]), Number(m[2]) - 1, 1));
                            const col = target.col ? ColumnNameToIndex[target.col] : store!.activeCell().col;
                            const row = target.row ?? store!.activeCell().row;
                            gridController!.jumpToCell(row, col);
                        }
                    }
                    clearNavigation();
                }
                jumpCell();
            }
        )
    );

    const getSheetId = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;

    const search = async (newDate: Date) => {
        if (!dataStore.fileSessionId) return;
        const d = newDate;
        const year_month = getSheetId(d);
        activeSheetID = year_month;
        const data = await sqliteClient.fetchSheet(year_month);
        const rows = convertTableToCellValue(data);
        store?.replaceData(rows);
        gridController.focus();
    };

    const offsetYear = (offset: number) => {
        const d = currentDate();
        const newDate = new Date(d.getFullYear(), d.getMonth() + offset, 1);
        setCurrentDate(newDate);
    }

    const handleToday = () => {
        setCurrentDate(new Date());
    }

    const handleChange = async (row: number, col: number, value: CellValue, helpers: OnChangeHelpers) => {
        updateRelatedData(row, col, value, helpers, store!.rows, store!.getCell);
    }

    const handleSort = () => {
        store!.sortRows(rowsCompare);
        gridController.focus();
    }

    const fetchAutocompleteSource = async (col: number): Promise<DropdownOption[]> => {
        const date = getNextMonth(-3);
        let dbItems: TopItem[] = [];
        try {
            dbItems = await sqliteClient.fetchTopItems(ColumnIndexToName[col], date.getFullYear() * 100 + date.getMonth() + 1);
        } catch {/**/ }

        return dbItems.map((item) => ({ value: item.value, label: item.value }));
    }

    const filterSource = (options: DropdownOption[], query: string) => {
        const rowregex = new RegExp(migemo.query(query), 'i');
        const curItems = getSortedCounts(store!.data.cells, store!.activeCell().col);
        return filterResults(curItems, options, rowregex);
    }

    const handleSearch = (value: string) => {
        const pos = store!.activeCell();
        const result = searchValue(value, pos, store!.data.cells);
        if (result) {
            gridController.jumpToCell(result.row, result.col);
        }
    }

    const handleSave = async () => {
        if (!dataStore.isDirty) return;
        try {
            setIsLoading(true);
            await saveToFile();
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div class={styles.root}>
            <div class={styles.header}>
                <CommonButton onClick={handleSave} disabled={!dataStore.isDirty}>保存</CommonButton>
                <CommonButton onclick={handleSort}>並べ替え</CommonButton>
                <div class={styles.month}>
                    <CommonButton onclick={() => offsetYear(-1)}><ChevronLeft stroke-width={1} /></CommonButton>
                    <CommonButton onclick={handleToday}>今月</CommonButton>
                    <CustomDatePicker value={currentDate()} onChange={(newDate) => setCurrentDate(newDate)} />
                    <CommonButton onclick={() => offsetYear(1)}><ChevronRight stroke-width={1} /></CommonButton>
                </div>
                <SearchInput onSearch={handleSearch} />
            </div>
            <div class={styles.grid}>
                <CanvasTableGrid
                    options={{
                        rows: INPUTSHEET_INIT_ROWS,
                        cols: colHeaders.length,
                        columnHeaderLabel: colHeaders,
                        colWidths,
                    }}
                    dropdownOptions={(_row, col) => {
                        if (isAutocompleteIndex(col)) return fetchAutocompleteSource(col);
                    }}
                    dropdownFilter={filterSource}
                    onSelectionChange={(range: SelectionRange) => {
                        setStatus(calculateRange(range, store!.getCell));
                        setSthopTotal(calculateShopTotal(range.c1, store!.rows, store!.getCell));
                    }}
                    onChange={handleChange}
                    getCellFormat={(row, col, { value, getCell }) => getCellFormat(row, col, value, getCell, currentDate())}
                    ref={(r) => (gridController = r)}
                    refStore={(s) => (store = s)}
                />
            </div>
            <div class={styles.footer}>
                <span>{status()}</span><span>{shopTotal()}</span>
            </div>
        </div >
    );
}
