import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, KeyRound, Plus, Trash2, Webhook } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/utils'
import { openApi } from '@/api/open'
import type { ApiKeyView, WebhookView } from '@/types/api'

/**
 * 开放平台管理：API Key（机器人调用凭证）+ Webhook（消息事件回调）。
 * 用法：请求头 X-Api-Key: <key> 调 GET /api/open/me、GET/POST /api/open/messages。
 */
export default function OpenPlatformDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'keys' | 'webhooks'>('keys')
  const [keys, setKeys] = useState<ApiKeyView[]>([])
  const [hooks, setHooks] = useState<WebhookView[]>([])
  const [keyName, setKeyName] = useState('')
  const [hookUrl, setHookUrl] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void reload()
  }, [open])

  async function reload() {
    try {
      const [k, h] = await Promise.all([openApi.listKeys(), openApi.listWebhooks()])
      setKeys(k)
      setHooks(h)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function createKey() {
    if (!keyName.trim() || busy) return
    setBusy(true)
    try {
      await openApi.createKey(keyName.trim())
      setKeyName('')
      await reload()
      toast.success('Key 已创建，请立即复制保存')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function createHook() {
    if (!hookUrl.trim() || busy) return
    setBusy(true)
    try {
      await openApi.createWebhook(hookUrl.trim())
      setHookUrl('')
      await reload()
      toast.success('Webhook 已注册')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="开放平台" className="max-w-lg">
      {/* Tab */}
      <div className="mb-3 flex gap-2">
        {(
          [
            { key: 'keys', icon: KeyRound, label: 'API Key' },
            { key: 'webhooks', icon: Webhook, label: 'Webhook' }
          ] as const
        ).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              tab === key ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'keys' ? (
        <>
          <p className="mb-2 rounded bg-muted/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
            调用开放 API 时携带请求头 <code className="font-mono">X-Api-Key</code>：GET /api/open/me ·
            GET/POST /api/open/messages（读写你的会话消息，用于机器人接入）
          </p>
          <div className="mb-3 flex gap-2">
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void createKey()}
              placeholder="Key 名称（如：我的机器人）"
              maxLength={32}
              className="min-w-0 flex-1 rounded-md bg-background px-2.5 py-1.5 text-sm outline-none ring-1 ring-border focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button size="sm" onClick={() => void createKey()} disabled={busy || !keyName.trim()}>
              <Plus className="mr-1 h-4 w-4" /> 创建
            </Button>
          </div>
          <div className="scrollbar-thin max-h-64 space-y-2 overflow-y-auto">
            {keys.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">还没有 API Key</p>}
            {keys.map((k) => (
              <div key={k.id} className="rounded-md border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{k.name}</span>
                  {k.revoked && <span className="rounded bg-red-500/10 px-1.5 text-[10px] text-red-500">已撤销</span>}
                  <span className="ml-auto text-[10px] text-muted-foreground">{k.createdAt?.slice(0, 10)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-[11px]">
                    {k.apiKey}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="复制"
                    onClick={() => {
                      void navigator.clipboard.writeText(k.apiKey)
                      toast.success('已复制')
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {!k.revoked && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500"
                      title="撤销"
                      onClick={() => {
                        void openApi
                          .revokeKey(k.id)
                          .then(reload)
                          .catch((err) => toast.error(errorMessage(err)))
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 rounded bg-muted/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
            注册回调地址后，你单聊收到的消息会 POST 推送（HEADER <code className="font-mono">
            X-WeTalk-Signature</code> 为 HMAC-SHA256 签名，密钥见下方，用于校验来源）；群消息不推送
          </p>
          <div className="mb-3 flex gap-2">
            <input
              value={hookUrl}
              onChange={(e) => setHookUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void createHook()}
              placeholder="https://your-server/wetalk/hook"
              maxLength={512}
              className="min-w-0 flex-1 rounded-md bg-background px-2.5 py-1.5 text-sm outline-none ring-1 ring-border focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button size="sm" onClick={() => void createHook()} disabled={busy || !hookUrl.trim()}>
              <Plus className="mr-1 h-4 w-4" /> 注册
            </Button>
          </div>
          <div className="scrollbar-thin max-h-64 space-y-2 overflow-y-auto">
            {hooks.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">还没有 Webhook</p>}
            {hooks.map((h) => (
              <div key={h.id} className="rounded-md border p-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs">{h.url}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500"
                    title="删除"
                    onClick={() => {
                      void openApi
                        .deleteWebhook(h.id)
                        .then(reload)
                        .catch((err) => toast.error(errorMessage(err)))
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <code className="mt-1.5 block truncate rounded bg-muted px-2 py-1 font-mono text-[11px]">
                  secret: {h.secret}
                </code>
              </div>
            ))}
          </div>
        </>
      )}
    </Dialog>
  )
}
