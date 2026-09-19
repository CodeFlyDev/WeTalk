import { useEffect, useState } from 'react'
import { Phone, Search, Video } from 'lucide-react'
import Sidebar from '@/components/chat/Sidebar'
import MessageList from '@/components/chat/MessageList'
import ChatInput from '@/components/chat/ChatInput'
import SearchPanel from '@/components/chat/SearchPanel'
import CallOverlay from '@/components/call/CallOverlay'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { useCallStore } from '@/webrtc/call'
import { socket, type WsStatus } from '@/ws/socket'

/** 主框架：左侧会话列表 + 右侧聊天区 */
export default function ChatPage() {
  const init = useChatStore((s) => s.init)
  const initialized = useChatStore((s) => s.initialized)
  const handleIncoming = useChatStore((s) => s.handleIncoming)
  const handleNotify = useChatStore((s) => s.handleNotify)
  const activeId = useChatStore((s) => s.activeId)
  const conversations = useChatStore((s) => s.conversations)
  const startCall = useCallStore((s) => s.startCall)
  const startMeeting = useCallStore((s) => s.startMeeting)
  const [wsStatus, setWsStatus] = useState<WsStatus>(socket.status)
  const [searchOpen, setSearchOpen] = useState(false)

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
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="在会话中查找"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
                {active.type === 'dm' && active.peerId != null && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="语音通话"
                      onClick={() => void startCall(active.peerId!, active.name, 'AUDIO')}
                    >
                      <Phone className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="视频通话"
                      onClick={() => void startCall(active.peerId!, active.name, 'VIDEO')}
                    >
                      <Video className="h-5 w-5" />
                    </Button>
                  </>
                )}
                {active.type === 'group' && active.groupId != null && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="群会议"
                    onClick={() => void startMeeting(active.groupId!, active.name, 'VIDEO')}
                  >
                    <Video className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </header>
            {searchOpen && (
              <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} conversation={active} />
            )}
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
      {/* 通话浮层：来电弹窗 / 通话中面板（任意会话可接听） */}
      <CallOverlay />
    </div>
  )
}
