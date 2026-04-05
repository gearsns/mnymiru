import { Modal } from "antd";
import { useDataStore } from "../../store/useDataStore";
import { useFileAction } from "../../hooks/useFileAction";

export const createFileHandlers = (actions: ReturnType<typeof useFileAction>) => {

  const confirmDiscardChanges = (action: () => void) => {
    const { isDirty } = useDataStore.getState();
    if (isDirty) {
      Modal.confirm({
        title: "変更を破棄しますか？",
        content: "未保存のデータがありますが、よろしいですか？",
        okText: "破棄して続行",
        cancelText: "キャンセル",
        onOk: action, // OKなら渡された処理を実行
      });
    } else {
      action(); // 変更がなければ即実行
    }
  };

  const handleNew = () => {
    confirmDiscardChanges(() => {
      actions.newFile();
    });
  };

  const handleOpen = async () => {
    try {
      const [handle] = await window.showOpenFilePicker();
      confirmDiscardChanges(async () => {
        await actions.openFile(handle);
      });
    } catch {
      //
    }
  }

  const handleOpenDir = async () => {
    try {
      const dirHandle = await window.showDirectoryPicker();
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