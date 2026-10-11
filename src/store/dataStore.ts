import { createStore } from 'solid-js/store';
import type { CashMonth } from '../db/types';
import type { AppSettings } from '@/types';

// --- 型定義 ---
export interface NavigationTarget {
    sheetId: string;
    row?: number;
    col?: keyof CashMonth;
    timestamp: number;
}

export interface DataState {
    fileName: string | null;
    fileHandle: FileSystemFileHandle | undefined;
    fileSessionId: string;
    navigationTarget: NavigationTarget | null;
    isLoading: boolean;
    isDirty: boolean;
}

// --- 1. グローバルストアの作成 ---
export const [dataStore, setDataStore] = createStore<DataState>({
    fileName: null,
    fileHandle: undefined,
    fileSessionId: '',
    navigationTarget: null,
    isLoading: false,
    isDirty: false,
});

export const saveRegistry: Record<string, () => Promise<void>> = {};

// --- 2. アクション（状態更新関数） ---
export const registerSyncAction = (id: string, fn: () => Promise<void>) => {
    // solid-js/store のパス指定機能で特定キーのみピンポイント更新
    saveRegistry[id] = fn;
};

export const unregisterSyncAction = (id: string) => {
    delete saveRegistry[id];
};

export const setNavigationTarget = (target: Omit<NavigationTarget, 'timestamp'>) => {
    setDataStore('navigationTarget', { ...target, timestamp: Date.now() });
};

export const clearNavigation = () => {
    setDataStore('navigationTarget', null);
};

export const setIsLoading = (isLoading: boolean) => {
    setDataStore('isLoading', isLoading);
};

export const setIsDirty = (isDirty: boolean) => {
    setDataStore('isDirty', isDirty);
};

export const setState = (next: Partial<DataState>) => {
    setDataStore(next);
};


const SETTINGS_KEY = "mnymiru:settings";

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { apiKey: "", model: "" };
    const parsed = JSON.parse(raw);
    return { apiKey: parsed.apiKey ?? "", model: parsed.model ?? "" };
  } catch {
    return { apiKey: "", model: "" };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
