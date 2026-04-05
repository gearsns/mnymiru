import { create } from 'zustand';
import type { CashMonth } from '../db/types';
// 現在、画面に表示すべきデータ
interface NavigationTarget {
  sheetId: string;
  row?: number;
  col?: keyof CashMonth;
  timestamp: number; // 同じ場所への連続移動を検知するために必要
}

interface DataState {
  saveRegistry: Record<string, () => Promise<void>>;
  // --- ファイル/DB全体の管理 ---
  readonly fileName: string | null;
  fileHandle: FileSystemFileHandle | undefined; // ファイル保存に必要
  readonly fileSessionId: string;
  readonly navigationTarget: NavigationTarget | null;
  readonly isLoading: boolean;
  readonly isDirty: boolean; // 変更があるかどうか
  // Actions
  registerSyncAction: (id: string, fn: () => Promise<void>) => void;
  unregisterSyncAction: (id: string) => void;
  setNavigationTarget: (target: Omit<NavigationTarget, 'timestamp'>) => void;
  clearNavigation: () => void,
  setIsLoading: (isLoading: boolean) => void;
  setIsDirty: (isDirty: boolean) => void;
  setState: (state: Partial<DataState>) => void;
}

export const useDataStore = create<DataState>((set) => ({
  saveRegistry: {} as Record<string, () => Promise<void>>,
  // 登録・解除用のアクション
  registerSyncAction: (id: string, fn) =>
    set((state) => ({
      saveRegistry: { ...state.saveRegistry, [id]: fn }
    })),
  unregisterSyncAction: (id: string) =>
    set((state) => ({
      saveRegistry: Object.fromEntries(
        Object.entries(state.saveRegistry).filter(([k]) => k !== id)
      )
    })),
  fileName: null,
  fileHandle: undefined,
  fileSessionId: "",
  navigationTarget: null,
  isLoading: false,
  isDirty: false, // 初期状態はfalse
  setNavigationTarget: (target) => set({
    navigationTarget: { ...target, timestamp: Date.now() }
  }),
  clearNavigation: () => set({ navigationTarget: null }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsDirty: (isDirty) => set({ isDirty }),
  setState: (next) => set((state) => ({ ...state, ...next })),
}));