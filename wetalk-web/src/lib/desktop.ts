/**
 * Tauri 桌面环境桥接 —— 通过 withGlobalTauri 暴露的 window.__TAURI__ 全局对象工作，
 * wetalk-web 不引入任何 @tauri-apps npm 依赖，Web 构建保持零改动。
 */

interface TauriGlobal {
  event?: { emit?: (event: string, payload?: unknown) => void }
  core?: {
    invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
    /** asset 协议：本地路径 → 可 fetch 的 http(s) URL（tauri.conf.json assetProtocol.scope 约束） */
    convertFileSrc?: (path: string, protocol?: string) => string
  }
  updater?: { check?: () => Promise<UpdaterUpdate | null> }
  process?: { relaunch?: () => void }
}

/** updater 插件返回的可用更新描述（downloadAndInstall 由全局 API 提供） */
interface UpdaterUpdate {
  version: string
  body?: string
  downloadAndInstall?: (onProgress?: (event: unknown) => void) => Promise<void>
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

/* ---------- 原生文件选择（tauri-plugin-dialog，经 plugin:dialog|open 命令调用） ---------- */

export interface PickFileOptions {
  multiple?: boolean
  filters?: { name: string; extensions: string[] }[]
}

/**
 * 原生文件选择器（桌面端）。Web 端返回 null，调用方回退 <input type="file">。
 * 返回选中的本地路径列表。
 */
export async function pickFile(opts?: PickFileOptions): Promise<string[] | null> {
  if (!isTauri()) return null
  try {
    const result = (await tauri()?.core?.invoke?.('plugin:dialog|open', {
      options: {
        multiple: opts?.multiple ?? false,
        directory: false,
        filters: opts?.filters
      }
    })) as string | string[] | null
    if (!result) return null
    return Array.isArray(result) ? result : [result]
  } catch {
    return null
  }
}

/** 本地路径 → File（asset 协议读取字节，供既有 presign 直传链路复用） */
export async function fileFromPath(path: string): Promise<File | null> {
  const src = tauri()?.core?.convertFileSrc?.(path)
  if (!src) return null
  try {
    const res = await fetch(src)
    const blob = await res.blob()
    const name = path.split(/[\\/]/).pop() ?? 'file'
    return new File([blob], name, { type: blob.type || 'application/octet-stream' })
  } catch {
    return null
  }
}

/* ---------- 自动更新（tauri-plugin-updater + process，Phase 4 收尾） ---------- */

export interface DesktopUpdate {
  version: string
  /** 下载安装并重启应用（downloadAndInstall 完成后 relaunch） */
  install: () => Promise<void>
}

/**
 * 检查桌面端更新（updater 端点/密钥见 tauri.conf.json plugins.updater）。
 * Web 端、无更新或端点不可达（dev 环境/未配签名密钥）返回 null。
 */
export async function checkForUpdate(): Promise<DesktopUpdate | null> {
  if (!isTauri()) return null
  try {
    const update = await tauri()?.updater?.check?.()
    if (!update) return null
    const g = tauri()
    return {
      version: update.version,
      install: async () => {
        await update.downloadAndInstall?.()
        g?.process?.relaunch?.()
      }
    }
  } catch {
    return null
  }
}
