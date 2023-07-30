import initSqlJs from "sql.js"
// Required to let webpack 4 know it needs to copy the wasm file to our assets
import sqlWasm from "!!file-loader?name=sql-wasm-[contenthash].wasm!sql.js/dist/sql-wasm.wasm"
import dayjs from 'dayjs'
import { IsEmpty } from "../utils"

export default class Database {
	constructor() {
		this.db = null
		this.file = null
		this.fileHandle = null
		this.dirHandle = null
		this.cacheItems = {}
		this.savedFlag = true
	}
	async _create() {
		this.db.exec("CREATE TABLE IF NOT EXISTS cash (" +
			"id INTEGER NOT NULL PRIMARY KEY," +
			"year_month INTEGER NOT NULL," +
			"day INTEGER NOT NULL," +
			"time TEXT NOT NULL," +
			"line_no INTEGER NOT NULL," +
			"shop_name TEXT NOT NULL," +
			"item_name TEXT NOT NULL," +
			"detail TEXT NOT NULL," +
			"expenses INTEGER NOT NULL," +
			"incomes INTEGER NOT NULL," +
			"quantity INTEGER NOT NULL," +
			"total INTEGER NOT NULL," +
			"account TEXT NOT NULL," +
			"note TEXT NOT NULL)")
	}
	async create() {
		this.close()
		const SQL = await initSqlJs({ locateFile: () => sqlWasm })
		this.db = new SQL.Database()
		this.file = null
		this.fileHandle = null
		this.dirHandle = null
		this.cacheItems = {}
		this.savedFlag = true
		this._create()
		return this.db
	}
	async openFolder(dirHandle, filename) {
		if (window.showDirectoryPicker) {
			let newDirHanlde
			if (dirHandle) {
				newDirHanlde = dirHandle
				if (dirHandle.kind === 'file') {
					await this.open(dirHandle)
					return
				}
				// すでにユーザーの許可が得られているかをチェック
				let permission = await dirHandle.queryPermission({ mode: 'readwrite' })
				if (permission !== 'granted') {
					// ユーザーの許可が得られていないなら、許可を得る（ダイアログを出す）
					permission = await dirHandle.requestPermission({ mode: 'readwrite' })
					if (permission !== 'granted') {
						throw new Error('Please allow the storage access permission request.')
					}
				}
			} else {
				newDirHanlde = await window.showDirectoryPicker({ mode: "readwrite" })
			}
			if (!filename) {
				filename = 'cash.db'
			}
			await this.open(await newDirHanlde.getFileHandle(filename, { create: true }))
			this.savedFlag = true
			this.dirHandle = newDirHanlde
		} else {
			throw new Error('Please allow the storage access permission request.')
		}
	}
	async open(filehandle) {
		this.close()
		let arrayBuffer = null
		if (window.showOpenFilePicker) {
			if (filehandle) {
				this.fileHandle = filehandle
				// すでにユーザーの許可が得られているかをチェック
				let permission = await filehandle.queryPermission({ mode: 'readwrite' })
				if (permission !== 'granted') {
					// ユーザーの許可が得られていないなら、許可を得る（ダイアログを出す）
					permission = await filehandle.requestPermission({ mode: 'readwrite' })
					if (permission !== 'granted') {
						throw new Error('Please allow the storage access permission request.')
					}
				}
			} else {
				[this.fileHandle] = await window.showOpenFilePicker({
					types: [
						{
							description: "Sqlite file",
							accept: { "application/octet-binary": [".db", ".sqlte"] }
						}
					],
				})
			}
			this.file = await this.fileHandle.getFile()
			arrayBuffer = await this.file.arrayBuffer()
		} else {
			this.file = await new Promise(resolve => {
				const input = document.createElement('input')
				input.type = 'file'
				input.onchange = e => {
					resolve(e.target.files[0])
				}
				input.click()
			})
			arrayBuffer = await new Promise(resolve => {
				const reader = new FileReader()
				reader.readAsArrayBuffer(this.file)
				reader.onload = _ => {
					resolve(reader.result)
				}
			})
		}
		const SQL = await initSqlJs({ locateFile: () => sqlWasm })
		this.db = new SQL.Database(new Uint8Array(arrayBuffer))
		this._create()
		this.cacheItems = {}
		this.savedFlag = true
	}
	async openBuffer(arrayBuffer, fileHandle, dirHandle) {
		const SQL = await initSqlJs({ locateFile: () => sqlWasm })
		this.db = new SQL.Database(arrayBuffer)
		this._create()
		this.fileHandle = fileHandle
		this.dirHandle = dirHandle
		this.cacheItems = {}
		this.savedFlag = true
	}
	async backup() {
		const backupfile = `${this.fileHandle.name}.backup.${dayjs(Date.now()).format('YYYYMMDDHHmmss')}`
		const file = await this.fileHandle.getFile()
		const contents = new Uint8Array(await file.arrayBuffer())
		const backupFileHandle = await this.dirHandle.getFileHandle(backupfile, { create: true })
		const writer = await backupFileHandle.createWritable()
		await writer.truncate(0)
		await writer.write(contents)
		await writer.close()
	}
	export() {
		return this.db.export()
	}
	async save() {
		if (window.showSaveFilePicker) {
			if (!this.fileHandle) {
				await this.saveAs()
				return
			}
			if (this.dirHandle) {
				const checked = await this.dirHandle.requestPermission({
					mode: "readwrite"
				})
				if (checked === "granted") {
					await this.backup()
				}
			}
			const checked = await this.fileHandle.requestPermission({
				mode: "readwrite"
			})
			if (checked === "granted") {
				const writer = await this.fileHandle.createWritable()
				await writer.truncate(0)
				await writer.write(this.db.export())
				await writer.close()
				this.savedFlag = true
			} else {
				throw new Error('ファイルの書き込みが許可されていません。')
			}
		} else {
			const a = document.createElement('a')
			a.href = URL.createObjectURL(new Blob([this.db.export().buffer], { type: "application/octet-binary" }))
			if (this.file) {
				a.download = this.file.name
			} else {
				a.download = 'sqlite.db'
			}
			a.style.display = 'none'
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			this.savedFlag = true
		}
	}
	async saveAs() {
		this.fileHandle = await window.showSaveFilePicker({
			types: [
				{
					description: "Sqlite file",
					accept: { "application/octet-binary": [".db"] }
				}
			]
		})
		const writer = await this.fileHandle.createWritable()
		await writer.truncate(0)
		await writer.write(this.db.export())
		await writer.close()
		this.savedFlag = true
	}
	async csvExport() {
		if (!this.db) {
			return
		}
		let data = [
			["日付(年)", "日付(月)", "日付(日)", "店名", "時間", "項目", "内訳", "支出", "数量", "収入", "小計", "現金/口座", "備考"]
		]
		for (const tret of this.db.exec(`SELECT
		year_month,day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note
		FROM cash WHERE day>=0
		ORDER BY year_month, line_no
		`)) {
			for (const item of tret.values) {
				const [year_month, day, shop_name, time, item_name, detail, expenses, quantity, incomes, total, account, note] = item
				if (year_month) {
					const m = year_month.toString().match(/^([0-9]{4})([0-9]{2})$/)
					if (m && m.length > 1) {
						const year = Math.trunc(m[1])
						const month = Math.trunc(m[2])
						data.push([year, month, day || "", shop_name, time, item_name, detail, expenses, quantity, incomes, total, account, note])
					}
				}
			}
		}
		const escapeForCSV = s => {
			s = (s || "").toString()
			if (s.match(/["\r\n]/)) {
				return `"${s.replace(/\"/g, '\"\"')}"`
			}
			return s
		}
		const arrToString = arr => arr.map(row => row.map(cell => escapeForCSV(cell)).join(",")).join("\n")
		const blob = new Blob([arrToString(data)], { type: "text/csv" })
		if (window.showSaveFilePicker) {
			const fileHandle = await window.showSaveFilePicker({
				types: [
					{
						description: "CSV file",
						accept: { "text/csv": [".csv"] }
					}
				]
			})
			const writer = await fileHandle.createWritable()
			await writer.truncate(0)
			await writer.write(blob)
			await writer.close()
		} else {
			const a = document.createElement('a')
			a.href = URL.createObjectURL(blob)
			if (this.file) {
				a.download = this.file.name
			} else {
				a.download = 'cash.csv'
			}
			a.style.display = 'none'
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
		}
	}
	setModify() {
		this.savedFlag = false
	}
	exec(sql) {
		return this.db.exec(sql)
	}
	prepare(sql) {
		return this.db.prepare(sql)
	}
	updateYearMonthData(data, year, month) {
		if (!this.db) {
			return
		}
		let yearmonth = year
		if (month) {
			yearmonth = dayjs(new Date(year, month - 1, 1)).format("YYYYMM")
		}
		const db = this.db
		db.exec("BEGIN TRANSACTION")
		db.exec(`UPDATE cash SET day=-1 WHERE year_month='${yearmonth}'`)
		const idmap = {}
		for (const tret of db.exec(`SELECT id,line_no FROM cash WHERE year_month='${yearmonth}'`)) {
			for (const item of tret.values) {
				idmap[item[1]] = item[0]
			}
		}
		//
		const stmt = db.prepare("INSERT OR REPLACE INTO cash ("
			+ " year_month,day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note,id,line_no"
			+ ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
		let line_no = 0
		for (const item of data) {
			let bnext = true
			for (let i = 0; i < 11; ++i) {
				// 支出,数量,収入,小計は、0の場合は未入力と判断
				if(i === 5 || i === 6 || i === 7 || i === 8){
					if(0 === parseFloat(item[i])){
						continue
					}
				}
				if (!IsEmpty(item[i])) {
					bnext = false
					break
				}
			}
			if (bnext) {
				++line_no
				continue
			}
			const [day, shop_name, time, item_name, detail, expenses, quantity, incomes, total, account, note, id] = item
			const newId = idmap[line_no] || id || null
			stmt.run([yearmonth, Math.max(day || 0, 0), shop_name || "", time || "", item_name || "", detail || "", expenses || 0, quantity || 0, incomes || 0, total || 0, account || "", note || "", newId, line_no])
			++line_no
		}
		stmt.free()
		db.exec("COMMIT")
	}
	readYearMonthData(yearmonth) {
		if (!this.db) {
			return []
		}
		let data = []
		for (const tret of this.db.exec(`SELECT
		day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note,id,line_no
		FROM cash WHERE year_month='${yearmonth}' AND day>=0
		ORDER BY line_no
		`)) {
			for (const item of tret.values) {
				const [day, shop_name, time, item_name, detail, expenses, quantity, incomes, total, account, note, id, line_no] = item
				data[line_no] = [day || "", shop_name, time, item_name, detail, expenses, quantity, incomes, total, account, note, id]
			}
		}
		return data
	}
	getTopItem(src, dst, value) {
		if (!this.db) {
			return null
		}
		const d = dayjs(Date.now()).add(-3, 'y').format('YYYYMM')
		for (const tret of this.db.exec(`SELECT * FROM (SELECT 
			${dst} AS dst,COUNT(*) AS cnt FROM cash WHERE ${src}=?
			AND year_month>=? AND day >= 0
			GROUP BY  dst)
			ORDER BY cnt DESC LIMIT 1
		  `, [value, d])) {
			for (const item of tret.values) {
				return item[0]
			}
		}
		return null
	}
	getItems(itemName) {
		if (this.cacheItems[itemName]) {
			return this.cacheItems[itemName]
		}
		let data = []
		if (this.db) {
			const d = dayjs(Date.now()).add(-3, 'y').format('YYYYMM')
			for (const tret of this.db.exec(`SELECT * FROM
			(SELECT ${itemName} as n, count(*) as c FROM cash WHERE year_month>='${d}' AND day >= 0 GROUP BY ${itemName})
			ORDER BY c desc
			`)) {
				data = tret.values
				this.cacheItems[itemName] = data
			}
		}
		return data
	}
	clearCache() {
		this.cacheItems = []
	}
	search(keyword) {
		if (!this.db) {
			return []
		}
		keyword = keyword.replace("*", "%").replace("?", "_")
		keyword = "%" + keyword + "%"
		let data = []
		for (const tret of this.db.exec(`SELECT
		year_month,day,shop_name,time,item_name,detail,expenses,quantity,incomes,total,account,note,id,line_no
		FROM cash WHERE
		 (  item_name LIKE :keyword
		 OR shop_name LIKE :keyword
		 OR detail LIKE :keyword
		 OR note LIKE :keyword
		 OR account LIKE :keyword
		 )
		 AND day>=0
		 ORDER BY year_month,day,line_no ASC
		`, { ':keyword': keyword })) {
			for (const item of tret.values) {
				const [year_month, day, shop_name, time, item_name, detail, expenses, quantity, incomes, total, account, note, id, line_no] = item
				data.push([year_month + ("0" + (day || "")).slice(-2), shop_name, time, item_name, detail, expenses, quantity, incomes, total, account, note, id, line_no])
			}
		}
		return data
	}
	monthTotalList(year, account) {
		if (!this.db) {
			return []
		}
		let data = []
		if (account) {
			for (const tret of this.db.exec(`SELECT
			year_month, item_name, sum(total) as total
			FROM cash WHERE
			year_month >= :year_min and year_month <= :year_max and total<0 and day>0
			and detail!='繰り越し'
			and detail!='口座振替'
			and note not like '%#除外%'
			and account=:account
			GROUP BY year_month,item_name
			ORDER BY year_month,item_name
			`, {
				':year_min': (year * 100 + 1).toString()
				, ':year_max': (year * 100 + 12).toString()
				, ':account': account
			})) {
				for (const item of tret.values) {
					data.push(item)
				}
			}
		} else {
			for (const tret of this.db.exec(`SELECT
			year_month, item_name, sum(total) as total
			FROM cash WHERE
			year_month >= :year_min and year_month <= :year_max and total<0 and day>0
			and detail!='繰り越し'
			and detail!='口座振替'
			and note not like '%#除外%'
			and (account!='' AND account IS NOT NULL)
			GROUP BY year_month,item_name
			ORDER BY year_month,item_name
			`, {
				':year_min': (year * 100 + 1).toString()
				, ':year_max': (year * 100 + 12).toString()
			})) {
				for (const item of tret.values) {
					data.push(item)
				}
			}
		}
		return data
	}
	accountList(year) {
		if (!this.db) {
			return []
		}
		let data = []
		for (const tret of this.db.exec(`SELECT
		account
		FROM cash WHERE
		year_month >= :year_min and year_month <= :year_max and total<0 and day>0
		and account!=''
		GROUP BY account
		ORDER BY account
		`, {
			':year_min': (year * 100 + 1).toString()
			, ':year_max': (year * 100 + 12).toString()
		})) {
			for (const item of tret.values) {
				data.push(item[0])
			}
		}
		return data
	}

	close() {
		this.fileHandle = null
		this.dirHandle = null
		if (this.db) {
			this.db.close()
		}
		this.db = null
	}
}
