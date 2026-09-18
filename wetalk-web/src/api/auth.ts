import { http, unwrap } from './client'
import type { TokenResponse, UserView } from '@/types/api'

export const authApi = {
  register(body: { username: string; password: string; nickname: string }) {
    return unwrap<TokenResponse>(http.post('/auth/register', body))
  },
  login(body: { username: string; password: string }) {
    return unwrap<TokenResponse>(http.post('/auth/login', body))
  },
  refresh(refreshToken: string) {
    return unwrap<TokenResponse>(http.post('/auth/refresh', { refreshToken }))
  },
  me() {
    return unwrap<UserView>(http.get('/auth/me'))
  }
}
