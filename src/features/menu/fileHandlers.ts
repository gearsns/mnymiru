import { dataStore } from "@/store/dataStore";
import { Modal } from "@/components/ConfirmModal";
import type { createFileAction } from "@/hooks/fileAction";

export const createFileHandlers = (actions: ReturnType<typeof createFileAction>) => {
    const confirmDiscardChanges = (action: () => void) => {
        const { isDirty } = dataStore;
        if (isDirty) {
            Modal.confirm({
                title: "変更を破棄しますか？",
                content: "未保存のデータがありますが、よろしいですか？",
                okText: "破棄して続行",
                cancelText: "キャンセル",
                onOk: action, // OKなら渡された処理を実行
            });
        } else {
            action();
        }
    };

    const handleNew = () => {
        confirmDiscardChanges(() => {
            actions.newFile();
        });
    };

    const handleOpen = async () => {
        try {
            const [handle] = await (window as any).showOpenFilePicker();
            confirmDiscardChanges(async () => {
                await actions.openFile(handle);
            });
        } catch {
            //
        }
    }

    const handleOpenDir = async () => {
        try {
            const dirHandle = await (window as any).showDirectoryPicker();
            const fileHandle = await dirHandle.getFileHandle('cash.db', { create: true });
            confirmDiscardChanges(async () => {
                await actions.openFile(fileHandle, dirHandle);
            });
        } catch {
            //
        }
    }

    const handleRecentOpen = async (handle: FileSystemFileHandle, dir?: FileSystemDirectoryHandle | undefined) => {
        confirmDiscardChanges(async () => {
            await actions.openFile(handle, dir);
        });
    }
    const wrap = (fn: () => Promise<void>) => async () => {
        try {
            await fn();
        } catch (e) {
            // ユーザーキャンセル（AbortError）以外をログ出力
            if (e instanceof Error && e.name !== 'AbortError') {
                console.error(e);
            }
        }
    };
    return {
        handleNew, handleOpen, handleOpenDir, handleRecentOpen,
        handleSave: wrap(actions.saveToFile),
        handleExportDb: wrap(actions.exportToDbFile),
        handleExportCsv: wrap(actions.exportToCsvFile),
    };
};
