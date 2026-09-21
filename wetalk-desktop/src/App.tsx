import { useEffect, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'

// 复用 web 端 App（通过 @web 别名指向 wetalk-web/src）
import WebApp from '@web/App'

/**
 * 桌面端 App：包裹 web 端 App，注入 Tauri 桌面端能力。
 * - 系统托盘（Rust 侧 src-tauri/src/main.rs 已注册）
 * - 自动更新（Tauri Plugin Updater）
 * - 全局快捷键
 * 当前仅检测运行环境，后续按需添加桌面端专属逻辑。
 */
function App() {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    isTauri().then(setDesktop).catch(() => setDesktop(false))
  }, [])

  // 运行在 Tauri 桌面壳中时，可在此注入桌面端专属能力
  // 例如：托盘未读角标、自动更新检查、全局快捷键注册
  if (desktop) {
    console.log('[WeTalk Desktop] running in Tauri')
  }

  return <WebApp />
}

export default App
