import styles from './style.module.css';
import { createSignal } from 'solid-js';
import { ChevronDown } from 'lucide-solid';
import CustomDatePicker from "@/components/DatePicker";
import { sqliteClient } from '@/services/sqliteClient';
import { transformChartData } from './utils/transformChartData';
import type { ChartLabel, ChartValue } from './constants';
import { CommonSelect } from '@/components/CommonSelect';
import { CommonButton } from '@/components/CommonButton';
import { StackedBarChart } from './StackedBarChart';

type AccountOption = {
    value: string;
    label: string;
};

export function Visualizer() {
    const [account, setAccount] = createSignal<string | undefined>("");
    const [accountNames, setAccountNames] = createSignal<AccountOption[]>([{ value: "", label: "全て" }]);
    const [date, setDate] = createSignal(new Date());
    const [chartValues, setChartValues] = createSignal<ChartValue[]>([]);
    const [chartLabels, setChartLabels] = createSignal<ChartLabel[]>([]);

    const search = async () => {
        const data = await sqliteClient.fetchMonthTotal(date().getFullYear(), account());
        const { values, labels } = transformChartData(data);
        setChartValues(values);
        setChartLabels(labels);
    }
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
            <StackedBarChart
                categories={['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']}
                series={chartLabels()}
                values={chartValues()}
            />
        </div>
    </div>);
}
