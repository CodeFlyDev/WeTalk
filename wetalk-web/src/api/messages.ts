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
  /** 按 ID 查询单条消息（引用条回显） */
  getById(id: string) {
    return unwrap<MessageView>(http.get(`/messages/${id}`))
  },
  /** 撤回自己发送的消息（2 分钟内） */
  recall(id: string) {
    return unwrap<MessageView>(http.post(`/messages/${id}/recall`))
  }
}
