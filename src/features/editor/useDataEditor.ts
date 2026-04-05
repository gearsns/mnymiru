import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDataStore } from "../../store/useDataStore";
import dayjs from "dayjs";
import { useFileAction } from "../../hooks/useFileAction";
import type { HotTable } from "react-myhandsontable";
import { sqliteClient } from "../../services/sqliteClient";
import { useHotSettings } from "./useHotSettings";
import { duplicateData, searchTableData, setConfgAll, sortTableData, getNextSheetId, getSheetIdFromDate } from "./utils";
import { useHandsontableResize } from "../common/useHandsontableResize";
import { columns } from "./renderers";
import { useAutoSync } from "./useAutoSync";

export const useDataEditor = (
    hotRef: React.RefObject<HotTable | null>,
    containerRef: React.RefObject<HTMLDivElement | null>
) => {
    // Store
    const fileSessionId = useDataStore((state) => state.fileSessionId);
    const isFileDirty = useDataStore((state) => state.isDirty);
    const navigationTarget = useDataStore((state) => state.navigationTarget);
    const clearNavigation = useDataStore((state) => state.clearNavigation);
    const registerSyncAction = useDataStore((state) => state.registerSyncAction);
    const unregisterSyncAction = useDataStore((state) => state.unregisterSyncAction);
    // State
    const editor_id = useId();
    const [isLoading, setIsLoading] = useState(false);
    const [activeSheetId, setActiveSheetId] = useState(dayjs().format("YYYYMM"));
    const { saveToFile } = useFileAction();
    const [statusTotalText, setStatusTotalText] = useState("");
    const [statusShopTotalText, setStatusShopTotalText] = useState("");
    // Refs
    const appliedSessionIdRef = useRef<string | null>(null);
    const lastQueryRef = useRef<string>('');
    const activeSheetIdRef = useRef(activeSheetId);
    const { isDirtyRef, setDirtyInternal, requestDelayedAction, clearTimer } = useAutoSync();
    // 現在のデータを SQLite に同期する共通関数
    const syncCurrentSheet = useCallback(async () => {
        if (!isDirtyRef.current) return;

        const hot = hotRef.current?.hotInstance;
        const currentData = hot?.getSourceData();
        const targetSheetId = activeSheetIdRef.current;
        if (currentData && targetSheetId) {
            await sqliteClient.syncSheet(Number(targetSheetId), currentData);
            setDirtyInternal(false);
        }
    }, [hotRef, isDirtyRef, setDirtyInternal]);

    const requestAutoSync = useCallback(() => {
        // 3秒間入力がなかったら自動保存
        requestDelayedAction(syncCurrentSheet);
    }, [requestDelayedAction, syncCurrentSheet]);

    const hotSettings = useHotSettings(activeSheetId, isLoading, requestAutoSync, setStatusTotalText, setStatusShopTotalText, hotRef);

    // 1. 外部（Store）への同期アクション登録
    // 自分の最新の値をキャプチャした保存関数を登録し続ける
    useEffect(() => {
        registerSyncAction(editor_id, syncCurrentSheet);
        return () => unregisterSyncAction(editor_id);
    }, [editor_id, registerSyncAction, unregisterSyncAction, syncCurrentSheet]);
    // 2. シート切り替えロジック (手動・自動共通)
    const loadSheet = useCallback(async (sheetId: string) => {
        //console.log(`loadSheet:${sheetId}`);
        setIsLoading(true);
        try {
            clearTimer();
            await syncCurrentSheet(); // 切り替え前に保存

            const newData = await sqliteClient.fetchSheet(sheetId);
            setConfgAll(newData);
            const hot = hotRef.current?.hotInstance;
            if (hot) {
                hot.loadData(newData);
            }
            setActiveSheetId(sheetId);
            activeSheetIdRef.current = sheetId;
        } catch (error) {
            console.error("Failed to load sheet:", error);
        } finally {
            setIsLoading(false);
        }
    }, [clearTimer, hotRef, syncCurrentSheet]);
    // activeSheetId を Ref に同期
    useEffect(() => {
        activeSheetIdRef.current = activeSheetId;
    }, [activeSheetId]);
    // fileSessionId または activeSheetId の変更を監視
    // ファイル読み込み時や、シート切り替え要求時に発動
    useEffect(() => {
        if (!fileSessionId) return;

        // セッションが変わった、もしくはシートが変わった場合にリロード
        if (appliedSessionIdRef.current !== fileSessionId) {
            appliedSessionIdRef.current = fileSessionId;
            loadSheet(activeSheetIdRef.current);
        }
    }, [fileSessionId, loadSheet]);
    // 3. 外部ナビゲーション監視
    // シート移動
    useEffect(() => {
        if (!navigationTarget) return;
        let isCancelled = false;

        const navigate = async () => {
            const { sheetId, row, col } = navigationTarget;
            // シート移動が必要な場合
            if (sheetId !== activeSheetIdRef.current) {
                await loadSheet(sheetId);
            }
            if (isCancelled) return;
            // 指定セルへフォーカス（描画待ち）
            if (row !== undefined || col !== undefined) {
                // loadData直後だと描画が間に合わない場合があるためsetTimeoutを使用
                requestAnimationFrame(() => {
                    const hot = hotRef.current?.hotInstance;
                    if (!hot) return;
                    const target = columns.findIndex(item => item.data === col);
                    const colIndex = Math.max(0, target);
                    hot.selectCell(row ?? 0, colIndex);
                    hot.scrollViewportTo(row ?? 0, colIndex);
                });
            }
            clearNavigation();
        };

        navigate();
        return () => { isCancelled = true; };
    }, [clearNavigation, hotRef, loadSheet, navigationTarget]);
    // 4. リサイズ監視
    useHandsontableResize(hotRef, containerRef);
    // UI Handlers
    const handleSave = useCallback(async () => {
        try {
            setIsLoading(true);
            await saveToFile();
        } finally {
            setIsLoading(false);
        }
    }, [saveToFile]);
    const moveMonth = useCallback((offset: number) => {
        // 現在の activeSheetId (YYYYMM) から dayjs オブジェクトを作成
        // もし数値以外（"today"など）が入っていたら今日の日付をベースにする
        const nextId = getNextSheetId(activeSheetIdRef.current, offset);
        loadSheet(nextId);
    }, [loadSheet]);
    const setCurDate = useCallback((date: dayjs.Dayjs | string | null, _dateString: string | null) => {
        const newId = getSheetIdFromDate(date);
        if (newId && newId !== activeSheetIdRef.current) {
            loadSheet(newId);
        }
    }, [loadSheet]);
    // 検索実行関数
    const handleSearch = useCallback((direction: 'next' | 'prev' = 'next') => {
        const hot = hotRef.current?.hotInstance;
        if (!hot) return;
        const value = lastQueryRef.current;
        if (!value) return;
        const data = hot.getData();

        const result = searchTableData(value, data, hot.getSelected(), hot.countCols(), direction);
        if (result) {
            hot.selectCell(result.row, result.col);
        }
    }, [hotRef]);
    const handleDuplicateData = useCallback(() => {
        const hot = hotRef.current?.hotInstance;
        if (!hot) return;
        const selected = hot.getSelected();
        if (!selected) return;
        const [range, data] = duplicateData(hot.getSourceData(), selected);
        if (!range) return;
        hot.populateFromArray(range.startRow, range.startCol, data, range.endRow, range.endCol, "Duplicate!");
    }, [hotRef]);
    const handleSort = useCallback(() => {
        const hot = hotRef.current?.hotInstance;
        if (!hot) return;
        const data = hot.getData();
        const afterData = sortTableData(data);
        hot.populateFromArray(0, 0, afterData, void 0, void 0, 'Sort!');
    }, [hotRef]);

    const state = useMemo(() => ({
        isLoading, activeSheetId, isFileDirty, statusTotalText, statusShopTotalText, hotSettings
    }), [isLoading, activeSheetId, isFileDirty, statusTotalText, statusShopTotalText, hotSettings]);

    const handlers = useMemo(() => ({
        loadSheet,
        handleSave,
        setCurDate,
        moveMonth,
        handleSearch,
        handleDuplicateData,
        handleSort,
        onSearch: (value: string) => { lastQueryRef.current = value; handleSearch(); },
    }), [handleDuplicateData, handleSave, handleSearch, handleSort, loadSheet, moveMonth, setCurDate]);

    return {
        state,
        handlers,
    };
};