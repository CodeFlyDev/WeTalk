import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { messageApi } from '@/api/messages'
import { errorMessage } from '@/api/client'
import { formatTime, isGroupConversation } from '@/lib/utils'
import type { Conversation, LocalMessage } from '@/store/chat'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import type { MessageView } from '@/types/api'

/** 全局搜索：检索与我相关（单聊 + 所在群聊）的消息，点击跳转会话 */
export default function GlobalSearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<LocalMessage[]>([])
  const [searched, setSearched] = useState('')
  const openConversation = useChatStore((s) => s.openConversation)

  useEffect(() => {
    if (!open) {
      setKeyword('')
      setResults([])
      setSearched('')
    }
  }, [open])

  async function doSearch() {
    const kw = keyword.trim()
    if (!kw) return
    setLoading(true)
    try {
      setResults(await messageApi.searchGlobal(kw, 20))
      setSearched(kw)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  /** 跳转会话：不存在时用消息信息本地补建 */
  function jumpTo(message: MessageView) {
    const store = useChatStore.getState()
    const selfId = useAuthStore.getState().user!.id
    if (!store.conversations.some((c) => c.id === message.conversationId)) {
      let conv: Conversation
      if (isGroupConversation(message.conversationId)) {
        const gid = message.groupId ?? Number(message.conversationId.slice(2))
        const g = store.groups.find((gg) => gg.id === gid)
        conv = { id: message.conversationId, type: 'group', groupId: gid, name: g?.name ?? '群聊' }
      } else {
        const peer = message.senderId === selfId ? message.receiverId! : message.senderId
        const f = store.friendById[peer]
        conv = {
          id: message.conversationId,
          type: 'dm',
          peerId: peer,
          name: f?.nickname || f?.username || `用户 ${peer}`,
          avatarUrl: f?.avatarUrl ?? null
        }
      }
      store.ensureConversation(conv)
    }
    void openConversation(message.conversationId)
    onClose()
  }

  function highlight(content: string): React.ReactNode {
    const kw = searched.trim()
    if (!kw) return content
    const idx = content.toLowerCase().indexOf(kw.toLowerCase())
    if (idx < 0) return content
    return (
      <>
        {content.slice(0, idx)}
        <mark className="rounded bg-amber-300/60 px-0.5 text-foreground dark:bg-amber-500/40">
          {content.slice(idx, idx + kw.length)}
        </mark>
        {content.slice(idx + kw.length)}
      </>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title="搜索消息" className="max-w-lg">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={keyword}
          placeholder="搜索与我相关的消息（单聊 + 群聊）"
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void doSearch()}
        />
        <button
          className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          onClick={() => void doSearch()}
          disabled={loading || !keyword.trim()}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          搜索
        </button>
      </div>

      <div className="mt-3 max-h-96 space-y-1 overflow-y-auto">
        {results.length === 0 && searched ? (
          <p className="py-6 text-center text-sm text-muted-foreground">没有找到包含「{searched}」的消息</p>
        ) : (
          results.map((m) => (
            <ResultItem key={m.id} message={m} keyword={searched} onJump={jumpTo} render={highlight} />
          ))
        )}
      </div>
    </Dialog>
  )
}

/** 单条结果：会话名 + 发送者 + 高亮内容 */
function ResultItem({
  message: m,
  keyword,
  onJump,
  render
}: {
  message: LocalMessage
  keyword: string
  onJump: (m: MessageView) => void
  render: (content: string) => React.ReactNode
}) {
  const conversations = useChatStore((s) => s.conversations)
  const friendById = useChatStore((s) => s.friendById)
  const groups = useChatStore((s) => s.groups)
  const selfId = useAuthStore((s) => s.user?.id)

  const conversation = conversations.find((c) => c.id === m.conversationId)
  let convName = conversation?.name
  if (!convName) {
    convName = isGroupConversation(m.conversationId) ? '群聊' : `用户 ${m.senderId === selfId ? m.receiverId : m.senderId}`
  }

  let senderName = ''
  if (m.senderId === selfId) {
    senderName = '我'
  } else if (friendById[m.senderId]) {
    senderName = friendById[m.senderId].nickname || friendById[m.senderId].username
  } else {
    const member = groups
      .find((g) => g.id === m.groupId)
      ?.members?.find((mm) => mm.userId === m.senderId)
    senderName = member ? member.nickname || member.username : `用户 ${m.senderId}`
  }

  return (
    <button
      className="flex w-full items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted"
      onClick={() => onJump(m)}
    >
      <Avatar name={convName} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-xs font-medium">{convName}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {senderName} · {formatTime(m.createdAt)}
          </span>
        </div>
        <p className="truncate text-sm text-muted-foreground">{keyword ? render(m.content) : m.content}</p>
      </div>
    </button>
  )
}
