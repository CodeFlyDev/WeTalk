import { http, unwrap } from './client'
import type { MessageView, SendResult, SendMessageRequest } from '@/types/api'

export const messageApi = {
  send(body: SendMessageRequest) {
    return unwrap<SendResult>(http.post('/messages', body))
  },
  history(conversationId: string, before?: string, limit = 50) {
    return unwrap<MessageView[]>(
      http.get('/messages/history', {
        params: { conversationId, before, limit }
      })
    )
  },
  unread(conversationIds: string[]) {
    return unwrap<Record<string, number>>(
      http.get('/messages/unread', { params: { conversationIds: conversationIds.join(',') } })
    )
  },
  clearUnread(conversationId: string) {
    return unwrap<void>(http.post('/messages/unread/clear', null, { params: { conversationId } }))
  },
  /** 会话内全文检索（ES 索引，故障降级返回空列表） */
  search(conversationId: string, keyword: string, limit = 20) {
    return unwrap<MessageView[]>(
      http.get('/messages/search', { params: { conversationId, keyword, limit } })
    )
  },
  /** 全局检索与我相关的消息（我的单聊 + 我所在的群聊） */
  searchGlobal(keyword: string, limit = 20) {
    return unwrap<MessageView[]>(http.get('/messages/search/global', { params: { keyword, limit } }))
  },
  /** 按 ID 查询单条消息（引用条回显） */
  getById(id: string) {
    return unwrap<MessageView>(http.get(`/messages/${id}`))
  },
  /** 撤回自己发送的消息（2 分钟内） */
  recall(id: string) {
    return unwrap<MessageView>(http.post(`/messages/${id}/recall`))
  }
}
