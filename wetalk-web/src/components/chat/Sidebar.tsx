import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, BarChart3, Hash, Images, LogOut, MessageSquare, Radio, Search, Users } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn, formatTime } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useChatStore, type Conversation } from '@/store/chat'
import ContactsPanel from '@/components/contacts/ContactsPanel'
import GlobalSearchDialog from '@/components/chat/GlobalSearchDialog'
import AvatarMakerDialog from '@/components/chat/AvatarMakerDialog'
import type { WsStatus } from '@/ws/socket'

type Tab = 'chats' | 'contacts'

const WS_LABEL: Record<WsStatus, string> = {
  open: '已连接',
  connecting: '连接中…',
  closed: '已断开'
}

export default function Sidebar({ wsStatus }: { wsStatus: WsStatus }) {
  const [tab, setTab] = useState<Tab>('chats')
  const [searchOpen, setSearchOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const conversations = useChatStore((s) => s.conversations)
  const unread = useChatStore((s) => s.unread)
  const activeId = useChatStore((s) => s.activeId)
  const openConversation = useChatStore((s) => s.openConversation)
  const navigate = useNavigate()

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)
  const pendingRequests = useChatStore((s) => s.friendRequests.length)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
      {/* 顶部用户栏 + 连接状态 */}
      <div className="flex h-14 items-center gap-2 border-b px-3">
        <button onClick={() => setAvatarOpen(true)} title="更换头像" className="shrink-0">
          <Avatar name={user?.nickname || user?.username || '?'} size={34} src={user?.avatarUrl} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.nickname || user?.username}</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                wsStatus === 'open' && 'bg-emerald-500',
                wsStatus === 'connecting' && 'bg-amber-500',
                wsStatus === 'closed' && 'bg-red-500'
              )}
            />
            {WS_LABEL[wsStatus]}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate('/voice')} title="语音房间">
          <Radio className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigate('/channels')} title="频道 · 社区">
          <Hash className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigate('/stats')} title="数据统计（管理员）">
          <BarChart3 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigate('/moments')} title="朋友圈">
          <Images className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="退出登录">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* 全局搜索入口 */}
      <button
        onClick={() => setSearchOpen(true)}
        className="mx-3 mt-3 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
      >
        <Search className="h-3.5 w-3.5" />
        搜索消息…
      </button>

      {/* Tab 切换 */}
      <div className="flex border-b">
        {(
          [
            { key: 'chats', icon: MessageSquare, label: '聊天', badge: totalUnread },
            { key: 'contacts', icon: Users, label: '通讯录', badge: pendingRequests }
          ] as const
        ).map(({ key, icon: Icon, label, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm transition-colors',
              tab === key
                ? 'border-b-2 border-primary font-medium text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {badge > 0 && (
              <span className="ml-0.5 min-w-4 rounded-full bg-red-500 px-1 text-[10px] leading-4 text-white">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 列表区 */}
      {tab === 'chats' ? (
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="p-6 text-center text-xs text-muted-foreground">
              还没有会话，去「通讯录」添加好友或建群吧
            </p>
          )}
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              active={c.id === activeId}
              unread={unread[c.id] ?? 0}
              onClick={() => void openConversation(c.id)}
            />
          ))}
        </div>
      ) : (
        <ContactsPanel />
      )}

      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AvatarMakerDialog open={avatarOpen} onClose={() => setAvatarOpen(false)} />
    </aside>
  )
}

function ConversationRow({
  conversation,
  active,
  unread,
  onClick
}: {
  conversation: Conversation
  active: boolean
  unread: number
  onClick: () => void
}) {
  const last = conversation.lastMessage
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent',
        active && 'bg-accent'
      )}
    >
      {conversation.type === 'ai' ? (
        <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </span>
      ) : (
        <Avatar name={conversation.name} size={38} src={conversation.avatarUrl} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium">{conversation.name}</p>
          {last && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatTime(last.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {last ? previewText(last) : '暂无消息'}
          </p>
          {unread > 0 && (
            <span className="shrink-0 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] leading-4 text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function previewText(msg: { type: string; content: string; recalled?: boolean; burned?: boolean }) {
  if (msg.type === 'RECALL' || msg.recalled) return '消息已撤回'
  if (msg.burned) return '🔥 消息已焚毁'
  if (msg.content?.startsWith('e2e:')) return '🔒 加密消息'
  if (msg.type === 'IMAGE') return '[图片]'
  if (msg.type === 'FILE') return `[文件] ${msg.content}`
  if (msg.type === 'VOICE') return '[语音]'
  if (msg.type === 'VIDEO') return '[视频]'
  if (msg.type === 'RED_PACKET') return '[红包]'
  if (msg.type === 'EMOJI') return '[表情包]'
  return msg.content
}
