import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { aiApi } from '@/api/ai'
import { errorMessage } from '@/lib/utils'

/** AI 聊天摘要：取会话最近 50 条消息生成本地大模型要点 */
export default function SummaryDialog({
  conversationId,
  conversationName,
  open,
  onClose
}: {
  conversationId: string
  conversationName: string
  open: boolean
  onClose: () => void
}) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || summary !== null || loading) return
    setLoading(true)
    aiApi
      .summary(conversationId)
      .then(setSummary)
      .catch((err) => {
        setSummary(`⚠ ${errorMessage(err)}`)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onClose={onClose} title="AI 聊天摘要">
      <p className="mb-3 text-xs text-muted-foreground">
        基于会话「{conversationName}」最近 50 条文本消息，由本地大模型生成，仅供参考
      </p>
      {loading ? (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">正在阅读聊天记录…</p>
        </div>
      ) : (
        <div className="scrollbar-thin max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2.5 text-sm leading-relaxed">
          {summary}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>
          <Sparkles className="h-4 w-4" /> 完成
        </Button>
      </div>
    </Dialog>
  )
}
