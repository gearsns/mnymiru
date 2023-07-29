import Dexie from 'dexie'

export class MnyMiruDB extends Dexie {
	constructor() {
		super('mnymiru-db')
		this.version(1).stores({
			"mnymiru-filehandles-store": 'name,handle'
		})
	}
}
export class MnyMiruStateDB extends Dexie {
	constructor() {
		super('mnymiru-state-db')
		this.version(1).stores({
			ItemTable: 'name,value'
		})
	}
}
export const mnymiru_db = new MnyMiruDB()
export const mnymiru_state_db = new MnyMiruStateDB()
