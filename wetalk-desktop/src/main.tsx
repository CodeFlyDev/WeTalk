import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// 桌面端入口：复用 wetalk-web 的 App 组件层，注入桌面端能力（系统托盘、自动更新等）
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
