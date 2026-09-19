import http, { unwrap } from './client'
import type { MessageType } from '@/types/api'

/** 收藏视图（对齐 wetalk-message FavoriteView） */
export interface FavoriteView {
  id: number
  messageId: string
  conversationId: string
  senderId: number
  type: MessageType
  content: string | null
  refObjectKey: string | null
  createdAt: string
}

/** 消息收藏：收藏 / 取消 / 列表 */
export const favoriteApi = {
  /** 收藏一条自己可见的消息（幂等） */
  add(messageId: string) {
    return unwrap<FavoriteView>(http.post(`/favorites/${messageId}`))
  },

  /** 取消收藏（幂等） */
  remove(messageId: string) {
    return unwrap<void>(http.delete(`/favorites/${messageId}`))
  },

  /** 我的收藏列表（最新在前） */
  list() {
    return unwrap<FavoriteView[]>(http.get('/favorites'))
  }
}
