import Handsontable from 'handsontable'
import GhostTable from 'handsontable/src/utils/ghostTable'
import { IsEmpty } from "../utils"

const MyColumn = {
	Day: 0,
	Shop: 1,
	Time: 2,
	Item: 3,
	Content: 4,
	Expend: 5,
	Num: 6,
	Income: 7,
	Total: 8,
	Account: 9,
	Note: 10,
	ID: 11,
	LineNoCache: 12,
	Config: 13,
}

Handsontable.renderers.registerRenderer('my.number',
	function (hotInstance, td, row, column, prop, value, cellProperties) {
		Handsontable.renderers.NumericRenderer.apply(this, arguments)
		let num = undefined
		if (typeof value === 'string' && value.match(/^\s*[-0-9]+\s*$/)) {
			num = parseFloat(value)
			if(num !== 0 && !num){
				num = undefined
			}
		} else if (typeof value === 'number') {
			num = value === 0 ? value : (value || undefined)
		}
		const classList = []
		if (num !== undefined) {
			if (column === MyColumn.Expend) {
				if (num >= 0) {
					classList.push('cell_negative_num')
				} else {
					classList.push('cell_positive_num')
				}
			} else {
				if (num >= 0) {
					classList.push('cell_positive_num')
				} else {
					classList.push('cell_negative_num')
				}
			}
			if (num === 0) {
				td.textContent = ""
			} else {
				td.textContent = num.toLocaleString()
			}
		} else {
			td.textContent = value
			if (!IsEmpty(value)) {
				classList.push('cell_num_error')
			}
		}
		td.className = classList.join(' ')
	}
)

const searchKeyEvent = (e, hotTableRef, searchInfo) => {
	if (searchInfo.word && e.keyCode === Handsontable.helper.KEY_CODES.F3) {
		if (e.altKey || e.ctrlKey) {
			return
		}
		if (e.shiftKey) {
			searchPrev(hotTableRef, searchInfo)
		} else {
			searchNext(hotTableRef, searchInfo)
		}
		e.stopImmediatePropagation()
		e.preventDefault()
	}
}

const searchNext = (hotTableRef, searchInfo) => {
	if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
		const hot = hotTableRef.current.hotInstance
		const customSettings = hot.getSettings().customSettings
		const data = customSettings.data
		//
		let startCol = 0
		let startRow = 0
		const selected = hot.getSelected()
		if (selected && selected.length > 0) {
			[startRow, startCol] = selected[0]
			++startCol
		}
		for (let row = startRow; row < data.length; ++row) {
			const curRow = data[row]
			for (let col = startCol; col <= MyColumn.Note; ++col) {
				if (curRow[col] && curRow[col].toString().includes(searchInfo.word)) {
					hot.selectCell(row, col)
					return
				}
			}
			startCol = 0
		}
		if (selected && selected.length > 0) {
			[startRow, startCol] = selected[0]
		}
		for (let row = 0; row <= startRow; ++row) {
			const curRow = data[row]
			for (let col = 0; col <= MyColumn.Note; ++col) {
				if (row === startRow && col === startCol) {
					// Not Found
					return
				}
				if (curRow[col] && curRow[col].toString().includes(searchInfo.word)) {
					hot.selectCell(row, col)
					return
				}
			}
		}
	}
}

const searchPrev = (hotTableRef, searchInfo) => {
	if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
		const hot = hotTableRef.current.hotInstance
		const customSettings = hot.getSettings().customSettings
		const data = customSettings.data
		//
		let startCol = 0
		let startRow = 0
		const selected = hot.getSelected()
		if (selected && selected.length > 0) {
			[startRow, startCol] = selected[0]
			--startCol
		}
		for (let row = startRow; row >= 0; --row) {
			const curRow = data[row]
			for (let col = startCol; col >= 0; --col) {
				if (curRow[col] && curRow[col].toString().includes(searchInfo.word)) {
					hot.selectCell(row, col)
					return
				}
			}
			startCol = MyColumn.Note
		}
		if (selected && selected.length > 0) {
			[startRow, startCol] = selected[0]
		}
		for (let row = data.length - 1; row >= startRow; --row) {
			const curRow = data[row]
			for (let col = MyColumn.Note; col >= 0; --col) {
				if (row === startRow && col === startCol) {
					// Not Found
					return
				}
				if (curRow[col] && curRow[col].toString().includes(searchInfo.word)) {
					hot.selectCell(row, col)
					return
				}
			}
		}
	}
}

const execSearch = (hotTableRef, searchInfo, value) => {
	if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
		const hot = hotTableRef.current.hotInstance
		const selected = hot.getSelected()
		searchInfo.word = value
		if (selected && selected.length > 0) {
			[searchInfo.row, searchInfo.col] = selected[0]
		} else {
			searchInfo.row = 0
			searchInfo.col = 0
		}
		searchNext(hotTableRef, searchInfo)
	}
}
const handleBeforeColumnResizeBase = (hotTableRef, newSize, currentColumn, isDoubleClick) => {
	if (hotTableRef && hotTableRef.current && hotTableRef.current.hotInstance) {
		const hot = hotTableRef.current.hotInstance
		if (hot.isDestroyed) {
			return
		}
		const customSettings = hot.getSettings().customSettings
		if (!customSettings.ghostTable) {
			customSettings.ghostTable = new GhostTable(hot)
		}
		const data = customSettings.data
		const ghostTable = customSettings.ghostTable
		let physicalColumn = hot.toPhysicalColumn(currentColumn)
		if (physicalColumn === null) {
			physicalColumn = currentColumn
		}
		const values = {}
		for (const item of data) {
			if (item
				&& item[physicalColumn]
				&& !IsEmpty(item[physicalColumn])
			) {
				values[item[physicalColumn]] = true
			}
		}
		const samples = new Map()
		const sample = []
		for (const value of Object.keys(values)) {
			sample.push({ value: value, row: 0, col: 0 })
		}
		samples.set(0, { strings: sample })
		ghostTable.addColumn(physicalColumn, samples)
		let newWidth = 10
		ghostTable.getWidths((col, width) => {
			newWidth = width
		})
		ghostTable.clean()
		// ウインドウ幅より幅を大きくしない
		let maxWidth = window.innerWidth - 100
		const rowHeader = hot.getCell(0, -1)
		if (rowHeader) {
			const box = rowHeader.getBoundingClientRect()
			maxWidth -= box.width
		}
		if (newWidth < 20) {
			return 20
		} else if (newWidth > maxWidth) {
			return maxWidth
		}
		return newWidth
	}
	return undefined
}

export { searchKeyEvent, execSearch, searchNext, searchPrev, handleBeforeColumnResizeBase, MyColumn }