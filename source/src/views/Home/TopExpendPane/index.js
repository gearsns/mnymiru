import React, { useRef, useEffect, useLayoutEffect, forwardRef, useState, useMemo } from "react"
import { Select, Button, Layout } from 'antd'
import { useStoreContext } from '../../../store'
import { TopExpendSheet } from "./TopExpendSheet"
import { ReloadOutlined } from '@ant-design/icons'

const { Header, Content, Footer } = Layout

const TopExpendPaneBase = ({ topExpendSheetRef, topExpendSheet }) => {
  const [accountNames, setAccountNames] = useState([{ value: "", label: "全て" }])
  const [statusText, setStatusText] = useState()
  const refMain = useRef()
  const store = useStoreContext()

  const handleUpdateTopExpend = _ => {
    const db = store.database
    if (!db) {
      return
    }
    const accounts = db.accountList(store.yearmonth.year)
    const items = [{ value: "", label: "全て" }]
    for (const item of accounts) {
      items.push({ value: item, label: item })
    }
    setAccountNames(items)
    updateSheet()
  }
  const handleChange = value => {
    updateSheet(value)
  }
  const updateSheet = account => {
    const db = store.database
    if (!db) {
      return
    }
    if (topExpendSheetRef && topExpendSheetRef.current) {
      const hot = topExpendSheetRef.current
      const data = db.topNExpend(`${store.yearmonth.year * 100 + store.yearmonth.month}`, account)
      hot.loadData(data)
    }
  }
  //
  useEffect(_ => {
    if (topExpendSheetRef && topExpendSheetRef.current) {
      const hot = topExpendSheetRef.current
      hot.setCallback("setStatus", text => setStatusText(text))
    }
  }, [])
  // Handsontableのサイズ調整
  const handleResize = _ => {
    if (topExpendSheetRef && topExpendSheetRef.current && refMain && refMain.current) {
      const main = refMain.current.getElementsByTagName("main")
      if (main && main.length > 0) {
        const rect = main[0].getBoundingClientRect()
        const hot = topExpendSheetRef.current
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
      <Button onClick={handleUpdateTopExpend}><ReloadOutlined /> 更新</Button>
          <Select
            defaultValue={""}
            onChange={handleChange}
            options={accountNames}
            className="select_box"
          />
      </Header>
      <Content className="tab_pane_content">{topExpendSheet}</Content>
      <Footer className="footer">
        <span>{statusText}</span>
      </Footer>
    </Layout>
  )
}

const TopExpendPaneContext = forwardRef(function _(props, ref) {
  const topExpendSheetRef = useRef()
  const sheet = useMemo(_ => (<TopExpendSheet ref={topExpendSheetRef}></TopExpendSheet>), [])

  return (
    <div ref={ref} className="tab_pane">
      <TopExpendPaneBase
        topExpendSheetRef={topExpendSheetRef}
        topExpendSheet={sheet}
      />
    </div>
  )
})

export { TopExpendPaneContext }