import React, { useState, useRef, useCallback, useEffect } from "react"
import { Layout, Button } from 'antd'
import { DockLayout } from 'rc-dock'
import logoimage from "../../assets/images/logo.png"
import "../../assets/rc-dock.css"
import { InuptPaneContext } from './InputPane'
import { SearchPaneContext } from './SearchPane'
import { ChartPaneContent } from './ChartPane'
import {
  MenuOutlined, GithubOutlined,
  EditOutlined, SearchOutlined, BarChartOutlined,
} from '@ant-design/icons'
import Database from '../../lib/database'
import { mnymiru_state_db } from '../../store/db'
import { useStoreContext, useDispatchStoreContext } from '../../store'
import { dataManager } from "../../DataManager"
import { MainMenu } from "./MainManu"

const { Header, Content } = Layout

const dockLayoutStyle = { position: 'absolute', left: 0, top: 40, right: 0, bottom: 0 }
const defaultLayout = {
  dockbox: {
    mode: 'vertical',
    children: [
      {
        tabs: [
          {
            id: 'id_input', title: <><EditOutlined /> 入力</>, content: (
              <InuptPaneContext />
            ), cached: true
          }
        ]
      },
      {
        tabs: [
          {
            id: 'id_search', title: <><SearchOutlined /> 検索</>, content: (
              <SearchPaneContext />
            ), cached: true
          },
          {
            id: 'id_chart', title: <><BarChartOutlined /> グラフ</>, content: (
              <ChartPaneContent />
            ), cached: true
          },
        ]
      }
    ]
  }
}

const Home = _ => {
  const refDock = useRef()
  const mainMenuRef = useRef()
  const storeDispatch = useDispatchStoreContext()
  const [filename, setFilename] = useState()
  const store = useStoreContext()

  const createDB = async _ => {
    const database = new Database()
    let latestItem = null
    await mnymiru_state_db.table("ItemTable")
      .where("name").equals("latest.opened")
      .first()
      .then(item => {
        if (item) {
          latestItem = item.value
        }
      })
    if (latestItem) {
      await database.openBuffer(latestItem.arrayBuffer, latestItem.fileHandle, latestItem.dirHandle)
      if (latestItem.savedFlag === false) {
        database.setModify()
      }
    } else {
      await database.create()
    }
    storeDispatch({ type: "RefreshDatabase", store: database })
  }
  useEffect(_ => { createDB() }, [])
  const showDrawer = _ => {
    mainMenuRef.current?.showDrawer()
  }
  useEffect(_ => {
    if (store.database && store.database.fileHandle) {
      if (store.database.dirHandle) {
        setFilename(`${store.database.dirHandle.name}/${store.database.fileHandle.name}`)
        document.title = `${store.database.dirHandle.name}/${store.database.fileHandle.name} - MnyMiru`
      } else {
        setFilename(store.database.fileHandle.name)
        document.title = `${store.database.fileHandle.name} - MnyMiru`
      }
    } else {
      setFilename("...")
      document.title = "MnyMiru"
    }
  }, [store.database, store.database?.fileHandle])
  //
  useEffect(_ => {
    window.addEventListener("beforeunload", dataManager.update, true)
    return _ => window.removeEventListener("beforeunload", dataManager.update, true)
  }, [])

  return (
    <Layout>
      <MainMenu ref={mainMenuRef}></MainMenu>
      <Header className="title_header">
        <Button type='text' onClick={showDrawer}><MenuOutlined /></Button>
        <img src={logoimage} /> <h1 className='title'>MnyMiru</h1>1.3
        [{filename}]
        <span className="source_link"><a href="https://github.com/gearsns/mnymiru"><GithubOutlined /></a></span>
      </Header>
      <Content>
        <DockLayout ref={refDock} defaultLayout={defaultLayout}
          style={dockLayoutStyle}
        />
      </Content>
    </Layout >
  )
}

export default Home
