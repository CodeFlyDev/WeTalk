import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarDays, Loader2, Plus, Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn, errorMessage, formatTime } from '@/lib/utils'
import { todoApi, type TodoView } from '@/api/todos'

/** 个人待办：新增 / 勾选完成 / 删除 */
export default function TodoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<TodoView[]>([])
  const [content, setContent] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    todoApi.list().then(setItems).catch(() => setItems([]))
  }, [open])

  async function add() {
    if (!content.trim() || loading) return
    setLoading(true)
    try {
      const view = await todoApi.create(content.trim(), dueAt || null)
      setItems((prev) => [view, ...prev])
      setContent('')
      setDueAt('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function toggle(item: TodoView) {
    try {
      const next = await todoApi.toggle(item.id)
      setItems((prev) => prev.map((i) => (i.id === item.id ? next : i)))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function remove(id: number) {
    try {
      await todoApi.remove(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="我的待办">
      <div className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void add()}
          maxLength={200}
          placeholder="要做点什么？"
          className="min-w-0 flex-1 rounded-md bg-background px-3 py-2 text-sm outline-none ring-1 ring-border placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="w-40 shrink-0 rounded-md bg-background px-2 py-2 text-xs outline-none ring-1 ring-border focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button size="icon" onClick={() => void add()} disabled={!content.trim() || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      <div className="mt-3 max-h-80 space-y-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">暂无待办</p>
        )}
        {items.map((i) => (
          <div key={i.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
            <button
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                i.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-border'
              )}
              onClick={() => void toggle(i)}
              title={i.done ? '标记未完成' : '标记完成'}
            >
              {i.done && '✓'}
            </button>
            <span className={cn('min-w-0 flex-1 truncate text-sm', i.done && 'text-muted-foreground line-through')}>
              {i.content}
            </span>
            {i.dueAt && (
              <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
                <CalendarDays className="h-3 w-3" /> {formatTime(i.dueAt)}
              </span>
            )}
            <button
              className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              onClick={() => void remove(i.id)}
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Dialog>
  )
}
