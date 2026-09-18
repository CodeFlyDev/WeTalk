import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { cn, errorMessage } from '@/lib/utils'
import { useChatStore } from '@/store/chat'

/** 选择好友创建群聊 */
export default function CreateGroupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const friends = useChatStore((s) => s.friends)
  const createGroup = useChatStore((s) => s.createGroup)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [creating, setCreating] = useState(false)

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (!name.trim()) {
      toast.error('请输入群名称')
      return
    }
    if (selected.size === 0) {
      toast.error('请至少选择一名成员')
      return
    }
    setCreating(true)
    try {
      await createGroup(name.trim(), [...selected])
      setName('')
      setSelected(new Set())
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="创建群聊">
      <div className="space-y-3">
        <Input
          placeholder="群名称（必填）"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
        />
        <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-md border">
          {friends.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">还没有好友可拉入群</p>
          )}
          {friends.map((f) => {
            const name_ = f.nickname || f.username
            const checked = selected.has(f.id)
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent',
                  checked && 'bg-accent'
                )}
              >
                <input type="checkbox" checked={checked} readOnly className="pointer-events-none" />
                <Avatar name={name_} size={30} src={f.avatarUrl} />
                <span className="truncate text-sm">{name_}</span>
              </button>
            )
          })}
        </div>
        <Button className="w-full" onClick={() => void submit()} disabled={creating}>
          {creating ? '创建中…' : `创建（已选 ${selected.size} 人）`}
        </Button>
      </div>
    </Dialog>
  )
}
