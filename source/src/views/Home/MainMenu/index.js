import React, { useState, forwardRef, useImperativeHandle, useEffect } from "react"
import { Modal, Drawer, Menu, message } from 'antd'
import {
	MenuOutlined, FileOutlined, SaveOutlined,
	DatabaseOutlined, ExportOutlined, FolderOpenOutlined
} from '@ant-design/icons'
import { useStoreContext, useDispatchStoreContext } from '../../../store'
import { mnymiru_db, mnymiru_state_db } from '../../../store/db'
import Database from '../../../lib/database'
import { useLiveQuery } from "dexie-react-hooks"
import { dataManager } from "../../../DataManager"

const getItem = (label, key, icon, children, type) => {
	return {
		key,
		icon,
		children,
		label,
		type,
	}
}
const openDB = async (folder, name) => {
	try {
		let handle = null
		if (typeof name === 'string') {
			await mnymiru_db.table("mnymiru-filehandles-store")
				.where("name").equals(name)
				.first()
				.then(item => {
					handle = item.handle
				})
		} else if (typeof name === 'object') {
			handle = name
		}
		const database = new Database()
		if (folder) {
			await database.openFolder(handle)
		} else {
			await database.open(handle)
		}
		await dataManager.setRcently(database)
		if (database.dirHandle) {
			message.success(`${database.dirHandle.name}/${database.file.name} を開きました。`)
		} else {
			message.success(`${database.file.name} を開きました。`)
		}
		return database
	} catch (err) {
		if (err.name === "AbortError") {
			//
		} else if (err.message.includes("Please allow the storage access permission request")) {
			message.error(`ファイルの書き込みが拒否されたためファイルの読み込みに失敗しました。`)
		} else {
			message.error(`ファイルの読み込みエラー：${err}`)
		}
	}
}
const getFileMenuItems = recently_items => {
	let file_items = []
	file_items.push(getItem("新規", 'new', <DatabaseOutlined />))
	file_items.push(getItem("ファイルを開く", 'fileopen', <FileOutlined />))
	if (window.showDirectoryPicker) {
		file_items.push(getItem("フォルダを開く", 'folderopen', <FolderOpenOutlined />))
	}
	if (window.showSaveFilePicker) {
		if (recently_items && recently_items.length > 0) {
			file_items.push(getItem("最近使用した項目を開く", 'recent', <MenuOutlined />, recently_items))
		} else {
			file_items.push(getItem("最近使用した項目を開く", 'recent', <MenuOutlined />, [getItem("None", 'none')]))
		}
	}
	if (window.showSaveFilePicker) {
		file_items.push(getItem("保存", 'save', <SaveOutlined />))
		file_items.push(getItem("名前を付けて保存", 'saveas', <SaveOutlined />))
	} else {
		file_items.push(getItem("名前を付けて保存", 'save', <SaveOutlined />))
	}
	file_items.push(getItem("CSV形式でエクスポート", 'export', <ExportOutlined />))
	return [
		getItem('ファイル', 'file_menu', <MenuOutlined />, file_items)
	]
}
const defaultOpenKeys = ['file_menu']
const MainMenu = forwardRef(function MainMenu(props, ref) {
	const [open, setOpen] = useState(false)
	const store = useStoreContext()
	const storeDispatch = useDispatchStoreContext()
	const [modal, contextHolder] = Modal.useModal()

	const getRecentlyOpened = _ => {
		let itemtable = null
		let recently_items = [
			getItem("None", 'none')
		]
		useLiveQuery(async _ => {
			await mnymiru_state_db.table("ItemTable")
				.where("name").equals("recently.opened")
				.first()
				.then(item => {
					itemtable = item
				})
			if (itemtable && itemtable.value["entries"].length > 0) {
				recently_items = []
				for (const item of itemtable.value["entries"]) {
					recently_items.push(
						getItem(item.name, item.fileUri, item.kind === 'file' ? <FileOutlined /> : <FolderOpenOutlined />)
					)
				}
			}
			setFileItems(getFileMenuItems(recently_items))
		})
	}
	getRecentlyOpened()
	const [fileItems, setFileItems] = useState(getFileMenuItems(null))
	//
	useImperativeHandle(ref, _ => ({
		showDrawer() {
			_showDrawer()
		}
	}
	))
	const _showDrawer = _ => {
		setOpen(true)
	}
	const handleClose = _ => {
		setOpen(false)
	}

	const isContinueSaving = async _ => {
		if (!dataManager.isSaved()) {
			const ret = await new Promise(resolve => {
				modal.confirm({
					title: "確認",
					content: <><p>データが変更されています。</p><p>保存する場合には、「キャンセル」して「保存」を行ってください。</p></>,
					okText: "保存せずにすすめる",
					cancelText: "キャンセル",
					onOk: e => { e(); resolve("OK") },
					onCancel: e => { e(); resolve("CANCEL") },
				})
			})
			return ret === "OK"
		}
		return true
	}
	const handleOpenDB = async (folder, name) => {
		if (await isContinueSaving()) {
			const database = await openDB(folder, name)
			if (database) {
				storeDispatch({ type: "RefreshDatabase", store: database })
				handleClose()
			}
		}
	}
	const handleSaveDB = async rename => {
		if (!store.database) {
			return
		}
		try {
			let database
			if (rename) {
				database = await dataManager.saveAs()
			} else {
				database = await dataManager.save()
			}
			if (database) {
				await dataManager.setRcently(database)
				storeDispatch({ type: "RefreshDatabase", store: database })
				message.success(`ファイルを保存しました`)
				handleClose()
			}
		} catch (err) {
			if (err.name !== "AbortError") {
				message.error(`保存に失敗しました。 （${err}）`)
			}
		}
	}
	const handleClick = async e => {
		switch (e.key) {
			case 'new':
				if (await isContinueSaving()) {
					const database = new Database()
					await database.create()
					await mnymiru_state_db.table("ItemTable").put({
						name: "latest.opened",
						value: null
					})
					storeDispatch({ type: "RefreshDatabase", store: database })
					storeDispatch({ type: "SetYearMonth", store: { year: store.yearmonth.year, month: store.yearmonth.month, line_no: 1, col: 1 } })
					handleClose()
				}
				break
			case 'fileopen': await handleOpenDB(false); break
			case 'folderopen': await handleOpenDB(true); break
			case 'save': await handleSaveDB(false); break
			case 'saveas': await handleSaveDB(true); break
			case 'export':
				if (store.database) {
					try {
						await store.database.csvExport()
						message.success(`CSVファイルにエクスポートしました。`)
						handleClose()
					} catch{
						//
					}
				}
				break
			default:
				{
					const m = e.key.match(/file:\/\/\/(.*)/)
					if (m) {
						handleOpenDB(true, m[1])
					}
				}
				break
		}
	}
	//
	useEffect(_ => {
		let ignore = false
		const eventListener = async e => {
			if (ignore || e.altKey || e.metaKey || e.shiftKey || !e.ctrlKey) {
				return
			}
			if (e.code === "KeyS") {
				e.preventDefault()
				handleSaveDB(false)
			} else if (e.code === "KeyO") {
				e.preventDefault()
				handleOpenDB(false)
			}
		}
		window.addEventListener("keydown", eventListener, true)
		return _ => { ignore = true; window.removeEventListener("keydown", eventListener) }
	}, [store.database])

	return <Drawer
		title='MnyMiru'
		open={open}
		placement={'left'}
		onClose={handleClose}
	>
		<Menu
			onClick={handleClick}
			mode="inline"
			items={fileItems}
			selectable={false}
			defaultOpenKeys={defaultOpenKeys}
		/>
		{contextHolder}
	</Drawer>
}
)

export { MainMenu }