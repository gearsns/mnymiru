import CanvasTableGrid, { type CellValue, type GridStore } from '@/components/CanvasTableGrid';
import styles from './style.module.css';
import { getCellFormat, getOptions, setNavigation } from '../common/readonlyGrid';
import { FileField } from '@kobalte/core/file-field';
import { setIsLoading } from '@/store/dataStore';
import { createSettingsState } from '@/hooks/settingsState';
import { analyzeReceiptImage } from '@/lib/gemini';
import { ItemIndex } from '../common/readonlyGrid/constants';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';

export function Receipt() {
    let store: GridStore | undefined;
    let containerRef: HTMLDivElement | undefined;
    const { settings } = createSettingsState();
    const [isAiAnalyzing, setIsAiAnalyzing] = createSignal(false);

    const handleFileAccept = async (files: File[]) => {
        if (files.length === 0) {
            return;
        }
        const { apiKey, model } = settings();
        const file = files[0];
        setIsLoading(true);
        setIsAiAnalyzing(true);
        try {
            const result = await analyzeReceiptImage(file, apiKey, model);
            let year_month: CellValue = result.date;
            let day = null;
            let time = null;
            let m = result.date.match(/(\d+)-(\d+)-(\d+) (\d+:\d+)/);
            if (m) {
                year_month = Number(m[1]) * 100 + Number(m[2]);
                day = Number(m[3]);
                time = m[4];
            } else {
                m = result.date.match(/(\d+)-(\d+)-(\d+)/);
                if (m) {
                    year_month = Number(m[1]) * 100 + Number(m[2]);
                    day = Number(m[3]);
                    time = m[4];
                }
            }

            const rows: CellValue[][] = [];
            for (const item of result.items) {
                const cells: CellValue[] = [];
                cells[ItemIndex.year_month] = year_month;
                cells[ItemIndex.day] = day;
                cells[ItemIndex.time] = time;
                cells[ItemIndex.shop_name] = result.store_name;
                cells[ItemIndex.detail] = item.name;
                cells[ItemIndex.expenses] = item.unit_price;
                cells[ItemIndex.quantity] = item.quantity;
                cells[ItemIndex.total] = item.amount;
                rows.push(cells);
            }
            if (result.tax) {
                const cells: CellValue[] = [];
                cells[ItemIndex.year_month] = year_month;
                cells[ItemIndex.day] = day;
                cells[ItemIndex.time] = time;
                cells[ItemIndex.shop_name] = result.store_name;
                cells[ItemIndex.detail] = "消費税";
                cells[ItemIndex.expenses] = result.tax;
                cells[ItemIndex.total] = result.tax;
                rows.push(cells);
            }
            if (result.subtotal) {
                const cells: CellValue[] = [];
                cells[ItemIndex.total] = result.subtotal;
                rows.push(cells);
            }
            if (result.total || result.note) {
                const cells: CellValue[] = [];
                cells[ItemIndex.total] = result.total;
                cells[ItemIndex.note] = result.note ?? "";
                rows.push(cells);
            }
            store?.replaceData(rows);
        } finally {
            setIsAiAnalyzing(false);
            setIsLoading(false);
        }
    }
    onMount(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!containerRef || !containerRef.contains(document.activeElement)) {
                return;
            }
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.includes('image')) {
                    const blob = item.getAsFile();
                    if (blob) {
                        handleFileAccept([blob]);
                        e.preventDefault();
                        return;
                    }
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        onCleanup(() => {
            window.removeEventListener('paste', handlePaste);
        });
    });

    return (<div ref={containerRef} class={styles.root}>
        <div class={styles.main}>
            <FileField
                onFileAccept={handleFileAccept}
                class={styles.filefield}
            >
                <FileField.Trigger>選択</FileField.Trigger>
                <FileField.HiddenInput />
            </FileField>
            <Show
                when={isAiAnalyzing()}
                fallback={
                    <span>テーブルにフォーカスがある状態で画像を貼り付けでもレシートの解析を行います。</span>
                }
            >
                <span>画像を解析中です</span>
            </Show>
        </div>
        <div class={styles.grid}>
            <CanvasTableGrid
                options={getOptions()}
                onCellDoubleClick={(e) => setNavigation(e.row, e.col, [], store!)}
                getCellFormat={getCellFormat}
                refStore={(s) => (store = s)}
            />
        </div>

    </div>);
};
