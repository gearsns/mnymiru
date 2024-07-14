import dayjs from 'dayjs'
import { mnymiru_db, mnymiru_state_db } from './store/db'

const DataManager = _ => {
	let updatedFlag = false
	let timerID = null
	let db, data, year, month
	const set = (_db, _data, _year, _month) => {
		db = _db
		data = _data
		year = _year
		month = _month
		updatedFlag = false
	}
	const read = async (_year, _month) => {
		if (!db) {
			return []
		}
		update()
		year = _year
		month = _month
		data = db.readYearMonthData(dayjs(new Date(_year, _month - 1, 1)).format("YYYYMM"))
		return data
	}
	const delayUpdate = _ => {
		if (!db) {
			return
		}
		if (timerID) {
			clearTimeout(timerID)
		}
		timerID = setTimeout(_ => {
			timerID = null
			update()
		}, 5000)
	}
	const update = async _ => {
		if (!updatedFlag) {
			return
		}
		updatedFlag = false
		if (!db) {
			return
		}
		db.updateYearMonthData(data, year, month)
		updateCache()
	}
	const updateCache = async _ => {
		await mnymiru_state_db.table("ItemTable").put({
			name: "latest.opened",
			value: {
				arrayBuffer: db.export(),
				fileHandle: db.fileHandle,
				dirHandle: db.dirHandle,
				savedFlag: db.savedFlag,
			}
		})
	}
	const setModify = _ => {
		updatedFlag = true
		if(db){
			db.setModify()
		}
		delayUpdate()
	}
	const isSaved = _ => {
		if(db){
			return db.savedFlag
		}
		return true
	}
	const save = async _ => {
		if(db){
			await update()
			await db.save()
			updateCache()
		}
		return db
	}
	const saveAs = async _ => {
		if(db){
			await update()
			await db.saveAs()
			updateCache()
		}
		return db
	}
	const setRcently = async database => {
		const dirHandle = database.dirHandle
		const fileHandle = database.fileHandle
		let name = ""
		let kind = ""
		if (dirHandle) {
			await mnymiru_db.table("mnymiru-filehandles-store").put({
				name: dirHandle.name,
				handle: dirHandle
			})
			name = dirHandle.name
			kind = dirHandle.kind
		} else if (fileHandle) {
			await mnymiru_db.table("mnymiru-filehandles-store").put({
				name: fileHandle.name,
				handle: fileHandle
			})
			name = fileHandle.name
			kind = fileHandle.kind
		} else {
			return
		}
		let itemtable = null
		await mnymiru_state_db.table("ItemTable")
			.where("name").equals("recently.opened")
			.first()
			.then(item => {
				itemtable = item
			})
		if (itemtable) {
			if (itemtable.value["entries"]) {
				itemtable.value["entries"] = itemtable.value["entries"].filter((elem, index, self) =>
					elem.name != name
				)
				itemtable.value["entries"].push({ "fileUri": `file:///${name}`, name: name, kind: kind })
				itemtable.value["entries"] = itemtable.value["entries"].slice(-5)
			}
		} else {
			itemtable = { name: "recently.opened" }
			itemtable.value = { "entries": [{ "fileUri": `file:///${name}`, name: name, kind: kind }] }
		}
		await mnymiru_state_db.table("ItemTable").put(itemtable)
		//
		await mnymiru_state_db.table("ItemTable").put({
			name: "latest.opened",
			value: {
				arrayBuffer: database.export(),
				fileHandle: database.fileHandle,
				dirHandle: database.dirHandle
			}
		})
	}
	return { set, read, save, saveAs, delayUpdate, update, setModify, isSaved, setRcently }
}
const dataManager = DataManager()
export { dataManager }