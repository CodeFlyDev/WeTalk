import { useEffect, useState } from 'react'
import { Check, Download, FileText, Loader2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { cn, formatTime } from '@/lib/utils'
import { getFileUrl } from '@/api/files'
import type { LocalMessage } from '@/store/chat'
import { useChatStore } from '@/store/chat'

export default function MessageItem({
  message: m,
  isSelf,
  showSender
}: {
  message: LocalMessage
  isSelf: boolean
  showSender: boolean
}) {
  const senderName = useChatStore((s) =>
    s.friendById[m.senderId]?.nickname || s.friendById[m.senderId]?.username
  )

  return (
    <div className={cn('flex gap-2', isSelf ? 'justify-end' : 'justify-start')}>
      {!isSelf && <Avatar name={senderName ?? `用户${m.senderId}`} size={32} />}
      <div className={cn('max-w-[68%] flex flex-col', isSelf ? 'items-end' : 'items-start')}>
        {showSender && !isSelf && (
          <span className="mb-0.5 px-1 text-[11px] text-muted-foreground">
            {senderName ?? `用户 ${m.senderId}`}
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl px-3 py-1.5 text-sm leading-relaxed break-words',
            isSelf
              ? 'rounded-br-sm bg-bubble-self'
              : 'rounded-bl-sm bg-bubble-other text-foreground'
          )}
        >
          <MessageBody message={m} />
        </div>
        <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
          {isSelf && <SendStatus message={m} />}
          <span>{formatTime(m.createdAt)}</span>
        </div>
      </div>
      {isSelf && <Avatar name="我" size={32} />}
    </div>
  )
}

function SendStatus({ message }: { message: LocalMessage }) {
  if (message.pending) return <Loader2 className="h-3 w-3 animate-spin" />
  if (message.failed) return <X className="h-3 w-3 text-red-500" />
  return <Check className="h-3 w-3 text-emerald-500" />
}

function MessageBody({ message: m }: { message: LocalMessage }) {
  if (m.type === 'IMAGE' && m.refObjectKey) {
    return <ImageMessage objectKey={m.refObjectKey} alt={m.content} />
  }
  if ((m.type === 'FILE' || m.type === 'VOICE' || m.type === 'VIDEO') && m.refObjectKey) {
    return <FileMessage name={m.content} objectKey={m.refObjectKey} />
  }
  return <span className="whitespace-pre-wrap">{m.content}</span>
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
