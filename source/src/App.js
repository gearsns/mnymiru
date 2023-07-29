import './App.css';
import Home from "./views/Home";
import { StoreProvider } from './store'
const App = _ => {
  return (
    <StoreProvider>
      <Home />
    </StoreProvider>
  )
}

export default App
