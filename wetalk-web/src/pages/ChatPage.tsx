import { useEffect, useState } from 'react'
import Sidebar from '@/components/chat/Sidebar'
import MessageList from '@/components/chat/MessageList'
import ChatInput from '@/components/chat/ChatInput'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { socket, type WsStatus } from '@/ws/socket'

/** 主框架：左侧会话列表 + 右侧聊天区 */
export default function ChatPage() {
  const init = useChatStore((s) => s.init)
  const initialized = useChatStore((s) => s.initialized)
  const handleIncoming = useChatStore((s) => s.handleIncoming)
  const handleNotify = useChatStore((s) => s.handleNotify)
  const activeId = useChatStore((s) => s.activeId)
  const conversations = useChatStore((s) => s.conversations)
  const [wsStatus, setWsStatus] = useState<WsStatus>(socket.status)

  useEffect(() => {
    void init()
    // WS 接线：登录后建立连接，回调解绑由 disconnect 前置换
    socket.onMessage = handleIncoming
    socket.onNotify = handleNotify
    socket.onStatusChange = setWsStatus
    const token = useAuthStore.getState().currentAccessToken()
    if (token) socket.connect(token)
    return () => socket.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = conversations.find((c) => c.id === activeId) ?? null

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar wsStatus={wsStatus} />
      <main className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <header className="flex h-14 shrink-0 items-center border-b bg-card px-4">
              <h1 className="truncate text-sm font-semibold">{active.name}</h1>
              <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {active.type === 'group' ? '群聊' : '单聊'}
              </span>
            </header>
            {initialized && (
              <>
                <MessageList conversation={active} />
                <ChatInput conversation={active} />
              </>
            )}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <p className="text-4xl">💬</p>
            <p className="text-sm">选择一个会话开始聊天</p>
            {!initialized && <p className="text-xs">加载中…</p>}
          </div>
        )}
      </main>
    </div>
  )
}
