import dayjs from 'dayjs'
import {  mnymiru_state_db } from './store/db'

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
	return { set, read, save, saveAs, delayUpdate, update, setModify, isSaved }
}
const dataManager = DataManager()
export { dataManager }