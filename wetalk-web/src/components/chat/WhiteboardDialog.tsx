import { useEffect, useRef, useState } from 'react'
import { Eraser, Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { messageApi } from '@/api/messages'
import { socket } from '@/ws/socket'
import type { WhiteboardNotify } from '@/types/api'
import type { Conversation } from '@/store/chat'

/** 笔画（归一化坐标 0..1，grow-only append 天然 CRDT，多端并发不冲突） */
interface Stroke {
  points: [number, number][]
  color: string
  width: number
}

const COLORS = ['#1f2937', '#e11d48', '#2563eb']

function drawSegment(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], s: Stroke) {
  ctx.strokeStyle = s.color
  ctx.lineWidth = s.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(a[0] * ctx.canvas.width, a[1] * ctx.canvas.height)
  ctx.lineTo(b[0] * ctx.canvas.width, b[1] * ctx.canvas.height)
  ctx.stroke()
}

function drawFull(ctx: CanvasRenderingContext2D, s: Stroke) {
  const pts = s.points
  for (let i = 1; i < pts.length; i++) drawSegment(ctx, pts[i - 1], pts[i], s)
}

/** 多人协作白板：笔画持久化于 Mongo + STOMP 实时同步（≤6 人小规模协作） */
export default function WhiteboardDialog({
  conversation,
  open,
  onClose
}: {
  conversation: Conversation
  open: boolean
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const currentRef = useRef<Stroke | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const [loading, setLoading] = useState(false)

  // 打开时回放历史笔画
  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    if (!canvas) return
    setLoading(true)
    messageApi
      .whiteboard(conversation.id)
      .then((strokes) => {
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        for (const raw of strokes) {
          try {
            drawFull(ctx, JSON.parse(raw) as Stroke)
          } catch {
            // 脏数据跳过
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [open, conversation.id])

  // 订阅他人笔画 / 清空事件（store.handleNotify 以 CustomEvent 转发）
  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const onBoard = (e: Event) => {
      const data = (e as CustomEvent<WhiteboardNotify>).detail
      if (!canvas || data.conversationId !== conversation.id) return
      const ctx = canvas.getContext('2d')!
      if (data.event === 'CLEAR') {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      } else if (data.stroke) {
        try {
          drawFull(ctx, JSON.parse(data.stroke) as Stroke)
        } catch {
          // 脏数据跳过
        }
      }
    }
    window.addEventListener('wetalk:whiteboard', onBoard)
    return () => window.removeEventListener('wetalk:whiteboard', onBoard)
  }, [open, conversation.id])

  function norm(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect()
    return [
      Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1)
    ]
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    currentRef.current = { points: [norm(e)], color, width: 3 }
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !currentRef.current) return
    const canvas = canvasRef.current!
    const cur = currentRef.current
    const prev = cur.points[cur.points.length - 1]
    const p = norm(e)
    cur.points.push(p)
    drawSegment(canvas.getContext('2d')!, prev, p, cur)
  }

  function onUp() {
    if (!drawingRef.current || !currentRef.current) return
    drawingRef.current = false
    const cur = currentRef.current
    currentRef.current = null
    if (cur.points.length >= 2) {
      socket.sendWhiteboard(conversation.id, 'STROKE', JSON.stringify(cur))
    }
  }

  function clearAll() {
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    socket.sendWhiteboard(conversation.id, 'CLEAR', null)
  }

  return (
    <Dialog open={open} onClose={onClose} title={`协作白板 · ${conversation.name}`} className="max-w-3xl">
      <div className="flex items-center gap-2 pb-2">
        {COLORS.map((c) => (
          <button
            key={c}
            className={cn(
              'h-6 w-6 rounded-full ring-offset-2 transition-shadow',
              color === c && 'ring-2 ring-ring'
            )}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
            title="画笔颜色"
          />
        ))}
        <Button variant="outline" size="sm" className="ml-auto" onClick={clearAll}>
          <Eraser className="mr-1 h-4 w-4" /> 清空
        </Button>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={960}
          height={600}
          className="w-full touch-none rounded-lg border bg-white shadow-inner"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70 text-sm text-muted-foreground">
            <Loader2 className="mr-1 h-4 w-4 animate-spin" /> 加载历史笔画…
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        所有会话成员可同时作画，笔画实时同步并持久化；关闭后再次打开自动回放。
      </p>
    </Dialog>
  )
}
