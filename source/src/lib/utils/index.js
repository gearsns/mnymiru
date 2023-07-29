const IsEmpty = e => {
	if (e === null || e === undefined) {
		return true
	} else if (typeof e === 'string' && e.length == 0) {
		return true
	}
	return false
}

export { IsEmpty }