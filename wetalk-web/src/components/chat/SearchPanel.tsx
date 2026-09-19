import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { messageApi } from '@/api/messages'
import { errorMessage, formatTime } from '@/lib/utils'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import type { Conversation, LocalMessage } from '@/store/chat'

/** 会话内全文搜索（ES）：输入关键词回车检索，按时间倒序展示 */
export default function SearchPanel({
  open,
  onClose,
  conversation
}: {
  open: boolean
  onClose: () => void
  conversation: Conversation
}) {
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<LocalMessage[]>([])
  const [searched, setSearched] = useState('')

  // 关闭时重置
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
      const list = await messageApi.search(conversation.id, kw, 20)
      setResults(list)
      setSearched(kw)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
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
    <Dialog open={open} onClose={onClose} title={`在「${conversation.name}」中查找`} className="max-w-lg">
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={keyword}
          placeholder="输入关键词，Enter 搜索"
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

      <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
        {results.length === 0 && searched ? (
          <p className="py-6 text-center text-sm text-muted-foreground">没有找到包含「{searched}」的消息</p>
        ) : (
          results.map((m) => <SearchResultItem key={m.id} message={m} highlightFn={highlight} />)
        )}
      </div>
    </Dialog>
  )
}

/** 单条搜索结果：发送者名称按会话类型解析 */
function SearchResultItem({
  message: m,
  highlightFn
}: {
  message: LocalMessage
  highlightFn: (content: string) => React.ReactNode
}) {
  const selfId = useAuthStore((s) => s.user?.id)
  const friendById = useChatStore((s) => s.friendById)
  const groups = useChatStore((s) => s.groups)

  let senderName: string
  if (m.senderId === selfId) {
    senderName = '我'
  } else if (friendById[m.senderId]) {
    senderName = friendById[m.senderId].nickname || friendById[m.senderId].username
  } else {
    const member = groups
      .flatMap((g) => g.members ?? [])
      .find((mm) => mm.userId === m.senderId)
    senderName = member ? member.nickname || member.username : `用户 ${m.senderId}`
  }

  return (
    <div className="flex items-start gap-2 rounded-md p-2 transition-colors hover:bg-muted">
      <Avatar name={senderName} size={28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium">{senderName}</span>
          <span className="text-[10px] text-muted-foreground">{formatTime(m.createdAt)}</span>
        </div>
        <p className="truncate text-sm text-muted-foreground">{highlightFn(m.content)}</p>
      </div>
    </div>
  )
}
