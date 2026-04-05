// useAutoSync.ts
import { useState, useRef, useCallback } from "react";

export const useAutoSync = () => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const isDirtyRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    // isDirty の値を Ref に同期（タイマー内で最新値を参照するため）
    const setDirtyInternal = useCallback((val: boolean) => {
        setIsDirty(val);
        isDirtyRef.current = val;
    }, []);

    const requestDelayedAction = useCallback((syncFn: () => Promise<void>) => {
        setDirtyInternal(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            if (!isDirtyRef.current) return;
            setIsSyncing(true);
            await syncFn();
            setDirtyInternal(false);
            setIsSyncing(false);
        }, 3000);
    }, [setDirtyInternal]);

    const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); };

    return { isDirty, isSyncing, requestDelayedAction, setDirtyInternal, isDirtyRef, clearTimer };
};