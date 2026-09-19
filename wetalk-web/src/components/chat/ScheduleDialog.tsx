import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarX2, Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { messageApi, type ScheduledView } from '@/api/messages'
import { errorMessage, formatTime } from '@/lib/utils'
import type { Conversation } from '@/store/chat'

/** 定时发送：设定时间 + 定时任务列表（可取消，仅当前会话） */
export default function ScheduleDialog({
  conversation,
  open,
  onClose
}: {
  conversation: Conversation
  open: boolean
  onClose: () => void
}) {
  const [content, setContent] = useState('')
  const [sendAt, setSendAt] = useState('')
  const [items, setItems] = useState<ScheduledView[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    messageApi
      .scheduledList()
      .then((all) =>
        setItems(
          all.filter(
            (i) =>
              i.status === 'PENDING' &&
              (conversation.type === 'group'
                ? i.groupId === conversation.groupId
                : i.receiverId === conversation.peerId)
          )
        )
      )
      .catch(() => setItems([]))
  }, [open, conversation])

  async function schedule() {
    if (!content.trim() || !sendAt) return
    const time = new Date(sendAt)
    if (time.getTime() < Date.now() + 30_000) {
      toast.error('发送时间需在 30 秒以后')
      return
    }
    setSubmitting(true)
    try {
      // datetime-local 原生格式（YYYY-MM-DDTHH:mm，本地时区无 Z 后缀），后端 LocalDateTime 直接解析
      const view = await messageApi.schedule({
        receiverId: conversation.type === 'dm' ? conversation.peerId! : null,
        groupId: conversation.type === 'group' ? conversation.groupId! : null,
        content: content.trim(),
        sendAt
      })
      toast.success(`已定时，将于 ${formatTime(view.sendAt)} 发送`)
      setContent('')
      setSendAt('')
      setItems((prev) => [view, ...prev])
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function cancel(id: number) {
    try {
      await messageApi.cancelScheduled(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="定时发送">
      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="要定时发送的内容"
          className="w-full resize-none rounded-md bg-background px-3 py-2 text-sm outline-none ring-1 ring-border placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={sendAt}
            onChange={(e) => setSendAt(e.target.value)}
            className="flex-1 rounded-md bg-background px-3 py-2 text-sm outline-none ring-1 ring-border focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button onClick={() => void schedule()} disabled={!content.trim() || !sendAt || submitting}>
            {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} 定时
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">待发送（本会话）</p>
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
              <span className="line-clamp-1 flex-1">{i.content}</span>
              <span className="shrink-0 text-muted-foreground">{formatTime(i.sendAt)}</span>
              <button
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-red-500"
                title="取消定时"
                onClick={() => void cancel(i.id)}
              >
                <CalendarX2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
