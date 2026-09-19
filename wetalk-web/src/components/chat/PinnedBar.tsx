import { useEffect, useState } from 'react'
import { Pin, X } from 'lucide-react'
import { messageApi } from '@/api/messages'
import { previewOf } from './MessageItem'
import { useChatStore, type Conversation } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import type { MessageView } from '@/types/api'

/** 置顶条：展示会话置顶消息（最新一条 + 数量，可展开全部并取消置顶） */
export default function PinnedBar({ conversation }: { conversation: Conversation }) {
  const [pinned, setPinned] = useState<MessageView[]>([])
  const [expanded, setExpanded] = useState(false)
  const togglePin = useChatStore((s) => s.togglePin)
  const friendById = useChatStore((s) => s.friendById)
  const selfId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    setExpanded(false)
    let cancelled = false
    messageApi
      .pinned(conversation.id)
      .then((list) => !cancelled && setPinned(list))
      .catch(() => !cancelled && setPinned([]))
    return () => {
      cancelled = true
    }
  }, [conversation.id])

  if (pinned.length === 0) return null

  const latest = pinned[0]

  return (
    <div className="shrink-0 border-b bg-amber-50/60 px-4 py-1.5 dark:bg-amber-950/20">
      <div className="flex items-center gap-2">
        <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <button
          className="min-w-0 flex-1 text-left text-xs text-muted-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="line-clamp-1">{previewOf(latest)}</span>
        </button>
        {pinned.length > 1 && (
          <button
            className="shrink-0 text-xs text-amber-600 hover:underline dark:text-amber-400"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '收起' : `共 ${pinned.length} 条`}
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-1 space-y-1 border-t border-amber-200/60 pt-1 dark:border-amber-800/40">
          {pinned.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-xs">
              <span className="line-clamp-1 flex-1 text-muted-foreground">
                {senderNameOf(m, friendById, selfId)}：{previewOf(m)}
              </span>
              <button
                title="取消置顶"
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => {
                  void togglePin(m)
                  setPinned((list) => list.filter((p) => p.id !== m.id))
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function senderNameOf(
  m: MessageView,
  friendById: Record<number, { nickname: string; username: string }>,
  selfId: number | undefined
) {
  if (m.senderId === selfId) return '我'
  const f = friendById[m.senderId]
  return f ? f.nickname || f.username : `用户 ${m.senderId}`
}
