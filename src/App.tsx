import { useEffect, useRef, useState } from 'react'
import { Button, Layout, Tooltip } from 'antd'
import {
  BarChartOutlined,
  EditOutlined,
  GithubOutlined,
  OrderedListOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { DockLayout, type LayoutData } from 'rc-dock'
import './App.css'
import './assets/styles/vendors.css';
import { DataReport } from './features/reporter/DataReport'
import { SearchFilter } from './features/searcher/SearchFilter'
import { DataChart } from './features/visualizer/DataChart'
import { DataEditor } from './features/editor/DataEditor'
import { TopMenu } from './features/menu/TopMenu'
import { Footer } from 'antd/es/layout/layout'
import { useFileAction } from './hooks/useFileAction'
import logoimage from "./assets/logo.png"
import { useDataStore } from './store/useDataStore'
import { getWorker } from './services/sqliteClient'
import { getMigemo } from './features/editor/utils'

const { Header, Content } = Layout
const dockLayoutStyle: React.CSSProperties = { position: 'absolute', left: 0, top: 40, right: 0, bottom: 0 }
const defaultLayout: LayoutData = {
  dockbox: {
    mode: 'vertical',
    children: [
      {
        tabs: [
          {
            id: 'id_input', title: <><EditOutlined /> 入力</>, content: (
              <DataEditor />
            ), cached: true
          }
        ]
      },
      {
        tabs: [
          {
            id: 'id_search', title: <><SearchOutlined /> 検索</>, content: (
              <SearchFilter />
            ), cached: true
          },
          {
            id: 'id_chart', title: <><BarChartOutlined /> グラフ</>, content: (
              <DataChart />
            ), cached: true
          },
          {
            id: 'id_topexpend', title: <><OrderedListOutlined /> 支出上位</>, content: (
              <DataReport />
            ), cached: true
          },
        ]
      }
    ]
  }
}
function App() {
  const [isReady, setIsReady] = useState(false);
  const refDock = useRef(null);
  const { openSession } = useFileAction();
  const { fileName } = useDataStore();

  useEffect(() => {
    const start = async () => {
      getWorker();
      getMigemo();
      try {
        await openSession();
      } catch {
        /* empty */
      } finally {
        setIsReady(true);
      }
    };
    start();
  }, [openSession]);

  useEffect(() => {
    if (fileName) {
      document.title = `${fileName} - MnyMiru`;
    } else {
      document.title = "MnyMiru";
    }
  }, [fileName]);

  if (!isReady) {
    return null; // または <div>Loading...</div>
  }
  return (
    <>
      <Layout>
        <Header className="title_header">
          <TopMenu />
          <img src={logoimage} /> <h1 className='title'>MnyMiru</h1>{import.meta.env.PACKAGE_VERSION}
          [{fileName || "New"}]
          <Tooltip title="View on GitHub" placement="bottomRight">
            <Button
              className="source_link"
              type="text"
              icon={<GithubOutlined />}
              href="https://github.com/gearsns/mnymiru"
              target="_blank"
            />
          </Tooltip>
        </Header>
        <Content>
          <DockLayout ref={refDock} defaultLayout={defaultLayout}
            style={dockLayoutStyle}
          />
        </Content>
        <Footer></Footer>
      </Layout>
    </>
  )
}

export default App
