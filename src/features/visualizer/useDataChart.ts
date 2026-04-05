import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INITIAL_VALUES, type BarPropsState, type ChartLabel, type ChartValue } from "./constants";
import { sqliteClient } from "../../services/sqliteClient";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { calculateStats, createInitialBarProps, transformChartData } from "./utils";

export const useDataChart = () => {
    // --- 検索条件ステート ---
    const [selectedYear, setSelectedYear] = useState<Dayjs>(dayjs());
    const [currentAccount, setCurrentAccount] = useState<string>("");
    const [accountNames, setAccountNames] = useState([{ value: "", label: "全て" }]);
    const [reloadKey, setReloadKey] = useState(0);

    // --- 表示用ステート ---
    const [chartSize, setChartSize] = useState({ width: 1000, height: 800 });
    const [chartData, setChartData] = useState<{ values: ChartValue[]; labels: ChartLabel[] }>({
        values: INITIAL_VALUES,
        labels: []
    });
    const [barProps, setBarProps] = useState<BarPropsState>({ hover: null });

    const resizeObserver = useRef<ResizeObserver | null>(null);

    useEffect(() => {
        const updateChart = async () => {
            const data = await sqliteClient.fetchMonthTotal(selectedYear.year(), currentAccount);
            const { values, labels } = transformChartData(data);

            // 表示状態の初期化
            const initialBarProps: BarPropsState = createInitialBarProps(labels);

            setChartData({ values, labels });
            setBarProps(initialBarProps);
        };
        updateChart();
    }, [selectedYear, currentAccount, reloadKey]);

    // アカウントリストの更新用
    const handleRefreshAll = async () => {
        try {
            const year = selectedYear.year();
            const accounts = await sqliteClient.fetchAccount(year);
            setAccountNames([
                { value: "", label: "全て" },
                ...accounts.map(item => ({ value: item, label: item }))
            ]);
            setCurrentAccount("");
            setReloadKey(prev => prev + 1);
        } catch (e) {
            console.error("Failed to update chart", e);
        }
    };

    // --- 2. リサイズ監視ロジック ---
    const refContent = useCallback((node: HTMLDivElement | null) => {
        if (resizeObserver.current) {
            resizeObserver.current.disconnect();
        }

        if (node) {
            const tabpane = node.closest(".dock-pane-cache") as HTMLElement;
            if (tabpane) {
                resizeObserver.current = new ResizeObserver(() => {
                    const rect = tabpane.getBoundingClientRect();
                    const height = rect.height - 80;
                    setChartSize(height > 410 ? { width: height * 2.5, height: height - 10 } : { width: 1000, height: 400 });
                });
                resizeObserver.current.observe(tabpane);
            }
        }
    }, []);

    // --- 3. グラフ操作ロジック ---
    const toggleBarVisibility = (dataKey: string) => {
        setBarProps(prev => ({
            ...prev,
            [dataKey]: !prev[dataKey],
            hover: null
        }));
    };

    const setHover = (dataKey: string | null) => {
        setBarProps(prev => ({ ...prev, hover: dataKey }));
    };

    // --- 4. 集計ロジック (useMemo) ---
    const stats = useMemo(() => calculateStats(chartData.values, chartData.labels, barProps), [chartData, barProps]);

    return {
        // States
        selectedYear,
        currentAccount,
        accountNames,
        chartSize,
        chartData,
        barProps,
        refContent,
        stats,
        // Actions
        setSelectedYear,
        setCurrentAccount,
        handleRefreshAll,
        toggleBarVisibility,
        setHover
    };
};