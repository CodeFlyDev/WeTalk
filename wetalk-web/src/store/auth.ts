import { create } from 'zustand'
import { authApi } from '@/api/auth'
import { readTokens, writeTokens, type StoredTokens } from '@/api/client'
import type { TokenResponse, UserView } from '@/types/api'

interface AuthState {
  user: UserView | null
  accessToken: string | null
  /** 已从 localStorage 恢复登录态（用于路由守卫首次判断） */
  bootstrapped: boolean
  bootstrap: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, nickname: string) => Promise<void>
  logout: () => void
  /** 本地更新用户信息（如换头像后同步持久化） */
  setUser: (user: UserView) => void
  /** 供 socket 握手使用 */
  currentAccessToken: () => string | null
}

function persist(res: TokenResponse) {
  const tokens: StoredTokens = {
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
    user: res.user
  }
  writeTokens(tokens)
  return tokens
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  bootstrapped: false,

  bootstrap: async () => {
    const stored = readTokens()
    if (!stored) {
      set({ bootstrapped: true })
      return
    }
    set({ user: stored.user, accessToken: stored.accessToken })
    try {
      // 校验 token 并刷新用户信息；失败由 401 拦截器清登录态
      const me = await authApi.me()
      set({ user: me })
    } catch {
      // 保留本地用户信息，进入页面后由拦截器处理过期
    } finally {
      set({ bootstrapped: true })
    }
  },

  login: async (username, password) => {
    const res = await authApi.login({ username, password })
    persist(res)
    set({ user: res.user, accessToken: res.accessToken })
  },

  register: async (username, password, nickname) => {
    const res = await authApi.register({ username, password, nickname })
    persist(res)
    set({ user: res.user, accessToken: res.accessToken })
  },

  logout: () => {
    writeTokens(null)
    set({ user: null, accessToken: null })
  },

  setUser: (user) => {
    const stored = readTokens()
    if (stored) {
      writeTokens({ ...stored, user })
    }
    set({ user })
  },

  currentAccessToken: () => get().accessToken ?? readTokens()?.accessToken ?? null
}))
