import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Dices, Loader2, Send as SendIcon } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { aiApi } from '@/api/ai'
import { errorMessage, newClientMsgId } from '@/lib/utils'
import { useChatStore, type Conversation } from '@/store/chat'

const BG_COLORS = ['#f97316', '#10b981', '#3b82f6', '#a855f7', '#ef4444', '#0ea5e9', '#eab308']
const FONT = 'bold 60px "PingFang SC", "Microsoft YaHei", sans-serif'

/** AI 表情包：Ollama 生成文案 → 前端 canvas 模板合成 → 直传 MinIO 以 EMOJI 消息发送 */
export default function StickerDialog({
  conversation,
  open,
  onClose
}: {
  conversation: Conversation
  open: boolean
  onClose: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sticker, setSticker] = useState<{ text: string; tag: string; color: string } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sendFile = useChatStore((s) => s.sendFile)

  const target = conversation.type === 'dm' ? { peerId: conversation.peerId } : { groupId: conversation.groupId }

  /** 文案就绪后绘制模板 */
  useEffect(() => {
    if (!sticker || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const { text, tag, color } = sticker
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // 文字自动换行（最多 4 行）
    ctx.font = FONT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    const lines: string[] = []
    let line = ''
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > canvas.width - 80 && line) {
        lines.push(line)
        line = ch
      } else {
        line += ch
      }
    }
    if (line) lines.push(line)
    const shown = lines.slice(0, 4)
    const lineHeight = 68
    const startY = canvas.height / 2 - ((shown.length - 1) * lineHeight) / 2
    shown.forEach((l, i) => ctx.fillText(l, canvas.width / 2, startY + i * lineHeight, canvas.width - 60))
    // 底部 tag 水印
    ctx.font = '24px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.textAlign = 'right'
    ctx.fillText(`#${tag}`, canvas.width - 24, canvas.height - 28)
  }, [sticker])

  async function generate() {
    if (!prompt.trim() || loading) return
    setLoading(true)
    try {
      const res = await aiApi.sticker(prompt.trim())
      setSticker({
        text: res.text,
        tag: res.tag,
        color: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)]
      })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function reroll() {
    if (!sticker) return
    setSticker({ ...sticker, color: BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)] })
  }

  async function send() {
    const canvas = canvasRef.current
    if (!sticker || !canvas || sending) return
    setSending(true)
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('图片生成失败')
      const file = new File([blob], `sticker-${newClientMsgId()}.png`, { type: 'image/png' })
      setSticker(null)
      setPrompt('')
      onClose()
      await sendFile(target, file, 'EMOJI')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="AI 表情包">
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void generate()}
          maxLength={100}
          placeholder="主题，如：周一上班的心情"
          className="flex-1 rounded-md bg-background px-3 py-2 text-sm outline-none ring-1 ring-border placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button onClick={() => void generate()} disabled={!prompt.trim() || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '生成'}
        </Button>
      </div>

      {sticker && (
        <div className="mt-4 space-y-3">
          <canvas
            ref={canvasRef}
            width={480}
            height={480}
            className="mx-auto block h-56 w-56 rounded-xl border shadow-sm"
          />
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={reroll} title="换个底色">
              <Dices className="mr-1 h-4 w-4" /> 换色
            </Button>
            <Button size="sm" onClick={() => void send()} disabled={sending}>
              {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <SendIcon className="mr-1 h-4 w-4" />}
              发送到会话
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
