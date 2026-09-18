import { http, unwrap } from './client'
import type { UserView } from '@/types/api'

export const userApi = {
  byId(id: number) {
    return unwrap<UserView>(http.get(`/users/${id}`))
  },
  /** 用户搜索：用户名 / 昵称模糊匹配，最多 10 条 */
  search(keyword: string) {
    return unwrap<UserView[]>(http.get('/users/search', { params: { keyword } }))
  }
}
