import { useReducer, createContext, useContext } from "react"

const reducer = (prevStore, { type, store }) => {
	switch (type) {
		case "add":
			return prevStore
		case "Set":
			return store
		case "RefreshDatabase":
			return { ...prevStore, database: store }
		case "SetYearMonth":
			return { ...prevStore, yearmonth: store }
		default:
			return prevStore
	}
}

const useStoreRecuder = () => {
	const [store, dispatch] = useReducer(reducer, {})
	return { store, dispatch }
}
const defaultStoreReducer = {
	store: {},
	dispatch: () => { }
}

const { store, dispatch } = defaultStoreReducer
const StoreContext = createContext(store)
const StoreDispatchContext = createContext(dispatch)

const StoreProvider = ({ children }) => {
	const { store, dispatch } = useStoreRecuder()
	return (
		<StoreContext.Provider value={store}>
			<StoreDispatchContext.Provider value={dispatch}>
				{children}
			</StoreDispatchContext.Provider>
		</StoreContext.Provider>
	)
}
const useStoreContext = () => useContext(StoreContext)
const useDispatchStoreContext = () => useContext(StoreDispatchContext)

export { defaultStoreReducer, useStoreRecuder, useStoreContext, useDispatchStoreContext, StoreProvider }
