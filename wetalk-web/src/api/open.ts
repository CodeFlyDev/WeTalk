import { http, unwrap } from './client'
import type { ApiKeyView, WebhookView } from '@/types/api'

/** 开放平台（Phase 7）：API Key 管理 + Webhook 管理（均 JWT 身份） */
export const openApi = {
  createKey: (name: string) =>
    unwrap<ApiKeyView>(http.post('/open/keys', { name })),
  listKeys: () => unwrap<ApiKeyView[]>(http.get('/open/keys')),
  revokeKey: (id: number) => unwrap<void>(http.delete(`/open/keys/${id}`)),
  createWebhook: (url: string) =>
    unwrap<WebhookView>(http.post('/open/webhooks', { url })),
  listWebhooks: () => unwrap<WebhookView[]>(http.get('/open/webhooks')),
  deleteWebhook: (id: number) => unwrap<void>(http.delete(`/open/webhooks/${id}`))
}
