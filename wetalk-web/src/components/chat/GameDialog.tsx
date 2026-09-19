import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { socket } from '@/ws/socket'
import type { Conversation } from '@/store/chat'
import type { GameEventData } from '@/types/api'

const SIZE = 15

type Phase = 'idle' | 'inviting' | 'invited' | 'playing' | 'finished'

/**
 * 五子棋对局（单聊限定）：WS /app/game 实时对战，内存对局（服务端重启丢局）。
 * 事件经 notify GAME 事件 → chat store 转发 CustomEvent('wetalk:game')。
 */
export default function GameDialog({
  conversation,
  open,
  onOpenChange
}: {
  conversation: Conversation
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const selfId = useAuthStore((s) => s.user?.id)
  const [phase, setPhase] = useState<Phase>('idle')
  const [board, setBoard] = useState<number[]>(() => Array<number>(SIZE * SIZE).fill(0))
  const [myColor, setMyColor] = useState<'BLACK' | 'WHITE' | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [nextId, setNextId] = useState<number | null>(null)
  const [inviteFrom, setInviteFrom] = useState<number | null>(null)
  const [result, setResult] = useState('')

  // 对局事件（仅消费当前会话的）
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent<GameEventData>).detail
      if (!data || data.conversationId !== conversation.id) return
      switch (data.action) {
        case 'INVITE':
          setPhase('invited')
          setGameId(data.gameId)
          setInviteFrom(data.from ?? null)
          onOpenChange(true) // 收到邀请自动弹窗
          break
        case 'START':
          setPhase('playing')
          setBoard(Array<number>(SIZE * SIZE).fill(0))
          setGameId(data.gameId)
          setMyColor(data.myColor ?? null)
          setNextId(data.blackId ?? null)
          setResult('')
          break
        case 'REJECT':
          if (phase === 'inviting') {
            toast.info('对方婉拒了五子棋对局')
            setPhase('idle')
          }
          break
        case 'CANCEL':
          if (phase === 'invited') {
            toast.info('对方取消了对局邀请')
            setPhase('idle')
          }
          break
        case 'MOVE': {
          const color = data.color === 'BLACK' ? 1 : 2
          if (data.idx != null) {
            setBoard((prev) => {
              if (prev[data.idx!] !== 0) return prev
              const next = [...prev]
              next[data.idx!] = color
              return next
            })
          }
          setNextId(data.nextId ?? null)
          if (data.win) {
            setPhase('finished')
            setResult(data.winnerId === selfId ? '你赢了 🎉' : '你输了，再接再厉')
          }
          break
        }
        case 'GAME_OVER':
          setPhase('finished')
          setNextId(null)
          setResult(data.winnerId === selfId ? '对方认输，你赢了 🎉' : '你认输了')
          break
      }
    }
    window.addEventListener('wetalk:game', handler)
    return () => window.removeEventListener('wetalk:game', handler)
  }, [conversation.id, selfId, phase, onOpenChange])

  function send(event: string, extra?: { gameId?: string | null; idx?: number | null }) {
    socket.sendGame({ conversationId: conversation.id, event, ...extra })
  }

  function invite() {
    setPhase('inviting')
    send('INVITE')
  }

  function accept() {
    send('ACCEPT', { gameId })
  }

  function reject() {
    send('REJECT', { gameId })
    setPhase('idle')
  }

  function cancelInvite() {
    send('CANCEL', { gameId })
    setPhase('idle')
  }

  function play(idx: number) {
    if (phase !== 'playing' || !gameId || nextId !== selfId || board[idx] !== 0) return
    send('MOVE', { gameId, idx })
  }

  function resign() {
    send('RESIGN', { gameId })
  }

  function reset() {
    setPhase('idle')
    setBoard(Array<number>(SIZE * SIZE).fill(0))
    setMyColor(null)
    setGameId(null)
    setNextId(null)
    setResult('')
  }

  const myTurn = phase === 'playing' && nextId === selfId
  const opponentName = conversation.name

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} title="五子棋" className="max-w-md">
      {/* 状态区 */}
      <div className="mb-3 flex min-h-9 items-center gap-2 text-sm">
        {phase === 'idle' && <span className="text-muted-foreground">和 {opponentName} 来一局？</span>}
        {phase === 'inviting' && <span className="text-amber-600">等待 {opponentName} 接受邀请…</span>}
        {phase === 'invited' && <span className="text-amber-600">{opponentName} 邀请你下五子棋</span>}
        {phase === 'playing' && (
          <>
            <span
              className={cn('inline-block h-3.5 w-3.5 rounded-full border', myColor === 'BLACK' ? 'bg-black' : 'bg-white')}
            />
            <span>我执{myColor === 'BLACK' ? '黑' : '白'}</span>
            <span className={cn('ml-auto text-xs', myTurn ? 'text-emerald-600' : 'text-muted-foreground')}>
              {myTurn ? '轮到你了' : '等待对方落子…'}
            </span>
          </>
        )}
        {phase === 'finished' && (
          <>
            <span className="font-medium">{result}</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={reset}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> 再来一局
            </Button>
          </>
        )}
      </div>

      {/* 操作区（对局前） */}
      {(phase === 'idle' || phase === 'inviting' || phase === 'invited') && (
        <div className="mb-3 flex justify-center gap-2">
          {phase === 'idle' && (
            <Button size="sm" onClick={invite}>
              邀请对局（我执黑先行）
            </Button>
          )}
          {phase === 'inviting' && (
            <Button size="sm" variant="outline" onClick={cancelInvite}>
              取消邀请
            </Button>
          )}
          {phase === 'invited' && (
            <>
              <Button size="sm" onClick={accept}>
                接受（我执白）
              </Button>
              <Button size="sm" variant="outline" onClick={reject}>
                婉拒
              </Button>
            </>
          )}
        </div>
      )}

      {/* 棋盘 */}
      {phase !== 'idle' && phase !== 'inviting' && phase !== 'invited' && (
        <div
          className="grid aspect-square w-full grid-cols-[repeat(15,minmax(0,1fr))] overflow-hidden rounded-md border-2 border-amber-700 bg-amber-100 select-none dark:bg-amber-900/40"
        >
          {board.map((cell, idx) => (
            <button
              key={idx}
              className="relative flex items-center justify-center border-[0.5px] border-amber-700/30"
              onClick={() => play(idx)}
              disabled={!myTurn || cell !== 0}
            >
              {cell !== 0 && (
                <span
                  className={cn(
                    'h-[78%] w-[78%] rounded-full shadow-sm',
                    cell === 1 ? 'bg-neutral-900' : 'bg-white ring-1 ring-neutral-400'
                  )}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* 认输（对局中） */}
      {phase === 'playing' && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="ghost" className="text-red-500" onClick={resign}>
            认输
          </Button>
        </div>
      )}
    </Dialog>
  )
}
