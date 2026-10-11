import { createSignal, Show, For, onMount, onCleanup, createEffect } from "solid-js";
import styles from './style.module.css';

type ViewMode = "year" | "month";

interface CustomDatePickerProps {
    value?: Date;
    onChange?: (date: Date) => void;
    picker?: "year" | "month"; // 年だけ、または年月
}

export default function CustomDatePicker(props: CustomDatePickerProps) {
    const [isOpen, setIsOpen] = createSignal(false);
    const initialDate = props.value || new Date();

    // 内部で保持する選択中の日付と表示中の年
    const [selectedDate, setSelectedDate] = createSignal<Date>(initialDate);
    const [viewYear, setViewYear] = createSignal<number>(initialDate.getFullYear());

    // 初期ビューモード（pickerの指定に従う）
    const defaultMode: ViewMode = props.picker === "year" ? "year" : "month";
    const [viewMode, setViewMode] = createSignal<ViewMode>(defaultMode);

    // 年の範囲（10年単位のページネーション用）
    const [decadeStart, setDecadeStart] = createSignal(
        Math.floor(initialDate.getFullYear() / 10) * 10
    );

    createEffect(() => {
        if (props.value) {
            setSelectedDate(props.value);
            setViewYear(props.value.getFullYear());
            setDecadeStart(Math.floor(props.value.getFullYear() / 10) * 10);
        }
    });
    // コンテナ要素への参照
    let containerRef!: HTMLDivElement;

    // 外側クリックを検知して閉じる処理
    const handleClickOutside = (e: MouseEvent) => {
        if (isOpen() && containerRef && !containerRef.contains(e.target as Node)) {
            setIsOpen(false);
        }
    };

    onMount(() => {
        document.addEventListener("click", handleClickOutside);
    });

    onCleanup(() => {
        document.removeEventListener("click", handleClickOutside);
    });

    const months = [
        "1月", "2月", "3月", "4月", "5月", "6月",
        "7月", "8月", "9月", "10月", "11月", "12月"
    ];

    // 表示用文字列のフォーマット
    const formattedValue = () => {
        const d = selectedDate();
        if (props.picker === "year") {
            return `${d.getFullYear()}年`;
        }
        return `${d.getFullYear()}年 ${d.getMonth() + 1}月`;
    };

    const handleYearSelect = (year: number) => {
        if (props.picker === "year") {
            const newDate = new Date(year, 0, 1);
            setSelectedDate(newDate);
            props.onChange?.(newDate);
            setIsOpen(false);
        } else {
            setViewYear(year);
            setViewMode("month");
        }
    };

    const handleMonthSelect = (monthIndex: number) => {
        const newDate = new Date(viewYear(), monthIndex, 1);
        setSelectedDate(newDate);
        props.onChange?.(newDate);
        setIsOpen(false);
    };

    return (
        <div class={styles.root}>
            <div class={styles["custom-datepicker-container"]} ref={containerRef}>
                {/* 入力欄トリガー */}
                <div
                    class={styles["datepicker-input"]}
                    onClick={() => setIsOpen(!isOpen())}
                >
                    <span>{formattedValue()}</span>
                    <span class={styles["datepicker-icon"]}>📅</span>
                </div>

                {/* ポップアップパネル */}
                <Show when={isOpen()}>
                    <div class={styles["datepicker-popup"]}>
                        {/* ヘッダー（ナビゲーション） */}
                        <div class={styles["datepicker-header"]}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (viewMode() === "year") {
                                        setDecadeStart(decadeStart() - 10);
                                    } else {
                                        setViewYear(viewYear() - 1);
                                    }
                                }}
                            >
                                «
                            </button>

                            <span
                                class={styles["datepicker-header-title"]}
                                onClick={() => {
                                    if (props.picker !== "year" && viewMode() === "month") {
                                        setViewMode("year");
                                    }
                                }}
                            >
                                <Show when={viewMode() === "year"}>
                                    {decadeStart()}年 - {decadeStart() + 9}年
                                </Show>
                                <Show when={viewMode() === "month"}>
                                    {viewYear()}年
                                </Show>
                            </span>

                            <button
                                type="button"
                                onClick={() => {
                                    if (viewMode() === "year") {
                                        setDecadeStart(decadeStart() + 10);
                                    } else {
                                        setViewYear(viewYear() + 1);
                                    }
                                }}
                            >
                                »
                            </button>
                        </div>

                        {/* 本文：年選択ビュー */}
                        <Show when={viewMode() === "year"}>
                            <div class={`${styles["datepicker-grid"]} ${styles["years-grid"]}`}>
                                <For each={Array.from({ length: 12 }, (_, i) => decadeStart() - 1 + i)}>
                                    {(year) => (
                                        <div
                                            class={styles["datepicker-cell"]}
                                            classList={{
                                                [styles.selected]: selectedDate().getFullYear() === year,
                                                [styles.muted]: year < decadeStart() || year > decadeStart() + 9
                                            }}
                                            onClick={() => handleYearSelect(year)}
                                        >
                                            {year}
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>

                        {/* 本文：月選択ビュー */}
                        <Show when={viewMode() === "month" && props.picker !== "year"}>
                            <div class={`${styles["datepicker-grid"]} ${styles["months-grid"]}`}>
                                <For each={months}>
                                    {(monthName, index) => (
                                        <div
                                            class={styles["datepicker-cell"]}
                                            classList={{
                                                [styles.selected]:
                                                    selectedDate().getFullYear() === viewYear() &&
                                                    selectedDate().getMonth() === index()
                                            }}
                                            onClick={() => handleMonthSelect(index())}
                                        >
                                            {monthName}
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>
                </Show>
            </div>
        </div>
    );
}
