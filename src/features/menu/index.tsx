import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import styles from './style.module.css';
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { ChevronRight as ChevronRightIcon, Download, Menu, X, FilePlus, File, FolderOpen, History, Save, Settings } from "lucide-solid";
import { liveQuery } from "dexie";
import { db } from '../../lib/dexie';
import { createFileHandlers } from "./fileHandlers";
import { createFileAction } from "@/hooks/fileAction";
import { settingsStore } from "@/store/settingsStore";

export const TopMenu = () => {
    const [open, setOpen] = createSignal(false);
    const [history, setHistory] = createSignal<any[]>([]);
    onMount(() => {
        const observable = liveQuery(() =>
            db.history.orderBy('lastOpened').reverse().toArray()
        );

        const subscription = observable.subscribe({
            next: (result) => setHistory(result),
            error: (err) => console.error("Failed to fetch history:", err),
        });

        // コンポーネントが破棄されたら購読を解除（メモリリーク防止）
        onCleanup(() => subscription.unsubscribe());
    });
    // ブラウザの機能サポート状況（メモ化）
    const supports = {
        directory: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
        save: typeof window !== 'undefined' && 'showSaveFilePicker' in window
    };
    const actions = createFileAction();
    const handlers = createFileHandlers(actions);
    const { handleNew, handleOpen, handleOpenDir, handleRecentOpen, handleSave, handleExportDb, handleExportCsv } = handlers;

    return (
        <div class={styles.container}>
            <DropdownMenu open={open()} onOpenChange={setOpen}>
                {/* ボタンのサイズを固定(w-10 h-10)し、はみ出たアイコンを隠す(overflow-hidden) */}
                <DropdownMenu.Trigger class={styles.trigger}>

                    {/* 三本線アイコン（閉じているときは表示、開いているときは回転して消える） */}
                    <Menu
                        size={24}
                        class={`${styles.icon} ${open()
                            ? styles.iconMenuHidden
                            : styles.iconMenuVisible}`}
                    />

                    {/* ×アイコン（閉じているときは回転して隠れ、開いているときに出現する） */}
                    <X
                        size={24}
                        class={`${styles.icon} ${open()
                            ? styles.iconXVisible
                            : styles.iconXHidden
                            }`}
                    />

                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content class={styles["dropdown-menu__content"]}>
                        <DropdownMenu.Item class={styles["dropdown-menu__item"]} onSelect={handleNew}>
                            <FilePlus size={16} />
                            新規
                        </DropdownMenu.Item>
                        <DropdownMenu.Item class={styles["dropdown-menu__item"]} onSelect={handleOpen}>
                            <File size={16} />
                            ファイルを開く
                        </DropdownMenu.Item>
                        <DropdownMenu.Item class={styles["dropdown-menu__item"]} onSelect={handleOpenDir}>
                            <FolderOpen size={16} />
                            フォルダを開く
                        </DropdownMenu.Item>
                        <Show when={history().length > 0}>
                            <DropdownMenu.Sub overlap gutter={4} shift={-8}>
                                <DropdownMenu.SubTrigger
                                    class={styles["dropdown-menu__sub-trigger"]}
                                >
                                    <History size={16} />
                                    最近使用したファイル
                                    <div class={styles["dropdown-menu__item-right-slot"]}>
                                        <ChevronRightIcon width={20} height={20} />
                                    </div>
                                </DropdownMenu.SubTrigger>
                                <DropdownMenu.Portal>
                                    <DropdownMenu.SubContent
                                        class={styles["dropdown-menu__sub-content"]}
                                    >
                                        <For each={history()}>
                                            {(file) => (
                                                <DropdownMenu.Item
                                                    class={styles["dropdown-menu__item"]}
                                                    onSelect={() => handleRecentOpen(file.handle, file.dir)}
                                                >
                                                    {file.name}
                                                </DropdownMenu.Item>
                                            )}
                                        </For>
                                    </DropdownMenu.SubContent>
                                </DropdownMenu.Portal>
                            </DropdownMenu.Sub>
                        </Show>
                        <DropdownMenu.Separator class={styles["dropdown-menu__separator"]} />
                        <Show when={supports.save}
                            fallback={
                                <DropdownMenu.Item class={styles["dropdown-menu__item"]} onSelect={handleExportDb}>
                                    <Download size={16} />
                                    保存
                                </DropdownMenu.Item>
                            }
                        >
                            <DropdownMenu.Item class={styles["dropdown-menu__item"]} onSelect={handleSave}>
                                <Save size={16} />
                                保存
                            </DropdownMenu.Item>
                            <DropdownMenu.Item class={styles["dropdown-menu__item"]} onSelect={handleExportDb}>
                                <Save size={16} />
                                名前を付けて保存
                            </DropdownMenu.Item>
                        </Show>
                        <DropdownMenu.Separator class={styles["dropdown-menu__separator"]} />
                        <DropdownMenu.Item class={styles["dropdown-menu__item"]} onSelect={handleExportCsv}>
                            <Download size={16} />
                            CSV形式でエクスポート
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator class={styles["dropdown-menu__separator"]} />
                        <DropdownMenu.Item class={styles["dropdown-menu__item"]} onSelect={() => settingsStore.open()}>
                            <Settings size={16} />
                            設定
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu>
        </div>
    )
};
