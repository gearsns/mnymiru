import React, { useRef, useCallback, forwardRef, useImperativeHandle } from "react"
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import PropTypes from 'prop-types'
import * as lodash from 'lodash'
import * as migemo from 'jsmigemo/dist/jsmigemo.mjs'
import { IsEmpty } from "../../../lib/utils"
import { dataManager } from "../../../DataManager"
import { searchKeyEvent, execSearch, handleBeforeColumnResizeBase, MyColumn } from "../../../lib/sheet"
import { MoneyCollectFilled } from "@ant-design/icons"

// 再レンダリングされてデータが消えるので
// 固定でもつ…

let localData = [[]]
let defaultCustomSettings = { data: localData }
const INPUTSHEET_INIT_ROWS = 2000

Handsontable.renderers.registerRenderer('my.day',
	function (hotInstance, td, row, column, prop, value, cellProperties) {
		Handsontable.renderers.NumericRenderer.apply(this, arguments)
		const customSettings = hotInstance.getSettings().customSettings
		const data = customSettings.data
		let day = -1
		let year = customSettings.year
		let month = customSettings.month - 1
		if (typeof value === 'string' && value.match(/^\s*[0-9]+\s*$/)) {
			day = Math.trunc(value)
		} else if (typeof value === 'number') {
			day = value
		}
		const classList = []
		if (day > 0) {
			const dayObj = new Date(year, month, day)
			let date = new Date()
			date.setMonth(month + 1, 0)
			const dayofmonth = date.getDate()
			const weeks = ["日", "月", "火", "水", "木", "金", "土"]
			const weeks_english = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
			if (day <= dayofmonth) {
				if (row > 0 && data[row - 1][column] == value) {
					if (row + 1 < data.length && data[row + 1][column] == value) {
						classList.push('cell_row_body')
					} else {
						classList.push('cell_row_bottom')
					}
					td.textContent = `${day} (${weeks[dayObj.getDay()]})`
					classList.push(`cell_${weeks_english[dayObj.getDay()]}`)
					classList.push('cell_day_same')
					td.className = classList.join(' ')
					return
				} else {
					if (row + 1 < data.length) {
						const nextItem = Math.trunc(data[row + 1][column] || -1)
						if (nextItem === day) {
							classList.push('cell_row_top')
						}
					}
					td.textContent = `${day} (${weeks[dayObj.getDay()]})`
					classList.push(`cell_${weeks_english[dayObj.getDay()]}`)
					td.className = classList.join(' ')
					return
				}
			}
		}
		if ((typeof value === 'string' && value.length > 0)
			|| typeof value === 'number') {
			classList.push('cell_day_error')
		}
		td.className = classList.join(' ')
		td.textContent = value
	}
)

const ROWKIND_NONE = 0
const ROWKIND_TOP = 1
const ROWKIND_BODY = 2
const ROWKIND_BOTTOM = 3

const IsSameItem = (d1, d2, col) => {
	let i1 = d1[col]
	let i2 = d2[col]
	if (IsEmpty(i1) && IsEmpty(i2)) {
		return true
	}
	if (i1 === null || i1 === undefined) {
		i1 = ""
	}
	if (i2 === null || i2 === undefined) {
		i2 = ""
	}
	return i1.toString() === i2.toString()
}
const getRowKind = (data, row) => {
	if (IsEmpty(data[row][MyColumn.Day]) || IsEmpty(data[row][MyColumn.Shop])) {
		return ROWKIND_NONE
	}
	const prevRow = row - 1
	const nextRow = row + 1
	if (prevRow >= 0
		&& IsSameItem(data[prevRow], data[row], MyColumn.Day)
		&& IsSameItem(data[prevRow], data[row], MyColumn.Time)
		&& IsSameItem(data[prevRow], data[row], MyColumn.Account)
	) {
		if (nextRow < data.length
			&& IsSameItem(data[nextRow], data[row], MyColumn.Day)
			&& IsSameItem(data[nextRow], data[row], MyColumn.Shop)
			&& IsSameItem(data[nextRow], data[row], MyColumn.Time)
			&& IsSameItem(data[nextRow], data[row], MyColumn.Account)
		) {
			return ROWKIND_BODY
		}
		return ROWKIND_BOTTOM
	}
	if (nextRow < data.length
		&& IsSameItem(data[nextRow], data[row], MyColumn.Day)
		&& IsSameItem(data[nextRow], data[row], MyColumn.Shop)
		&& IsSameItem(data[nextRow], data[row], MyColumn.Time)
		&& IsSameItem(data[nextRow], data[row], MyColumn.Account)
	) {
		return ROWKIND_TOP
	}
	return ROWKIND_NONE
}
const isSameDay = (data, row) => {
	if (data[row][MyColumn.Day] === null) {
		return false
	}
	return (row > 0 && IsSameItem(data[row - 1], data[row], MyColumn.Day))
}
const isSameShop = (data, row) => {
	return (isSameDay(data, row) > 0 && IsSameItem(data[row - 1], data[row], MyColumn.Shop))
}
const isSameTime = (data, row) => {
	return (isSameShop(data, row) > 0 && IsSameItem(data[row - 1], data[row], MyColumn.Time))
}
const isSameAccount = (data, row) => {
	return (isSameTime(data, row) > 0 && IsSameItem(data[row - 1], data[row], MyColumn.Account))
}

const setRowStyle = (data, row, classList) => {
	if (data[row][MyColumn.Config]) {
		switch (data[row][MyColumn.Config].kind) {
			case ROWKIND_TOP:
				classList.push('cell_row_top')
				break
			case ROWKIND_BODY:
				classList.push('cell_row_body')
				break
			case ROWKIND_BOTTOM:
				classList.push('cell_row_bottom')
				break
		}
	}
}

Handsontable.renderers.registerRenderer('my.shop',
	function (hotInstance, td, row, column, prop, value, cellProperties) {
		Handsontable.renderers.NumericRenderer.apply(this, arguments)
		const customSettings = hotInstance.getSettings().customSettings
		const data = customSettings.data
		const classList = []
		classList.push('cell_shop')
		setRowStyle(data, row, classList)
		if (data[row][MyColumn.Config] && data[row][MyColumn.Config].sameShop) {
			classList.push('cell_shop_same')
		}
		td.className = classList.join(' ')
		td.textContent = value
	}
)
Handsontable.renderers.registerRenderer('my.time',
	function (hotInstance, td, row, column, prop, value, cellProperties) {
		Handsontable.renderers.NumericRenderer.apply(this, arguments)
		const customSettings = hotInstance.getSettings().customSettings
		const data = customSettings.data
		const classList = []
		classList.push('cell_time')
		setRowStyle(data, row, classList)
		if (value) {
			if (data[row][MyColumn.Config] && data[row][MyColumn.Config].sameTime) {
				classList.push('cell_time_same')
			}
		}
		td.className = classList.join(' ')
		td.textContent = value
	}
)

let migemo_dict = null
const FetchMigemoDict = _ =>
	fetch("./migemo-compact-dict")
		.then(res => res.arrayBuffer())
		.catch(_ => console.log("error"))

//  day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note
const AutocompleteEditor = Handsontable.editors.AutocompleteEditor.prototype.extend()
AutocompleteEditor.prototype.queryChoices = async function (query) {
	this.query = ""
	const customSettings = this.instance.getSettings().customSettings
	const data = customSettings.data
	const callbacks = customSettings.callbacks
	let items = []
	if (callbacks && callbacks["getItems"]) {
		switch (this.col) {
			case MyColumn.Shop: items = callbacks["getItems"]("shop_name"); break;
			case MyColumn.Item: items = callbacks["getItems"]("item_name"); break;
			case MyColumn.Content: items = callbacks["getItems"]("detail"); break;
			case MyColumn.Account: items = callbacks["getItems"]("account"); break;
			case MyColumn.Note: items = callbacks["getItems"]("note"); break;
		}
	}
	// 現在のシートのデータを取得
	const curItemsMap = {}
	for (const item of data) {
		if (!IsEmpty(item[this.col])) {
			curItemsMap[item[this.col]] = (curItemsMap[item[this.col]] || 0) + 1
		}
	}
	const curItems = []
	for (const [key, value] of Object.entries(curItemsMap)) {
		curItems.push([key, value])
	}
	curItems.sort((a, b) => {
		let ret = b[1] - a[1]
		if (ret === 0) {
			ret = a[0].localeCompare(b[0])
		}
		return ret
	})
	//
	if ((!items || items.length === 0) && curItems.length === 0) {
		this.updateChoicesList([])
		return
	}
	if (migemo_dict === null) {
		migemo_dict = await FetchMigemoDict()
	}
	if (migemo_dict === null) {
		this.updateChoicesList([])
		return
	}
	const m = new migemo.Migemo()
	const cd = new migemo.CompactDictionary(migemo_dict)
	m.setDict(cd)
	const rowregex = m.query(query)

	this.cellProperties.filter = false
	let result = []
	for (const item of curItems) {
		if (result.length > 20) {
			break
		}
		const value = item[0]
		if (IsEmpty(value)) {
			continue
		}
		if (value.toLowerCase().match(rowregex)) {
			result.push(value)
		}
	}
	for (const item of items) {
		if (result.length > 20) {
			break
		}
		const value = item[0]
		if (IsEmpty(value) || curItemsMap[value]) {
			continue
		}
		if (value.toLowerCase().match(rowregex)) {
			result.push(value)
		}
	}
	this.updateChoicesList(result)
}

Handsontable.editors.registerEditor('my.autocomplete', AutocompleteEditor)

const colHeaders = [
	"日付", "店名", "時間", "項目", "内訳", "支出", "数量", "収入", "小計", "現金/口座", "備考"
]
const columns = [
	/* day     */  { renderer: 'my.day' }
	/* shop    */, { renderer: 'my.shop', editor: 'my.autocomplete' }
	/* time    */, { renderer: 'my.time' }
	/* item    */, { type: 'text', editor: 'my.autocomplete' }
	/* content */, { type: 'text', editor: 'my.autocomplete' }
	/* expend  */, { renderer: 'my.number' }
	/* num     */, { renderer: 'my.number' }
	/* income  */, { renderer: 'my.number' }
	/* total   */, { renderer: 'my.number' }
	/* account */, { type: 'text', editor: 'my.autocomplete' }
	/* note    */, { type: 'text', editor: 'my.autocomplete' }
]
const colWidths = [
	50, 150, 60, 100, 250, 70, 50, 70, 70, 150, 200
]

const setConfg = (data, afterData, row) => {
	if (!data[row]) {
		data[row] = []
		data[row][MyColumn.Config] = null
	}
	data[row][MyColumn.Config] = {
		kind: getRowKind(afterData, row)
		, sameDay: isSameDay(afterData, row)
		, sameShop: isSameShop(afterData, row)
		, sameTime: isSameTime(afterData, row)
		, isSameAccount: isSameAccount(afterData, row)
	}
}

const dupData = hot => {
	hot.getSelected()
	const customSettings = hot.getSettings().customSettings
	const data = customSettings.data
	const cells = {}
	const range = {}
	for (const [startRow, startCol, endRow, endCol] of hot.getSelected()) {
		if (range.startRow === undefined) {
			range.startRow = startRow
			range.startCol = startCol
			range.endRow = endRow
			range.endCol = endCol
		}
		let sr = startRow
		let er = endRow
		if (sr > er) {
			sr = endRow
			er = startRow
		}
		if (range.startRow > sr) {
			range.startRow = sr
		}
		if (range.endRow < er) {
			range.endRow = er
		}
		let sc = startCol
		let ec = endCol
		if (sc > ec) {
			sc = endCol
			ec = startCol
		}
		if (range.startCol > sc) {
			range.startCol = sc
		}
		if (range.endCol < ec) {
			range.endCol = ec
		}
		for (let c = sc; c <= ec; c++) {
			if (cells[c] === undefined) {
				cells[c] = []
			}
			for (let r = sr; r <= er; r++) {
				cells[c].push(r)
			}
		}
	}
	const afterData = []
	for (let row = range.startRow; row <= range.endRow; ++row) {
		afterData.push(data[row].slice(range.startCol, range.endCol + 1))
	}
	for (const col of Object.keys(cells)) {
		let rows = cells[col]
		if (rows.length === 1) {
			continue
		}
		rows.sort()
		const firstRow = rows.shift()
		const val = data[firstRow][col]
		for (const row of rows) {
			afterData[row - range.startRow][col - range.startCol] = val
		}
	}
	hot.populateFromArray(range.startRow, range.startCol, afterData, range.endRow, range.endCol, "Duplicate!")
}

const InputSheet = forwardRef(function InputSheet(props, ref) {
	const hotTableRef = useRef(null)
	let callbacks = {}
	let searchInfo = { row: -1, col: -1, word: null }

	useImperativeHandle(ref, _ => ({
		resize(height) {
			if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
				const hot = hotTableRef.current.hotInstance
				hot.updateSettings({
					height: height
				})
			}
		},
		setCallback(name, callback) {
			callbacks[name] = callback
		},
		search(value) {
			execSearch(hotTableRef, searchInfo, value)
		},
		async loadData(year, month) {
			searchInfo = { row: -1, col: -1, word: null }
			if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
				const curData = await dataManager.read(year, month)
				const hot = hotTableRef.current.hotInstance
				const rownum = curData.length
				const maxrows = Math.max(INPUTSHEET_INIT_ROWS, curData.length)
				for (let row = 0; row < maxrows; ++row) {
					if (!curData[row]) {
						curData[row] = []
						curData[row][MyColumn.Config] = {
							kind: ROWKIND_NONE, sameDay: false, sameShop: false, sameTime: false, isSameAccount: false
						}
					}
				}
				for (let row = 0; row < rownum; ++row) {
					setConfg(curData, curData, row)
				}
				const customSettings = hot.getSettings().customSettings
				customSettings.year = year
				customSettings.month = month
				customSettings.data = curData
				customSettings.callbacks = callbacks
				hot.loadData(curData)
			}
		},
		selectCell(row, col) {
			if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
				const hot = hotTableRef.current.hotInstance
				setTimeout(_ => {
					hot.selectCell(row, col)
				}, 0)
			}
		},
		getSelected() {
			if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
				const hot = hotTableRef.current.hotInstance
				return hot.getSelected()
			}
			return null
		},
		sort() {
			if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
				const hot = hotTableRef.current.hotInstance
				const customSettings = hot.getSettings().customSettings
				const data = customSettings.data
				const afterData = lodash.cloneDeep(data)
				// 安定ソートにするため元のインデックスを保持
				for (let i = 0; i < afterData.length; ++i) {
					afterData[i][MyColumn.LineNoCache] = i
				}
				afterData.sort((x, y) => {
					let day1 = parseFloat(x[MyColumn.Day])
					let day2 = parseFloat(y[MyColumn.Day])
					if (!day1 && !day2) {
						return x[MyColumn.LineNoCache] - y[MyColumn.LineNoCache]
					}
					if (!day1) {
						return 1
					}
					if (!day2) {
						return -1
					}
					let c
					c = day1 - day2
					if (c !== 0) {
						return c
					}
					c = (x[MyColumn.Time] || '').localeCompare(y[MyColumn.Time] || '')
					if (c !== 0) {
						return c
					}
					c = (x[MyColumn.Shop] || '').localeCompare(y[MyColumn.Shop] || '')
					if (c !== 0) {
						return c
					}
					c = (x[MyColumn.Account] || '').localeCompare(y[MyColumn.Account] || '')
					if (c !== 0) {
						return c
					}
					return x[MyColumn.LineNoCache] - y[MyColumn.LineNoCache]
				})
				hot.populateFromArray(0, 0, afterData, void 0, void 0, 'Sort!')
			}
		}
	}))

	const handleBeforeColumnResize = useCallback((newSize, currentColumn, isDoubleClick) => {
		return handleBeforeColumnResizeBase(hotTableRef, newSize, currentColumn, isDoubleClick)
	}, [])
	const handleAfterChange = useCallback((changes, source) => {
		if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
			if (source !== "loadData") {
				dataManager.setModify()
			}
			const hot = hotTableRef.current.hotInstance
			if (hot.isDestroyed) {
				return
			}
			const customSettings = hot.getSettings().customSettings
			const data = customSettings.data
			const moveEmptyCell = (row, col, chkCol, nextRow = 0) => {
				if (IsEmpty(data[row][chkCol])) {
					hot.getSettings().enterMoves = e => {
						if (e.shiftKey) {
							return { row: -nextRow, col: col - chkCol }
						} else {
							return { row: nextRow, col: chkCol - col }
						}
					}
					return true
				}
				return false
			}
			hot.getSettings().enterMoves = { row: 1, col: 0 }
			if (source === "edit" && changes?.length > 0) {
				const change = changes[0]
				const row = change[0]
				const col = change[1]
				const moveEmptyCells = targets => {
					for (const t of targets) {
						if (moveEmptyCell(row, col, t)) {
							break
						}
					}
				}
				switch (col) {
					case MyColumn.Shop:
						moveEmptyCells([MyColumn.Day, MyColumn.Time, MyColumn.Content, MyColumn.Expend])
						break
					case MyColumn.Item:
						moveEmptyCells([MyColumn.Day, MyColumn.Shop, MyColumn.Content, MyColumn.Expend])
						break
					case MyColumn.Time:
						moveEmptyCells([MyColumn.Day, MyColumn.Shop, MyColumn.Content, MyColumn.Expend])
						break
					case MyColumn.Content:
						moveEmptyCells([MyColumn.Day, MyColumn.Shop, MyColumn.Expend])
						break
					case MyColumn.Expend:
						if (!moveEmptyCell(row, col, MyColumn.Day)) {
							if (!moveEmptyCell(row + 1, col, MyColumn.Content, 1)) {
								if (!moveEmptyCell(row + 1, col, MyColumn.Shop, 1)) {
									moveEmptyCell(row + 1, col, MyColumn.Time, 1)
								}
							}
						}
						break
				}
			}
		}
	}, [])
	const handleBeforeChange = useCallback((changes, source) => {
		if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
			const hot = hotTableRef.current.hotInstance
			const customSettings = hot.getSettings().customSettings
			const data = customSettings.data
			const afterData = lodash.cloneDeep(data)
			let rows = {}
			let bSkipAutoFill = true
			changes?.forEach(([row, prop, oldValue, newValue]) => {
				if (!afterData[row]) {
					afterData[row] = []
					afterData[row][MyColumn.Config] = null
				}
				afterData[row][prop] = newValue
				if (!IsEmpty(newValue)) {
					bSkipAutoFill = false
				}
				if (row > 0) {
					rows[row - 1] = true
				}
				rows[row] = true
				if (row + 1 < data.length) {
					rows[row + 1] = true
				}
			})
			const setTotal = (afterRowCur, row) => {
				let oldValue = afterRowCur[MyColumn.Total]
				let num = parseFloat(afterRowCur[MyColumn.Num] || 1)
				if (num === 0) {
					num = 1
				}
				afterRowCur[MyColumn.Total] =
					(parseFloat(afterRowCur[MyColumn.Income] || 0)
						- parseFloat(afterRowCur[MyColumn.Expend] || 0))
					* num
				changes.push([row, MyColumn.Total, oldValue, afterRowCur[MyColumn.Total]])
			}
			// 入力した値が空白のみの場合は、自動で項目を設定しない
			if (!bSkipAutoFill) {
				const copyItem = (afterRowCur, afterRowPre, row, col) => {
					if (IsEmpty(afterRowCur[col]) && !IsEmpty(afterRowPre[col])) {
						changes.push([row, col, afterRowCur[col], afterRowPre[col]])
						afterRowCur[col] = afterRowPre[col]
					}
				}
				if (source !== "UndoRedo.undo"
					&& source !== "UndoRedo.redo"
					&& source !== "Sort!"
					&& source !== "Duplicate!"
				) {
					const setTime = (value, index) => {
						const paddingZeo = v => `00${v}`.slice(-2)
						if (typeof value !== 'string') {
							return
						}
						let m = value.match(/^([0-9]+):([0-9]+)$/)
						if (m && m.length > 1) {
							value = `${paddingZeo(m[1])}:${paddingZeo(m[2])}`
							changes[index][3] = value
							afterData[changes[index][0]][MyColumn.Time] = value
						}
						m = value.match(/^[0-9]+$/)
						if (m) {
							if (value.length >= 4) {
								const hour = Math.trunc(value.substring(0, 2))
								const minute = Math.trunc(value.substring(2, 4))
								value = `${paddingZeo(hour)}:${paddingZeo(minute)}`
							} else if (value.length == 3) {
								const hour = Math.trunc(value.substring(0, 1))
								const minute = Math.trunc(value.substring(1, 3))
								value = `${paddingZeo(hour)}:${paddingZeo(minute)}`
							} else {
								const hour = Math.trunc(value)
								const minute = 0
								value = `${paddingZeo(hour)}:${paddingZeo(minute)}`
							}
							changes[index][3] = value
							afterData[changes[index][0]][MyColumn.Time] = value
						}
					}
					const toNumber = index => {
						const change = changes[index]
						if (typeof change[3] === "string") {
							change[3] = change[3].replace(/[\\, ]/g, '')
							afterData[change[0]][change[1]] = change[3]
						}
					}
					changes?.forEach(([row, prop, oldValue, newValue], index) => {
						const afterRowCur = afterData[row]
						if (row == 0) {
							switch (prop) {
								case MyColumn.Expend:
								case MyColumn.Income:
								case MyColumn.Num:
									toNumber(index)
									setTotal(afterRowCur, row)
									break
								case MyColumn.Time:
									setTime(newValue, index)
									break
								case MyColumn.Total:
									toNumber(index)
									break
							}
						} else if (row > 0) {
							const afterRowPre = afterData[row - 1]
							const copySameItems = targets => {
								for (const t of targets) {
									copyItem(afterRowCur, afterRowPre, row, t)
									if (!IsSameItem(afterRowCur, afterRowPre, t)) {
										break
									}
								}
							}
							switch (prop) {
								case MyColumn.Shop:
									copySameItems([MyColumn.Day, MyColumn.Account])
									break
								case MyColumn.Time:
									setTime(newValue, index)
									copySameItems([MyColumn.Day, MyColumn.Shop, MyColumn.Account])
									break
								case MyColumn.Content: // 内訳
									copySameItems([MyColumn.Day, MyColumn.Shop, MyColumn.Account])
									break
								case MyColumn.Expend:
								case MyColumn.Income:
								case MyColumn.Num:
									toNumber(index)
									copySameItems([MyColumn.Day, MyColumn.Shop, MyColumn.Account])
									setTotal(afterRowCur, row)
									break
								case MyColumn.Account:
									copySameItems([MyColumn.Day, MyColumn.Shop])
									break
								case MyColumn.Total:
									toNumber(index)
									break
								default:
									break
							}
						}
					})
				}
				if (source === "edit" && changes?.length > 0) {
					const change = changes[0]
					const row = change[0]
					const col = change[1]
					const afterRowCur = afterData[row]
					const setValue = (curRow, row, col, newValue) => {
						changes.push([row, col, curRow[col], newValue])
						curRow[col] = newValue
						rows[row] = true
					}
					// 100*2 -> 100,2
					if (col === MyColumn.Income
						|| col === MyColumn.Expend) {
						const m = afterRowCur[col].match(/^([0-9]+)(?:\*|x)([0-9]+)$/i)
						if (m && m.length > 1) {
							afterRowCur[col] = change[3] = m[1]
							setValue(afterRowCur, row, MyColumn.Num, m[2])
							setTotal(afterRowCur, row)
						}
					}
					// レシートの一行目なら日付と店名と時間、口座はまとめて変更
					if (
						(
							col === MyColumn.Day
							|| col === MyColumn.Shop
							|| col === MyColumn.Time
							|| col === MyColumn.Account
						)
						&& afterRowCur
						&& afterRowCur[MyColumn.Config]
						&& afterRowCur[MyColumn.Config].kind === ROWKIND_TOP) {
						for (let i = row + 1; i < afterData.length; ++i) {
							const afterRowNext = afterData[i]
							if (afterRowNext
								&& afterRowNext[MyColumn.Config]
								&& (
									afterRowNext[MyColumn.Config].kind === ROWKIND_BODY
									|| afterRowNext[MyColumn.Config].kind === ROWKIND_BOTTOM
								)
							) {
								setValue(afterRowNext, i, col, afterRowCur[col])
							} else {
								break
							}
						}
					}
					// 内訳をもとに過去のデータを参照して項目、口座を自動で設定
					if (callbacks.getTopItem && col === MyColumn.Content && !IsEmpty(afterRowCur[MyColumn.Content])) {
						if (IsEmpty(afterRowCur[MyColumn.Item])) {
							const value = callbacks.getTopItem("detail", "item_name", afterRowCur[MyColumn.Content])
							if (value) {
								setValue(afterRowCur, row, MyColumn.Item, value)
							}
						}
						if (IsEmpty(afterRowCur[MyColumn.Account])) {
							const value = callbacks.getTopItem("detail", "account", afterRowCur[MyColumn.Content])
							if (value) {
								setValue(afterRowCur, row, MyColumn.Account, value)
							}
						}
					}
				}
			}
			// 同じ項目を編集した際には、最後に変更した値を設定する
			if (changes) {
				const changesKey = {}
				for (const change of changes) {
					const row = change[0]
					const col = change[1]
					const key = `${row}x${col}`
					if (changesKey[key]) {
						changesKey[key][3] = change[3] // 最後に変更した値を設定する
					} else {
						changesKey[key] = change // 行x列で見つかった最初の項目
					}
				}
			}
			//
			for (const item of Object.keys(rows)) {
				setConfg(data, afterData, parseInt(item))
			}
		}
	}, [])
	const handleAfterSelectionEnd = useCallback((row, column, row2, column2, selectionLayerLevel) => {
		if (callbacks.setStatus) {
			const hot = hotTableRef.current.hotInstance
			const customSettings = hot.getSettings().customSettings
			const data = customSettings.data
			let dispRow = row
			if (!data[dispRow][MyColumn.Day] && dispRow > 0) {
				--dispRow
			}
			if (data[dispRow][MyColumn.Day]) {
				const config = data[dispRow][MyColumn.Config]
				let total = parseFloat(data[dispRow][MyColumn.Total]) || 0
				let selectionTotal = 0
				if (config) {
					// 上へ
					if (config.kind === ROWKIND_BODY || config.kind === ROWKIND_BOTTOM) {
						for (let i = dispRow - 1; i >= 0; --i) {
							if (data[i]
								&& data[i][MyColumn.Config]) {
								if (data[i][MyColumn.Config].kind === ROWKIND_TOP) {
									total += parseFloat(data[i][MyColumn.Total]) || 0
									break
								} else if (data[i][MyColumn.Config].kind !== ROWKIND_BODY) {
									break
								} else {
									total += parseFloat(data[i][MyColumn.Total]) || 0
								}
							}
						}
					}
					// 下へ
					if (config.kind === ROWKIND_BODY || config.kind === ROWKIND_TOP) {
						for (let i = dispRow + 1; i < data.length; ++i) {
							if (data[i]
								&& data[i][MyColumn.Config]) {
								if (data[i][MyColumn.Config].kind === ROWKIND_BOTTOM) {
									total += parseFloat(data[i][MyColumn.Total]) || 0
									break
								} else if (data[i][MyColumn.Config].kind !== ROWKIND_BODY) {
									break
								} else {
									total += parseFloat(data[i][MyColumn.Total]) || 0
								}
							}
						}
					}
				}
				{
					let rows = {}
					for (const [startRow, startCol, endRow, endCol] of hot.getSelected()) {
						let s = startRow
						let e = endRow
						if (s > e) {
							s = endRow
							e = startRow
						}
						for (let i = s; i <= e; ++i) {
							rows[i] = true
						}
					}
					const keys = Object.keys(rows)
					if (keys.length > 1) {
						for (const i of keys) {
							selectionTotal += parseFloat(data[i][MyColumn.Total]) || 0
						}
					}
				}
				if (selectionTotal !== 0 && selectionTotal !== total) {
					callbacks.setStatus(<>
						<span>{data[dispRow][MyColumn.Shop] || ""}：{total.toLocaleString()}</span>
						<span className="select_total">選択範囲の合計：{selectionTotal.toLocaleString()}</span>
					</>)
				} else {
					callbacks.setStatus(`${data[dispRow][MyColumn.Shop] || ""}：${total.toLocaleString()}`)
				}
			}
		}
	}, [])
	const handleBeforeKeyDown = useCallback(e => {
		searchKeyEvent(e, hotTableRef, searchInfo)
		if (e.keyCode === Handsontable.helper.KEY_CODES.F
			&& !e.altKey && !e.shiftKey && e.ctrlKey && callbacks.setSearchFocus) {
			e.stopImmediatePropagation()
			e.preventDefault()
			const hot = hotTableRef.current.hotInstance
			hot.deselectCell()
			callbacks.setSearchFocus()
		} else if (e.keyCode === Handsontable.helper.KEY_CODES.D
			&& !e.altKey && !e.shiftKey && e.ctrlKey) {
			e.stopImmediatePropagation()
			e.preventDefault()
			dupData(hotTableRef.current.hotInstance)
		}
	}, [])
	return (
		<div className="input_sheet">
			<HotTable
				key={'IputSheet'}
				ref={hotTableRef}
				customSettings={defaultCustomSettings}
				autoWrapCol={false}
				autoWrapRow={false}
				autoRowSize={true}
				autoColumnSize={false}
				colHeaders={colHeaders}
				columns={columns}
				colWidths={colWidths}
				rowHeaders={true}
				manualColumnResize={true}
				manualRowResize={true}
				trimWhitespace={false}
				outsideClickDeselects={false}
				height={600}
				minRows={INPUTSHEET_INIT_ROWS}
				minCols={colHeaders.length}
				maxCols={colHeaders.length}
				minSpareRows={1}
				data={localData}
				className="mny_hottable"
				afterChange={handleAfterChange}
				beforeChange={handleBeforeChange}
				beforeColumnResize={handleBeforeColumnResize}
				afterSelectionEnd={handleAfterSelectionEnd}
				beforeKeyDown={handleBeforeKeyDown}
			/>
		</div>
	)
})

InputSheet.propTypes = {
	data: PropTypes.array
}

export { InputSheet }
