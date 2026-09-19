import { http, unwrap } from './client'
import type { GroupFileView, MessageView, SendResult, SendMessageRequest } from '@/types/api'

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
  },
  /** 置顶 / 取消置顶 */
  pin(id: string, pinned: boolean) {
    return pinned
      ? unwrap<MessageView>(http.post(`/messages/${id}/pin`))
      : unwrap<MessageView>(http.delete(`/messages/${id}/pin`))
  },
  /** 会话置顶消息列表 */
  pinned(conversationId: string) {
    return unwrap<MessageView[]>(http.get('/messages/pinned', { params: { conversationId } }))
  },
  /** 转发消息到多个目标会话 */
  forward(id: string, targets: { type: 'dm' | 'group'; targetId: number }[]) {
    return unwrap<SendResult[]>(http.post(`/messages/${id}/forward`, { targets }))
  },
  /** 阅后即焚：接收方阅读后触发焚毁 */
  burn(id: string) {
    return unwrap<MessageView>(http.post(`/messages/${id}/burn`))
  },
  /** 白板历史全量回放（笔画 JSON 列表） */
  whiteboard(conversationId: string) {
    return unwrap<string[]>(http.get('/messages/whiteboard', { params: { conversationId } }))
  },
  /** 定时发送 */
  schedule(body: { receiverId?: number | null; groupId?: number | null; content: string; sendAt: string }) {
    return unwrap<ScheduledView>(http.post('/messages/schedule', body))
  },
  scheduledList() {
    return unwrap<ScheduledView[]>(http.get('/messages/schedule'))
  },
  cancelScheduled(id: number) {
    return unwrap<void>(http.delete(`/messages/schedule/${id}`))
  },
  /** 群文件：聚合群会话内 type=FILE 消息 */
  groupFiles(groupId: number) {
    return unwrap<GroupFileView[]>(http.get('/messages/group-files', { params: { groupId } }))
  }
}

/** 定时消息视图（对齐 wetalk-message ScheduledView） */
export interface ScheduledView {
  id: number
  senderId: number
  receiverId: number | null
  groupId: number | null
  content: string
  sendAt: string
  status: string
  failReason: string | null
}
