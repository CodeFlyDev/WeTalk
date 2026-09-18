/**
 * Tauri 桌面环境桥接 —— 通过 withGlobalTauri 暴露的 window.__TAURI__ 全局对象工作，
 * wetalk-web 不引入任何 @tauri-apps npm 依赖，Web 构建保持零改动。
 */

interface TauriGlobal {
  event?: { emit?: (event: string, payload?: unknown) => void }
  core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> }
}

function tauri(): TauriGlobal | undefined {
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 系统信息（Rust get_system_info command） */
export interface SystemInfo {
  os: string
  arch: string
  app_version: string
}

export function getSystemInfo(): Promise<SystemInfo | null> {
  return tauri()
    ?.core?.invoke?.('get_system_info')
    .then((info) => info as SystemInfo)
    .catch(() => null) ?? Promise.resolve(null)
}

/** 桌面通知：Rust 侧监听 wetalk://notify 并调用原生通知 */
export function notifyDesktop(title: string, body: string) {
  if (!isTauri()) return
  try {
    tauri()?.event?.emit?.('wetalk://notify', { title, body })
  } catch {
    // 非 Tauri 环境或桥接失败时静默
  }
}
