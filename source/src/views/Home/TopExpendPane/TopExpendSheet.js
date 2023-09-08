import React, { useRef, useCallback, forwardRef, useImperativeHandle } from "react"
import { HotTable } from '@handsontable/react'
import Handsontable from 'handsontable'
import PropTypes from 'prop-types'
import { searchKeyEvent, execSearch, handleBeforeColumnResizeBase, MyColumn } from "../../../lib/sheet"
import { useDispatchStoreContext } from '../../../store'

Handsontable.renderers.registerRenderer('my.search.day',
	function (hotInstance, td, row, column, prop, value, cellProperties) {
		Handsontable.renderers.NumericRenderer.apply(this, arguments)
		let day = -1
		let year = 0
		let month = 0
		if (typeof value === 'number') {
			value = value.toString().trim()
		}
		if (typeof value === 'string') {
			const m = value.match(/^([0-9]{4})([0-9]{2})([0-9]{2})$/)
			if (m && m.length > 1) {
				year = Math.trunc(m[1])
				month = Math.trunc(m[2]) - 1
				day = Math.trunc(m[3])
			}
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
				td.textContent = `${year}年${(" " + (month + 1)).slice(-2)}月${(" " + day).slice(-2)} (${weeks[dayObj.getDay()]})`
				classList.push(`cell_${weeks_english[dayObj.getDay()]}`)
				td.className = classList.join(' ')
				return
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

const colHeaders = [
	"日付", "店名", "時間", "項目", "内訳", "支出", "数量", "収入", "小計", "現金/口座", "備考"
]
const columns = [
	/* day     */  { renderer: 'my.search.day' }
	/* shop    */, { type: 'text', className: 'cell_shop' }
	/* time    */, { type: 'text', className: 'cell_time' }
	/* item    */, { type: 'text' }
	/* content */, { type: 'text' }
	/* expend  */, { renderer: 'my.number' }
	/* num     */, { renderer: 'my.number' }
	/* income  */, { renderer: 'my.number' }
	/* total   */, { renderer: 'my.number' }
	/* account */, { type: 'text' }
	/* note    */, { type: 'text' }
]
const colWidths = [
	130, 150, 60, 100, 250, 70, 50, 70, 70, 150, 200
]
let localData = [[]]
let defaultCustomSettings = { data: localData }

const TopExpendSheet = forwardRef(function DataSheet(props, ref) {
	const hotTableRef = useRef()
	const storeDispatch = useDispatchStoreContext()
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
		loadData(newData) {
			searchInfo = { row: -1, col: -1, word: null }
			if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
				const hot = hotTableRef.current.hotInstance
				const customSettings = hot.getSettings().customSettings
				customSettings.data = newData
				customSettings.callbacks = callbacks
				hot.loadData(newData)
			}
		},
	}))

	const handleBeforeColumnResize = useCallback((newSize, currentColumn, isDoubleClick) => {
		return handleBeforeColumnResizeBase(hotTableRef, newSize, currentColumn, isDoubleClick)
	}, [])
	const handleBeforeKeyDown = useCallback(e => {
		searchKeyEvent(e, hotTableRef, searchInfo)
	}, [])
	const handleCellDblClick = useCallback((event, coords, TD) => {
		if (event.button === 0 && event.detail === 2) {
			const row = coords.row
			if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
				const hot = hotTableRef.current.hotInstance
				if (hot.isDestroyed) {
					return
				}
				const customSettings = hot.getSettings().customSettings
				const data = customSettings.data
				const yearmonth = data[row][0] || ""
				const m = yearmonth.match(/([0-9]{4})([0-9]{2})/)
				if (m && m.length > 2) {
					const year = Math.trunc(m[1])
					const month = Math.trunc(m[2])
					storeDispatch({ type: "SetYearMonth", store: { year: year, month: month, line_no: data[row][MyColumn.LineNoCache], col: coords.col } })
				}
			}
		}
	}, [])
	return (
		<div className="search_sheet">
			<HotTable ref={hotTableRef}
				readOnly={true}
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
				minCols={colHeaders.length}
				maxCols={colHeaders.length}
				data={localData}
				className="mny_hottable"
				beforeColumnResize={handleBeforeColumnResize}
				beforeKeyDown={handleBeforeKeyDown}
				afterOnCellMouseDown={handleCellDblClick}
			/>
		</div>
	)
})

TopExpendSheet.propTypes = {
	data: PropTypes.array
}

export { TopExpendSheet } 