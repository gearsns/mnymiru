import { ExportOutlined, FileAddOutlined, FileOutlined, FolderOpenOutlined, HistoryOutlined, MenuOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Drawer, Menu, type MenuProps } from "antd"
import { useCallback, useMemo, useState } from "react";
import { createFileHandlers } from "./fileHandlers";
import { useFileAction } from "../../hooks/useFileAction";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from '../../lib/dexie';

export const TopMenu = () => {
    const [open, setOpen] = useState(false);
    const history = useLiveQuery(() => db.history.orderBy('lastOpened').reverse().toArray());
    const actions = useFileAction();
    const handlers = useMemo(() => createFileHandlers(actions), [actions]);
    const { handleNew, handleOpen, handleOpenDir, handleRecentOpen, handleSave, handleExportDb, handleExportCsv } = handlers;

    // ブラウザの機能サポート状況（メモ化しておく）
    const supports = useMemo(() => ({
        directory: 'showDirectoryPicker' in window,
        save: 'showSaveFilePicker' in window
    }), []);

    const menuItems = useMemo(() => {
        const items: MenuProps['items'] = [];

        // --- 基本項目 ---
        items.push({ key: 'new', icon: <FileAddOutlined />, label: '新規' });
        items.push({ key: 'open-file', icon: <FileOutlined />, label: 'ファイルを開く' });

        // --- フォルダを開く (サポート時のみ) ---
        if (supports.directory) {
            items.push({ key: 'open-dir', icon: <FolderOpenOutlined />, label: 'フォルダを開く' });
        }

        // --- 最近使用した項目 (データがある場合のみ) ---
        if (history?.length) {
            items.push({
                key: 'recent-group',
                label: '最近使用した項目',
                icon: <HistoryOutlined />,
                children: history.map(file => ({
                    key: `recent:${file.id}`,
                    label: file.name,
                }))
            });
        }

        items.push({ type: 'divider' }); // 区切り線

        // --- 保存系 (サポート状況で分岐) ---
        if (supports.save) {
            items.push({ key: 'save', icon: <SaveOutlined />, label: '保存' });
            items.push({ key: 'save-as', icon: <SaveOutlined />, label: '名前を付けて保存' });
        } else {
            // 未対応ブラウザは「名前を付けて保存（DL）」のみ
            items.push({ key: 'save-as-dl', icon: <SaveOutlined />, label: '保存' });
        }

        items.push({ type: 'divider' });

        // --- エクスポート ---
        items.push({ key: 'export-csv', icon: <ExportOutlined />, label: 'CSV形式でエクスポート' });

        return items;
    }, [history, supports]);

    const handleMenuClick: MenuProps['onClick'] = useCallback(async (e: { key: string; }) => {
        const { key } = e;
        const menuMap: { [key: string]: () => void; } = {
            'new': handleNew,
            'open-file': handleOpen,
            'open-dir': handleOpenDir,
            'save': handleSave,
            'save-as': handleExportDb,
            'export-csv': handleExportCsv,
        };
        if (key.startsWith('recent:')) {
            const id = key.split(':')[1];
            const file = history?.find(item => String(item.id) === id);
            if (file) await handleRecentOpen(file.handle, file.dir);
        } else {
            menuMap[key]?.();
        }
        setOpen(false);
    }, [handleExportCsv, handleExportDb, handleNew, handleOpen, handleOpenDir, handleRecentOpen, handleSave, history]);

    return (
        <>
            <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setOpen(true)}
            />
            <Drawer
                title="Menu"
                placement="left"
                onClose={() => setOpen(false)}
                open={open}
            >
                <Menu
                    mode="inline"
                    items={menuItems}
                    onClick={handleMenuClick}
                    selectable={false}
                />
            </Drawer>
        </>
    );
}