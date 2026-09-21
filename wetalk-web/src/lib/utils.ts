import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 从 client.ts 转发导出，方便组件统一从 @/lib/utils 引入 */
export { errorMessage } from '@/api/client'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 新消息 clientMsgId（后端幂等去重键） */
export function newClientMsgId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** createdAt（LocalDateTime ISO，无时区）→ 本地时间显示 */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return hhmm
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  if (isYesterday) return `昨天 ${hhmm}`
  const md = `${d.getMonth() + 1}/${d.getDate()}`
  if (d.getFullYear() === now.getFullYear()) return `${md} ${hhmm}`
  return `${d.getFullYear()}/${md} ${hhmm}`
}

/** 会话 ID 规则（对齐后端 ConversationIds）：dm:{minUserId}:{maxUserId} / g:{groupId} */
export const ConversationIds = {
  dm: (a: number, b: number) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`,
  group: (groupId: number) => `g:${groupId}`
}

export function isGroupConversation(conversationId: string) {
  return conversationId.startsWith('g:')
}
