import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { errorMessage, formatTime } from '@/lib/utils'
import { aiApi, type KnowledgeDocView } from '@/api/ai'

/** RAG 知识库管理：添加文档（自动切块 + 向量化）/ 文档列表 / 删除 */
export default function KnowledgeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [docs, setDocs] = useState<KnowledgeDocView[]>([])
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    aiApi.knowledgeList().then(setDocs).catch(() => setDocs([]))
  }, [open])

  async function add() {
    if (!title.trim() || !text.trim() || loading) return
    setLoading(true)
    try {
      const view = await aiApi.knowledgeAdd(title.trim(), text.trim())
      setDocs((prev) => [view, ...prev])
      setTitle('')
      setText('')
      toast.success('已入库，AI 助手可引用')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function remove(docId: string) {
    try {
      await aiApi.knowledgeRemove(docId)
      setDocs((prev) => prev.filter((d) => d.docId !== docId))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="AI 知识库" className="max-w-lg">
      <div className="space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="文档标题"
          className="w-full rounded-md bg-background px-3 py-2 text-sm outline-none ring-1 ring-border placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={20000}
          placeholder="粘贴文档内容（上限 2 万字，自动按 500 字切块并向量化）"
          className="w-full resize-none rounded-md bg-background px-3 py-2 text-sm outline-none ring-1 ring-border placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button onClick={() => void add()} disabled={!title.trim() || !text.trim() || loading} className="w-full">
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
          添加到知识库
        </Button>
      </div>

      <div className="mt-3 max-h-56 space-y-1 overflow-y-auto scrollbar-thin">
        {docs.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">暂无文档；添加后可在 AI 助手开启「引用知识库」</p>
        )}
        {docs.map((d) => (
          <div key={d.docId} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{d.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {d.chunks} 块 · {formatTime(d.createdAt)}
              </p>
            </div>
            <button
              className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              onClick={() => void remove(d.docId)}
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
