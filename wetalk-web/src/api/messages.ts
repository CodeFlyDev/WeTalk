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
  }
}
