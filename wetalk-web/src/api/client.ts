import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiResult } from '@/types/api'

/** Token 存取（authStore 也用同样的 key，避免循环依赖） */
export const TOKEN_KEY = 'wetalk.tokens'

export interface StoredTokens {
  accessToken: string
  refreshToken: string
  user: { id: number; username: string; nickname: string; avatarUrl: string | null }
}

export function readTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as StoredTokens) : null
  } catch {
    return null
  }
}

export function writeTokens(tokens: StoredTokens | null) {
  if (tokens) localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
  else localStorage.removeItem(TOKEN_KEY)
}

export const http = axios.create({ baseURL: '/api', timeout: 15000 })

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = readTokens()
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`
  }
  return config
})

/** 401 时用 refreshToken 换新 token 后重放一次 */
let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const tokens = readTokens()
  if (!tokens?.refreshToken) return null
  try {
    const res = await axios.post<ApiResult<{ accessToken: string; refreshToken: string }>>(
      '/api/auth/refresh',
      { refreshToken: tokens.refreshToken }
    )
    if (res.data.code !== 0) return null
    const { accessToken, refreshToken } = res.data.data
    writeTokens({ ...tokens, accessToken, refreshToken })
    return accessToken
  } catch {
    return null
  }
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiResult<unknown>>) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
    if (error.response?.status === 401 && config && !config._retried) {
      config._retried = true
      refreshing = refreshing ?? refreshAccessToken()
      const token = await refreshing
      refreshing = null
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        return http(config)
      }
      // 刷新失败：清登录态，让路由守卫跳登录页
      writeTokens(null)
      window.dispatchEvent(new CustomEvent('wetalk:unauthorized'))
    }
    return Promise.reject(error)
  }
)

/** 解包 ApiResult：code=0 返回 data，否则抛业务错误 */
export async function unwrap<T>(promise: Promise<{ data: ApiResult<T> }>): Promise<T> {
  const res = await promise
  if (res.data.code !== 0) throw new Error(res.data.message || '请求失败')
  return res.data.data
}

/** 提取可展示的错误信息（网络错误 / 业务错误 / HTTP 错误） */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const api = err.response?.data as ApiResult<unknown> | undefined
    if (api?.message) return api.message
    if (err.code === 'ERR_NETWORK') return '网络异常，请检查后端服务'
  }
  return err instanceof Error ? err.message : '未知错误'
}

export default http
