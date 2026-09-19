import { useEffect, useRef, useState } from 'react'
import MessageItem from './MessageItem'
import type { Conversation } from '@/store/chat'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'

/** 消息流：进入会话滚到底部，向上滚动到顶加载更早历史 */
export default function MessageList({ conversation }: { conversation: Conversation }) {
  const messages = useChatStore((s) => s.messages[conversation.id])
  const loadingHistory = useChatStore((s) => s.loadingHistory)
  const loadMore = useChatStore((s) => s.loadMore)
  const selfId = useAuthStore((s) => s.user?.id ?? -1)

  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [atTop, setAtTop] = useState(false)
  const count = messages?.length ?? 0
  const prevCountRef = useRef(0)

  // 新消息 → 滚动到底
  useEffect(() => {
    if (count > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: prevCountRef.current === 0 ? 'auto' : 'smooth' })
    }
    prevCountRef.current = count
  }, [count])

  // 切换会话 → 立即滚到底
  useEffect(() => {
    prevCountRef.current = 0
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [conversation.id])

  function onScroll() {
    const el = containerRef.current
    if (!el) return
    setAtTop(el.scrollTop < 40)
    if (el.scrollTop < 40 && el.scrollHeight > el.clientHeight && !loadingHistory) {
      const prevHeight = el.scrollHeight
      void loadMore(conversation.id).then(() => {
        // 保持视口位置
        requestAnimationFrame(() => {
          const delta = (containerRef.current?.scrollHeight ?? prevHeight) - prevHeight
          if (delta > 0) containerRef.current!.scrollTop += delta
        })
      })
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3"
    >
      {atTop && loadingHistory && (
        <p className="mb-2 text-center text-xs text-muted-foreground">加载更早的消息…</p>
      )}
      {count === 0 && !loadingHistory && (
        <p className="mt-10 text-center text-xs text-muted-foreground">
          暂无消息，发送第一条打个招呼吧
        </p>
      )}
      <div className="space-y-1.5">
        {messages?.map((m) => (
          <MessageItem
            key={m.id}
            message={m}
            isSelf={m.senderId === selfId}
            showSender={conversation.type === 'group'}
            conversation={conversation}
          />
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  )
}
