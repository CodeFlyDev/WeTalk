import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, Download, FileText, Forward, Loader2, Pause, Pin, PinOff, Play, Reply, Undo2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { cn, errorMessage, formatTime } from '@/lib/utils'
import { getFileUrl } from '@/api/files'
import { messageApi } from '@/api/messages'
import { aiApi } from '@/api/ai'
import RedPacketCard from './RedPacketCard'
import ForwardDialog from './ForwardDialog'
import type { LocalMessage, Conversation } from '@/store/chat'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import type { MessageView } from '@/types/api'

/** 撤回可操作窗口：与后端 RECALL_WINDOW 对齐 */
const RECALL_WINDOW_MS = 2 * 60 * 1000

export default function MessageItem({
  message: m,
  isSelf,
  showSender,
  conversation
}: {
  message: LocalMessage
  isSelf: boolean
  showSender: boolean
  conversation: Conversation
}) {
  const senderName = useSenderName(m.senderId, conversation)
  const selfId = useAuthStore((s) => s.user?.id)
  const setReplyTo = useChatStore((s) => s.setReplyTo)
  const recallMessage = useChatStore((s) => s.recallMessage)
  const togglePin = useChatStore((s) => s.togglePin)
  const [hovered, setHovered] = useState(false)
  const [forwardOpen, setForwardOpen] = useState(false)

  // 已撤回：占位展示，不再渲染气泡
  if (m.recalled || m.type === 'RECALL') {
    return (
      <div className={cn('flex gap-2', isSelf ? 'justify-end' : 'justify-start')}>
        {!isSelf && <Avatar name={senderName} size={32} />}
        <div className="flex flex-col items-start">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs italic text-muted-foreground">
            {senderName} 撤回了一条消息
          </span>
        </div>
        {isSelf && <Avatar name="我" size={32} />}
      </div>
    )
  }

  const canRecall =
    isSelf && !m.pending && !m.failed && Date.now() - new Date(m.createdAt).getTime() < RECALL_WINDOW_MS

  return (
    <div
      className={cn('group relative flex gap-2', isSelf ? 'justify-end' : 'justify-start')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!isSelf && <Avatar name={senderName} size={32} />}
      <div className={cn('max-w-[68%] flex flex-col', isSelf ? 'items-end' : 'items-start')}>
        {showSender && !isSelf && (
          <span className="mb-0.5 px-1 text-[11px] text-muted-foreground">{senderName}</span>
        )}
        <div
          className={cn(
            'rounded-2xl px-3 py-1.5 text-sm leading-relaxed break-words',
            isSelf
              ? 'rounded-br-sm bg-bubble-self'
              : 'rounded-bl-sm bg-bubble-other text-foreground',
            mentionedMe(m, selfId) && 'ring-1 ring-amber-400/60'
          )}
        >
          <ReplyQuote replyToId={m.replyToId} conversation={conversation} />
          <MessageBody message={m} conversation={conversation} />
        </div>
        <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          {isSelf && <SendStatus message={m} />}
          {m.pinned && <Pin className="h-3 w-3 text-amber-500" />}
          <span>{formatTime(m.createdAt)}</span>
        </div>
      </div>
      {isSelf && <Avatar name="我" size={32} />}

      {/* 悬停操作：回复 / 置顶 / 转发 / 撤回 */}
      {hovered && (
        <div
          className={cn(
            'absolute top-0 z-10 flex items-center gap-0.5 rounded-full border bg-popover p-0.5 shadow-sm',
            isSelf ? 'right-full mr-2' : 'left-full ml-2'
          )}
        >
          <button
            title="回复"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setReplyTo(m)}
          >
            <Reply className="h-3.5 w-3.5" />
          </button>
          {(m.pinned || (!m.pending && !m.failed)) && (
            <button
              title={m.pinned ? '取消置顶' : '置顶'}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => void togglePin(m)}
            >
              {m.pinned ? <PinOff className="h-3.5 w-3.5 text-amber-500" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          )}
          {!m.pending && !m.failed && (
            <button
              title="转发"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setForwardOpen(true)}
            >
              <Forward className="h-3.5 w-3.5" />
            </button>
          )}
          {canRecall && (
            <button
              title="撤回"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => void recallMessage(m.id, m.conversationId)}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <ForwardDialog
        message={m}
        open={forwardOpen}
        onClose={() => setForwardOpen(false)}
      />
    </div>
  )
}

/* ---------- 名称解析 ---------- */

function useSenderName(senderId: number, conversation: Conversation): string {
  const friend = useChatStore((s) => s.friendById[senderId])
  const groups = useChatStore((s) => s.groups)
  const self = useAuthStore((s) => s.user)
  if (senderId === self?.id) return '我'
  if (conversation.type === 'group' && conversation.groupId != null) {
    const member = groups
      .find((g) => g.id === conversation.groupId)
      ?.members?.find((mm) => mm.userId === senderId)
    if (member) return member.nickname || member.username
  }
  return friend?.nickname || friend?.username || `用户 ${senderId}`
}

/** 群成员名集合（含自己），用于 @ 高亮匹配 */
function useMemberNames(conversation: Conversation): string[] {
  const groups = useChatStore((s) => s.groups)
  const self = useAuthStore((s) => s.user)
  if (conversation.type !== 'group' || conversation.groupId == null) return []
  const group = groups.find((g) => g.id === conversation.groupId)
  const names: string[] = []
  if (self) names.push(self.nickname || self.username)
  for (const mm of group?.members ?? []) names.push(mm.nickname || mm.username)
  return [...new Set(names.filter(Boolean))]
}

/** @ 提及是否命中当前登录用户 */
function mentionedMe(m: MessageView, selfId: number | undefined): boolean {
  return selfId != null && !!m.mentionedUserIds?.includes(selfId)
}

/* ---------- 引用回复 ---------- */

function ReplyQuote({
  replyToId,
  conversation
}: {
  replyToId: string | null
  conversation: Conversation
}) {
  const cached = useChatStore((s) =>
    replyToId ? s.messages[conversation.id]?.find((mm) => mm.id === replyToId) : undefined
  )
  const friendById = useChatStore((s) => s.friendById)
  const [fetched, setFetched] = useState<MessageView | null>(null)
  const [missed, setMissed] = useState(false)

  useEffect(() => {
    if (!replyToId || cached) return
    let cancelled = false
    messageApi
      .getById(replyToId)
      .then((v) => !cancelled && setFetched(v))
      .catch(() => !cancelled && setMissed(true))
    return () => {
      cancelled = true
    }
  }, [replyToId, cached])

  if (!replyToId) return null
  const origin = cached ?? fetched
  const senderName = origin
    ? friendById[origin.senderId]?.nickname ||
      friendById[origin.senderId]?.username ||
      `用户 ${origin.senderId}`
    : ''

  return (
    <div className="mb-1 rounded-md border-l-2 border-primary/50 bg-background/50 px-2 py-1 text-xs text-muted-foreground">
      {origin ? (
        <>
          <span className="font-medium text-foreground">{senderName}</span>
          <span className="mx-1">:</span>
          <span className="line-clamp-1">{previewOf(origin)}</span>
        </>
      ) : missed ? (
        <span className="italic">原消息不可见</span>
      ) : (
        <span className="italic">加载引用内容…</span>
      )}
    </div>
  )
}

/** 会话列表 / 引用条 / 通知共用的消息摘要 */
export function previewOf(m: MessageView): string {
  switch (m.type) {
    case 'IMAGE':
      return '[图片]'
    case 'FILE':
      return `[文件] ${m.content}`
    case 'VOICE':
      return '[语音]'
    case 'VIDEO':
      return '[视频]'
    case 'RED_PACKET':
      return '[红包]'
    case 'EMOJI':
      return m.content
    default:
      return m.content
  }
}

/* ---------- 气泡主体 ---------- */

function SendStatus({ message }: { message: LocalMessage }) {
  if (message.pending) return <Loader2 className="h-3 w-3 animate-spin" />
  if (message.failed) return <X className="h-3 w-3 text-red-500" />
  return <Check className="h-3 w-3 text-emerald-500" />
}

function MessageBody({ message: m, conversation }: { message: LocalMessage; conversation: Conversation }) {
  const memberNames = useMemberNames(conversation)
  if (m.type === 'IMAGE' && m.refObjectKey) {
    return <ImageMessage objectKey={m.refObjectKey} alt={m.content} />
  }
  if (m.type === 'VOICE' && m.refObjectKey) {
    return <VoiceMessage objectKey={m.refObjectKey} seconds={Number(m.content) || 0} messageId={m.id} />
  }
  if (m.type === 'VIDEO' && m.refObjectKey) {
    return <VideoMessage objectKey={m.refObjectKey} seconds={Number(m.content) || 0} />
  }
  if (m.type === 'FILE' && m.refObjectKey) {
    return <FileMessage name={m.content} objectKey={m.refObjectKey} />
  }
  if (m.type === 'RED_PACKET' && m.content) {
    return <RedPacketCard redPacketId={m.content} />
  }
  return <TextWithMentions content={m.content} names={memberNames} />
}

/** 视频消息：content 存时长秒数，<video> 内联播放 */
function VideoMessage({ objectKey, seconds }: { objectKey: string; seconds: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    void getFileUrl(objectKey).then(setUrl).catch(() => setUrl(null))
  }, [objectKey])

  if (!url) {
    return (
      <div className="flex h-40 w-56 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
        <Loader2 className="mr-1 h-4 w-4 animate-spin" /> 视频加载中…
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg">
      <video src={url} controls preload="metadata" className="max-h-64 max-w-xs rounded-lg bg-black" />
      {seconds > 0 && <p className="mt-0.5 text-[10px] text-muted-foreground">时长 {seconds}&Prime;</p>}
    </div>
  )
}

/** 语音消息：点击播放/暂停 + 「转文字」，content 存时长秒数 */
function VoiceMessage({ objectKey, seconds, messageId }: { objectKey: string; seconds: number; messageId: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    void getFileUrl(objectKey).then(setUrl).catch(() => setUrl(null))
  }, [objectKey])

  function toggle() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      void audio.play()
    }
  }

  async function transcribe() {
    if (transcribing || transcript !== null) return
    setTranscribing(true)
    try {
      setTranscript(await aiApi.transcribe(messageId))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div className="flex min-w-32 flex-wrap items-center gap-2 py-0.5">
      <button
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
        onClick={toggle}
        disabled={!url}
        title={playing ? '暂停' : '播放'}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      {/* 假波形：按时长成比例 */}
      <div className="flex h-5 flex-1 items-center gap-[2px]">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'w-[2px] rounded-full',
              playing ? 'bg-primary/70' : 'bg-muted-foreground/40'
            )}
            style={{ height: `${6 + ((i * 7 + seconds * 3) % 12)}px` }}
          />
        ))}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{seconds}&Prime;</span>
      <button
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title={transcript !== null ? '已转写' : '转文字'}
        onClick={() => void transcribe()}
        disabled={transcribing}
      >
        {transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      </button>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          hidden
        />
      )}
      {transcript !== null && transcript !== '' && (
        <p className="w-full rounded-md bg-muted/60 px-2 py-1 text-xs leading-relaxed text-muted-foreground">
          {transcript}
        </p>
      )}
    </div>
  )
}

/** 文本渲染：@成员名 高亮 */
function TextWithMentions({ content, names }: { content: string; names: string[] }) {
  const selfName = useAuthStore((s) => s.user)
  if (!content.includes('@') || names.length === 0) {
    return <span className="whitespace-pre-wrap">{content}</span>
  }
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`@(${escaped.join('|')})(?=\\s|$)`, 'g')
  const myName = selfName?.nickname || selfName?.username

  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of content.matchAll(regex)) {
    const start = match.index ?? 0
    if (start > last) parts.push(content.slice(last, start))
    const isMe = match[1] === myName
    parts.push(
      <span
        key={start}
        className={cn('font-medium', isMe ? 'rounded bg-amber-400/30 px-0.5 text-amber-600 dark:text-amber-400' : 'text-primary')}
      >
        {match[0]}
      </span>
    )
    last = start + match[0].length
  }
  if (last < content.length) parts.push(content.slice(last))
  return <span className="whitespace-pre-wrap">{parts}</span>
}

function ImageMessage({ objectKey, alt }: { objectKey: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    void getFileUrl(objectKey).then(setUrl).catch(() => setUrl(null))
  }, [objectKey])

  if (!url) {
    return (
      <div className="flex h-32 w-48 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
        图片加载中…
      </div>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className="max-h-64 max-w-xs rounded-lg object-cover"
      />
    </a>
  )
}

function FileMessage({ name, objectKey }: { name: string; objectKey: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    void getFileUrl(objectKey).then(setUrl).catch(() => setUrl(null))
  }, [objectKey])

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2 transition-colors hover:bg-background"
      onClick={(e) => !url && e.preventDefault()}
    >
      <FileText className="h-5 w-5 shrink-0 text-primary" />
      <span className="max-w-40 truncate text-xs">{name}</span>
      <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
    </a>
  )
}
