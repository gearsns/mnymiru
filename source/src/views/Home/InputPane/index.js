import React, { useRef, useEffect, useLayoutEffect, useState, forwardRef, useMemo } from "react"
import { Input, Button, DatePicker, Layout } from 'antd'
import { LeftOutlined, RightOutlined, SortAscendingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useStoreContext, useDispatchStoreContext } from '../../../store'
import { InputSheet } from "./InputSheet"
import { dataManager } from "../../../DataManager"

const { Header, Content, Footer } = Layout
const { Search } = Input

const cellRender = current => {
  return (
    <div className="ant-picker-cell-inner">
      {current.month() + 1}月
    </div>
  )
}

const InputPaneBase = ({ inputSheetRef, inputSheet, curDate, setCurDate }) => {
  const [statusText, setStatusText] = useState()
  const refMain = useRef()
  const store = useStoreContext()
  const storeDispatch = useDispatchStoreContext()
  //
  useEffect(_ => {
    dataManager.set(store.database, curDate.year(), curDate.month() + 1)
    updateCurData()
  }, [store.database])
  useEffect(_ => {
    const year = curDate.year()
    const month = curDate.month() + 1
    if (store.yearmonth
      && store.yearmonth.year === year && store.yearmonth.month === month
      && store.yearmonth.line_no !== undefined
      && store.yearmonth.col !== undefined) {
      if (inputSheetRef && inputSheetRef.current) {
        const hot = inputSheetRef.current
        hot.selectCell(store.yearmonth.line_no, store.yearmonth.col)
      }
    }
    if (!store.yearmonth ||
      store.yearmonth.line_no === undefined ||
      (store.yearmonth.year === year && store.yearmonth.month === month)) {
      return
    }
    setCurDate(dayjs(new Date(store.yearmonth.year, store.yearmonth.month - 1, 1)))
  }, [store.yearmonth])
  //
  const handleSort = _ => inputSheetRef.current?.sort()
  const movePrevMonth = _ => setCurDate(d => d.subtract(1, 'M'))
  const moveThisMonth = _ => setCurDate(dayjs(Date.now()))
  const moveNextMonth = _ => setCurDate(d => d.add(1, 'M'))
  const handleSearch = value => inputSheetRef.current?.search(value)
  //
  const setSearchFocus = _ => {
    if (refMain && refMain.current) {
      let e = refMain.current.querySelector(".ant-input-search input")
      if (e) {
        e.focus()
      }
    }
  }
  //
  const updateCurData = async _ => {
    if (inputSheetRef && inputSheetRef.current) {
      const hot = inputSheetRef.current
      hot.setCallback("setStatus", text => setStatusText(text))
      hot.setCallback("getItems", name => getItems(name))
      hot.setCallback("getTopItem", (src, dst, value) => getTopItem(src, dst, value))
      hot.setCallback("setSearchFocus", _ => setSearchFocus())
      if (!curDate) {
        return
      }
      const year = curDate.year()
      const month = curDate.month() + 1
      const db = store.database
      if (!db) {
        return
      }
      hot.loadData(year, month)
      if (store.yearmonth
        && store.yearmonth.year === year && store.yearmonth.month === month
        && store.yearmonth.line_no !== undefined
        && store.yearmonth.col !== undefined) {
        hot.selectCell(store.yearmonth.line_no, store.yearmonth.col)
      }
      storeDispatch({ type: "SetYearMonth", store: { year: year, month: month } })
    }
  }
  const getItems = name => {
    const db = store.database
    if (!db) {
      return []
    }
    return db.getItems(name)
  }
  const getTopItem = (src, dst, value) => {
    const db = store.database
    if (!db) {
      return []
    }
    return db.getTopItem(src, dst, value)
  }
  //
  useEffect(_ => {
    const timer = setTimeout(updateCurData, 50)
    return _ => {
      clearTimeout(timer)
    }
  }, [curDate])
  // Handsontableのサイズ調整
  const handleResize = _ => {
    if (inputSheetRef && inputSheetRef.current && refMain && refMain.current) {
      const main = refMain.current.getElementsByTagName("main")
      if (main && main.length > 0) {
        const rect = main[0].getBoundingClientRect()
        const hot = inputSheetRef.current
        hot.resize(rect.height - 40)
      }
    }
  }
  useLayoutEffect(_ => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return _ => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  let resizeObserver = null

  useEffect(_ => {
    if (ResizeObserver) {
      resizeObserver = new ResizeObserver(_ => {
        handleResize()
      })
    }
    if (resizeObserver) {
      refMain.current && resizeObserver.observe(refMain.current);
    }
    return _ => resizeObserver?.disconnect()
  }, [])
  //

  return (
    <Layout ref={refMain} className="tab_pane_layout">
      <Header className="header">
        <Button onClick={handleSort}><SortAscendingOutlined /> 並べ替え</Button>
        <Button onClick={movePrevMonth}><LeftOutlined /></Button>
        <Button onClick={moveThisMonth}>今月</Button>
        <Button onClick={moveNextMonth}><RightOutlined /></Button>
        <DatePicker
          picker="month"
          format="YYYY/MM"
          defaultValue={curDate}
          value={curDate}
          onChange={setCurDate}
          cellRender={cellRender}
        />
        <Search
          className="search_box"
          placeholder="input search text"
          allowClear
          enterButton="Search"
          onSearch={handleSearch}
        />
      </Header>
      <Content className="tab_pane_content">{inputSheet}</Content>
      <Footer className="footer">
        <span>{statusText}</span>
      </Footer>
    </Layout>
  )
}

const InuptPaneContext = forwardRef(function InuptPaneContext(props, ref) {
  const [curDate, setCurDate] = useState(dayjs(Date.now()))
  const inputSheetRef = useRef()
  const sheet = useMemo(_ => (<InputSheet ref={inputSheetRef}></InputSheet>), [])

  return (
    <div ref={ref} className="tab_pane">
      <InputPaneBase
        inputSheetRef={inputSheetRef}
        inputSheet={sheet}
        curDate={curDate} setCurDate={setCurDate}
      />
    </div>
  )
})

export { InuptPaneContext }