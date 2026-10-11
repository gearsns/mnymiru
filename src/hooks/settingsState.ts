import { loadSettings, saveSettings } from "@/store/dataStore";
import type { AppSettings } from "@/types";
import { createSignal } from "solid-js";

export function createSettingsState() {
    // 初期値として localStorage から読み込む
    const [settings, setSettings] = createSignal<AppSettings>(loadSettings());

    const updateSettings = (newSettings: AppSettings) => {
        saveSettings(newSettings);  // localStorageへ保存
        setSettings(newSettings);   // リアクティブに状態を更新
    };

    return {
        settings,
        updateSettings,
    };
}
