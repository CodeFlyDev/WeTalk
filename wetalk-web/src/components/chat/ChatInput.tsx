import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { FileUp, Image as ImageIcon, Smile, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmojiPicker } from './EmojiPicker'
import { previewOf } from './MessageItem'
import type { Conversation, SendOptions } from '@/store/chat'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'

/** 输入区：文本（Enter 发送 / Shift+Enter 换行）+ 表情面板 + 图片/文件发送 + 引用回复 + @ 提及 */
export default function ChatInput({ conversation }: { conversation: Conversation }) {
  const sendText = useChatStore((s) => s.sendText)
  const sendFile = useChatStore((s) => s.sendFile)
  const replyTo = useChatStore((s) => s.replyTo)
  const setReplyTo = useChatStore((s) => s.setReplyTo)
  const groups = useChatStore((s) => s.groups)
  const selfId = useAuthStore((s) => s.user?.id)
  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIds, setMentionIds] = useState<number[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const target = conversation.type === 'dm' ? { peerId: conversation.peerId } : { groupId: conversation.groupId }

  /** 群成员（排除自己），用于 @ 补全 */
  const members = useMemo(() => {
    if (conversation.type !== 'group' || conversation.groupId == null) return []
    const group = groups.find((g) => g.id === conversation.groupId)
    return (group?.members ?? []).filter((mm) => mm.userId !== selfId)
  }, [conversation.type, conversation.groupId, groups, selfId])

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return members
      .filter((mm) => !mentionIds.includes(mm.userId))
      .filter((mm) => (mm.nickname || mm.username).toLowerCase().includes(q))
      .slice(0, 8)
  }, [mentionQuery, members, mentionIds])

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionCandidates.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault()
      pickMention(mentionCandidates[0].userId, mentionCandidates[0].nickname || mentionCandidates[0].username)
      return
    }
    if (e.key === 'Escape' && mentionQuery !== null) {
      setMentionQuery(null)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  /** 光标前的 @token 检测：`@xxx` 触发补全 */
  function detectMention(value: string, caret: number) {
    if (conversation.type !== 'group') return
    const before = value.slice(0, caret)
    const match = before.match(/(^|\s)@([^\s@]*)$/)
    setMentionQuery(match ? match[2] : null)
  }

  function pickMention(userId: number, name: string) {
    const el = textareaRef.current
    const caret = el?.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/(^|\s)@([^\s@]*)$/, (_m, p1) => `${p1}@${name} `)
    const next = before + text.slice(caret)
    setText(next)
    setMentionIds((ids) => [...ids, userId])
    setMentionQuery(null)
    textareaRef.current?.focus()
  }

  async function submit() {
    const content = text.trim()
    if (!content) return
    const opts: SendOptions = {}
    if (replyTo) opts.replyToId = replyTo.id
    if (mentionIds.length > 0) opts.mentionedUserIds = mentionIds
    setText('')
    setMentionIds([])
    setMentionQuery(null)
    setEmojiOpen(false)
    setReplyTo(null)
    await sendText(target, content, opts)
  }

  function onPickFile(kind: 'IMAGE' | 'FILE') {
    const input = kind === 'IMAGE' ? imageInputRef.current : fileInputRef.current
    input?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, kind: 'IMAGE' | 'FILE') {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const opts: SendOptions = replyTo ? { replyToId: replyTo.id } : {}
    setReplyTo(null)
    await sendFile(target, file, kind, opts)
  }

  return (
    <div className="relative shrink-0 border-t bg-card">
      {/* 引用回复条 */}
      {replyTo && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-md border-l-2 border-primary/50 bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
          <span className="shrink-0 font-medium text-foreground">回复</span>
          <span className="line-clamp-1 flex-1">{previewOf(replyTo)}</span>
          <button
            className="rounded p-0.5 hover:bg-background"
            title="取消回复"
            onClick={() => setReplyTo(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {emojiOpen && (
        <div className="absolute bottom-full left-2 mb-2">
          <EmojiPicker
            onPick={(emoji) => setText((t) => t + emoji)}
            onClose={() => setEmojiOpen(false)}
          />
        </div>
      )}

      {/* @ 成员补全面板 */}
      {mentionCandidates.length > 0 && (
        <div className="absolute bottom-full left-2 mb-2 w-56 overflow-hidden rounded-lg border bg-popover shadow-md">
          {mentionCandidates.map((mm) => (
            <button
              key={mm.userId}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => pickMention(mm.userId, mm.nickname || mm.username)}
            >
              {mm.nickname || mm.username}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 px-3 pt-2">
        <Button variant="ghost" size="icon" title="表情" onClick={() => setEmojiOpen((v) => !v)}>
          <Smile className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" title="发送图片" onClick={() => onPickFile('IMAGE')}>
          <ImageIcon className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" title="发送文件" onClick={() => onPickFile('FILE')}>
          <FileUp className="h-5 w-5" />
        </Button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void handleFileChange(e, 'IMAGE')}
        />
        <input ref={fileInputRef} type="file" hidden onChange={(e) => void handleFileChange(e, 'FILE')} />
      </div>

      <div className="flex items-end gap-2 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            detectMention(e.target.value, e.target.selectionStart)
          }}
          onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
          onKeyDown={onKey}
          placeholder={
            conversation.type === 'group' ? '输入消息，@ 可提及成员，Enter 发送' : '输入消息，Enter 发送，Shift+Enter 换行'
          }
          rows={2}
          className="scrollbar-thin max-h-32 flex-1 resize-none rounded-md bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button size="lg" onClick={() => void submit()} disabled={!text.trim()}>
          发送
        </Button>
      </div>
    </div>
  )
}
