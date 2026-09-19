import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, Users } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { errorMessage } from '@/lib/utils'
import { useChatStore, type LocalMessage } from '@/store/chat'
import { previewOf } from './MessageItem'

/** 会话多选项 */
interface Pickable {
  id: string
  name: string
  type: 'dm' | 'group'
  targetId: number
  avatarUrl?: string | null
}

/** 转发消息：从会话列表多选目标（排除当前会话） */
export default function ForwardDialog({
  message,
  open,
  onClose
}: {
  message: LocalMessage
  open: boolean
  onClose: () => void
}) {
  const conversations = useChatStore((s) => s.conversations)
  const forwardMessage = useChatStore((s) => s.forwardMessage)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)

  const options = useMemo<Pickable[]>(() => {
    return conversations
      .filter((c) => c.id !== message.conversationId && (c.type === 'group' ? c.groupId != null : c.peerId != null))
      .map((c) =>
        c.type === 'group'
          ? { id: c.id, name: c.name, type: 'group' as const, targetId: c.groupId!, avatarUrl: c.avatarUrl }
          : { id: c.id, name: c.name, type: 'dm' as const, targetId: c.peerId!, avatarUrl: c.avatarUrl }
      )
  }, [conversations, message.conversationId])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (selected.size === 0 || sending) return
    const targets = options
      .filter((o) => selected.has(o.id))
      .map((o) => ({ type: o.type, targetId: o.targetId }))
    setSending(true)
    try {
      const count = await forwardMessage(message.id, targets)
      toast.success(`已转发到 ${count} 个会话`)
      setSelected(new Set())
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="转发消息">
      <p className="mb-3 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
        {previewOf(message)}
      </p>
      <div className="scrollbar-thin max-h-72 space-y-1 overflow-y-auto">
        {options.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">暂无其他会话</p>
        )}
        {options.map((o) => (
          <button
            key={o.id}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
            onClick={() => toggle(o.id)}
          >
            {o.type === 'group' ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Users className="h-4 w-4 text-muted-foreground" />
              </span>
            ) : (
              <Avatar name={o.name} size={32} />
            )}
            <span className="flex-1 truncate">{o.name}</span>
            <span
              className={
                'flex h-4 w-4 items-center justify-center rounded-full border ' +
                (selected.has(o.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-input')
              }
            >
              {selected.has(o.id) && <Check className="h-3 w-3" />}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button onClick={() => void submit()} disabled={selected.size === 0 || sending}>
          {sending ? '转发中…' : `转发 (${selected.size})`}
        </Button>
      </div>
    </Dialog>
  )
}
