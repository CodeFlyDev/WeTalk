import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, Crown, Hash, Loader2, LogIn, LogOut, Plus, Send as SendIcon, Trash2
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { cn, errorMessage, formatTime } from '@/lib/utils'
import { socket } from '@/ws/socket'
import { useAuthStore } from '@/store/auth'
import { channelApi } from '@/api/channels'
import type { ChannelMessageView, ChannelView } from '@/types/api'

/**
 * 频道/社区：公开频道列表（加入/退出/创建/解散）+ 频道文字消息流。
 * 消息：REST 发送（同步上屏）+ /topic/channel.{id} 订阅他人消息。
 */
export default function ChannelsPage() {
  const navigate = useNavigate()
  const selfId = useAuthStore((s) => s.user!.id)
  const [channels, setChannels] = useState<ChannelView[] | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChannelMessageView[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const active = channels?.find((c) => c.id === activeId) ?? null

  async function refresh() {
    try {
      setChannels(await channelApi.list())
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  // 切换频道：退订旧 topic → 拉历史 → 订阅新 topic
  useEffect(() => {
    if (activeId == null) return
    let cancelled = false
    setMessages([])
    channelApi
      .history(activeId)
      .then((list) => {
        if (!cancelled) setMessages(list)
      })
      .catch((err) => {
        if (!cancelled) toast.error(errorMessage(err))
      })
    socket.subscribeChannel(activeId)
    return () => {
      cancelled = true
      socket.unsubscribeChannel(activeId)
    }
  }, [activeId])

  // 实时消息：他人消息追加（自己消息 REST 已上屏，按 senderId 去重）
  useEffect(() => {
    socket.onChannelMessage = (view) => {
      if (view.channelId !== activeId) return
      if (view.senderId === selfId) return
      setMessages((prev) => [...prev, view])
    }
    return () => {
      socket.onChannelMessage = null
    }
  }, [activeId, selfId])

  // 滚动到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function onJoin(c: ChannelView) {
    try {
      await channelApi.join(c.id)
      await refresh()
      setActiveId(c.id)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function onQuit(c: ChannelView) {
    try {
      await channelApi.quit(c.id)
      await refresh()
      if (activeId === c.id) setActiveId(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function onDissolve(c: ChannelView) {
    if (!confirm(`确定解散频道「${c.name}」？`)) return
    try {
      await channelApi.dissolve(c.id)
      await refresh()
      if (activeId === c.id) setActiveId(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function onCreate() {
    if (!newName.trim() || sending) return
    setSending(true)
    try {
      const view = await channelApi.create(newName.trim(), newDesc.trim() || undefined)
      setNewName('')
      setNewDesc('')
      setCreateOpen(false)
      await refresh()
      setActiveId(view.id)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  async function onSend() {
    const text = draft.trim()
    if (!text || !active || sending) return
    setSending(true)
    try {
      const view = await channelApi.send(active.id, text)
      setMessages((prev) => [...prev, view])
      setDraft('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 顶栏 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-medium">频道 · 社区</h1>
        <span className="text-xs text-muted-foreground">公开频道 · 加入即聊 · 不存离线</span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 频道列表 */}
        <div className="scrollbar-thin w-80 shrink-0 overflow-y-auto border-r p-3">
          <Button className="mb-3 w-full" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> 创建频道
          </Button>
          {channels === null && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
            </p>
          )}
          {channels?.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">还没有频道，创建第一个吧</p>
          )}
          {channels?.map((c) => (
            <div
              key={c.id}
              className={cn(
                'mb-2 rounded-lg border p-3 transition-colors',
                activeId === c.id ? 'border-primary bg-primary/5' : ''
              )}
            >
              <button className="flex w-full items-center gap-2.5 text-left" onClick={() => setActiveId(c.id)}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Hash className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-medium">
                    {c.name}
                    {c.joined && <span className="text-[10px] text-emerald-500">已加入</span>}
                    {c.isOwner && <Crown className="h-3 w-3 text-amber-500" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.memberCount} 名成员 · {c.ownerName}
                  </p>
                </div>
              </button>
              {c.description && (
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              )}
              <div className="mt-2 flex gap-1.5">
                {!c.joined && (
                  <Button size="sm" className="flex-1" onClick={() => void onJoin(c)}>
                    <LogIn className="h-3.5 w-3.5" /> 加入
                  </Button>
                )}
                {c.joined && !c.isOwner && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => void onQuit(c)}>
                    <LogOut className="h-3.5 w-3.5" /> 退出
                  </Button>
                )}
                {c.isOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-red-500"
                    onClick={() => void onDissolve(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> 解散
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 消息区 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <Hash className="mr-2 h-5 w-5 opacity-40" />
              选择左侧频道进入（未加入的频道可先阅读，发言需加入）
            </div>
          ) : (
            <>
              <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-sm font-medium">
                <Hash className="h-4 w-4 text-primary" /> {active.name}
              </div>
              <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">还没有消息，来说点什么吧</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={cn('flex gap-2.5', m.senderId === selfId && 'flex-row-reverse')}>
                    <Avatar name={m.senderName} size={32} />
                    <div className={cn('max-w-[70%]', m.senderId === selfId && 'items-end text-right')}>
                      <p className="mb-0.5 text-[11px] text-muted-foreground">
                        {m.senderName} · {formatTime(m.createdAt)}
                      </p>
                      <div
                        className={cn(
                          'inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm leading-relaxed',
                          m.senderId === selfId
                            ? 'rounded-br-sm bg-bubble-self'
                            : 'rounded-bl-sm bg-bubble-other text-foreground'
                        )}
                      >
                        {m.content}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="flex shrink-0 items-center gap-2 border-t p-3">
                {active.joined ? (
                  <>
                    <input
                      value={draft}
                      maxLength={2000}
                      placeholder={`在 #${active.name} 发送消息…`}
                      className="flex-1 rounded-full border bg-transparent px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void onSend()}
                    />
                    <Button size="icon" onClick={() => void onSend()} disabled={sending || !draft.trim()}>
                      <SendIcon className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button className="mx-auto" onClick={() => void onJoin(active)}>
                    <LogIn className="h-4 w-4" /> 加入频道后发言
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="创建频道" className="max-w-sm">
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={newName}
            maxLength={20}
            placeholder="频道名（最多 20 字）"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            value={newDesc}
            maxLength={200}
            placeholder="频道简介（可选）"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          />
          <Button onClick={() => void onCreate()} disabled={sending || !newName.trim()}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />} 创建
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
