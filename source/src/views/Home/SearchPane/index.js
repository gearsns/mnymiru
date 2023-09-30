import React, { useRef, useEffect, useLayoutEffect, forwardRef, useState, useMemo } from "react"
import { Input, Layout } from 'antd'
import { useStoreContext } from '../../../store'
import { SearchSheet } from "./SearchSheet"

const { Header, Content, Footer } = Layout
const { Search } = Input

const SearchPaneBase = ({ searchSheetRef, searchSheet }) => {
  const [statusText, setStatusText] = useState()
  const refMain = useRef()
  const store = useStoreContext()

  const handleSearch = value => {
    const db = store.database
    if (!db) {
      return
    }
    if (searchSheetRef && searchSheetRef.current) {
      const hot = searchSheetRef.current
      const data = db.search(value)
      hot.loadData(data)
    }
  }
  //
  useEffect(_ => {
    if (searchSheetRef && searchSheetRef.current) {
      const hot = searchSheetRef.current
      hot.setCallback("setStatus", text => setStatusText(text))
    }
  }, [])
  // Handsontableのサイズ調整
  const handleResize = _ => {
    if (searchSheetRef && searchSheetRef.current && refMain && refMain.current) {
      const main = refMain.current.getElementsByTagName("main")
      if (main && main.length > 0) {
        const rect = main[0].getBoundingClientRect()
        const hot = searchSheetRef.current
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
        <Search
          className="search_box"
          placeholder="input search text"
          allowClear
          enterButton="Search"
          onSearch={handleSearch}
        />
      </Header>
      <Content className="tab_pane_content">{searchSheet}</Content>
      <Footer className="footer">
        <span>{statusText}</span>
      </Footer>
    </Layout>
  )
}

const SearchPaneContext = forwardRef(function _(props, ref) {
  const searchSheetRef = useRef()
  const sheet = useMemo(_ => (<SearchSheet ref={searchSheetRef}></SearchSheet>), [])

  return (
    <div ref={ref} className="tab_pane">
      <SearchPaneBase
        searchSheetRef={searchSheetRef}
        searchSheet={sheet}
      />
    </div>
  )
})

export { SearchPaneContext }