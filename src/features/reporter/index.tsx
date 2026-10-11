import styles from './style.module.css';
import CanvasTableGrid, { type GridStore } from "@/components/CanvasTableGrid";
import CustomDatePicker from "@/components/DatePicker";
import { sqliteClient } from '@/services/sqliteClient';
import { createSignal } from 'solid-js';
import { ChevronDown } from 'lucide-solid';
import { CommonSelect } from '@/components/CommonSelect';
import { CommonButton } from '@/components/CommonButton';
import { convertCashTableToCellValue, getCellFormat, getOptions, setNavigation } from '../common/readonlyGrid';

type AccountOption = {
    value: string;
    label: string;
};

export function Reporter() {
    let store: GridStore | undefined;
    let lines: number[] = [];
    const [account, setAccount] = createSignal<string | undefined>("");
    const [accountNames, setAccountNames] = createSignal<AccountOption[]>([{ value: "", label: "全て" }]);
    const [date, setDate] = createSignal(new Date());

    const search = async () => {
        const data = await sqliteClient.fetchYearTop(date().getFullYear(), account());
        const { rows, lines: newLines } = convertCashTableToCellValue(data);
        lines = newLines;
        store?.replaceData(rows);
    };

    const handleSearch = async () => {
        const accounts = await sqliteClient.fetchAccount(date().getFullYear());
        setAccountNames([{ value: "", label: "全て" }, ...accounts.map(item => { return { value: item, label: item }; })]);
        search();
    }

    const handleYearChange = (value: Date) => {
        setDate(value);
        search();
    }

    const handleAccountChange = (item: AccountOption | null) => {
        setAccount(item?.value);
        search();
    }

    return (<div class={styles.root}>
        <div class={styles.main}>
            <CommonButton onclick={handleSearch}>更新</CommonButton>
            <CustomDatePicker picker="year" value={date()} onChange={handleYearChange} />
            <CommonSelect<AccountOption>
                options={accountNames()}
                onChange={handleAccountChange}
                optionValue="value"
                optionTextValue="label"
                optionLabelKey="label"
                placeholder="全て"
                icon={<ChevronDown stroke-width={1} />}
            />
        </div>
        <div class={styles.grid}>
            <CanvasTableGrid
                options={getOptions()}
                onCellDoubleClick={(e) => setNavigation(e.row, e.col, lines, store!)}
                getCellFormat={getCellFormat}
                refStore={(s) => (store = s)}
                readOnly={true} />
        </div>
    </div >);
}
