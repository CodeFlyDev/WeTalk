import { http, unwrap } from './client'
import type { UserView } from '@/types/api'

export const userApi = {
  byId(id: number) {
    return unwrap<UserView>(http.get(`/users/${id}`))
  },
  /** 用户搜索：用户名 / 昵称模糊匹配，最多 10 条 */
  search(keyword: string) {
    return unwrap<UserView[]>(http.get('/users/search', { params: { keyword } }))
  },
  /** 注册 / 更新本人 E2EE 公钥（幂等） */
  putE2eeKey(publicKey: string) {
    return unwrap<void>(http.put('/users/e2ee-key', { publicKey }))
  },
  /** 查询对方 E2EE 公钥（未注册返回 null） */
  getE2eeKey(userId: number) {
    return unwrap<string | null>(http.get(`/users/${userId}/e2ee-key`))
  },
  /** 更新我的头像（objectKey 来自 presign 直传） */
  updateAvatar(objectKey: string) {
    return unwrap<UserView>(http.put('/users/me/avatar', { objectKey }))
  }
}
