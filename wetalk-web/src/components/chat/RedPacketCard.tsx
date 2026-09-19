import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Gift, Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { formatTime } from '@/lib/utils'
import { errorMessage } from '@/api/client'
import { walletApi } from '@/api/wallet'
import type { RedPacketView } from '@/types/api'

/** 消息内红包卡片：content = redPacketId；点击可领取（后端 canGrab 判定）或查看详情 */
export default function RedPacketCard({ redPacketId }: { redPacketId: string }) {
  const [rp, setRp] = useState<RedPacketView | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [grabbing, setGrabbing] = useState(false)

  const load = useCallback(
    () => walletApi.detail(redPacketId).then(setRp).catch(() => setRp(null)),
    [redPacketId]
  )
  useEffect(() => {
    void load()
  }, [load])

  async function openCard() {
    if (!rp) return
    if (rp.canGrab) {
      setGrabbing(true)
      try {
        const got = await walletApi.grab(rp.id)
        setRp(got)
        toast.success(`领取到 ${(Number(got.receivedByMe) / 100).toFixed(2)} 元`)
      } catch (err) {
        toast.error(errorMessage(err))
        void load()
      } finally {
        setGrabbing(false)
      }
    }
    setDetailOpen(true)
  }

  const claimed = rp?.receivedByMe != null

  return (
    <>
      <button
        onClick={() => void openCard()}
        disabled={!rp || grabbing}
        className="flex w-56 items-center gap-3 rounded-lg bg-red-500 p-3 text-left text-white shadow-sm transition-colors hover:bg-red-500/90 disabled:opacity-80"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          {grabbing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{rp?.greeting ?? '红包'}</span>
          <span className="block truncate text-[11px] text-white/85">{statusText(rp)}</span>
        </span>
      </button>
      {claimed && rp && (
        <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
          已领取 {(Number(rp.receivedByMe) / 100).toFixed(2)} 元
        </p>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} title="红包详情" className="max-w-sm">
        {rp && (
          <div className="space-y-3">
            <div className="rounded-lg bg-gradient-to-b from-red-500 to-red-600 p-4 text-center text-white">
              <Gift className="mx-auto h-8 w-8" />
              <p className="mt-1 text-sm">{rp.greeting}</p>
              <p className="mt-1 text-xs text-white/85">
                {rp.senderName} 的{rp.type === 'LUCKY' ? '拼手气' : '普通'}红包 · {rp.count} 个
                {rp.receivedByMe != null && ` · 我领到 ${(Number(rp.receivedByMe) / 100).toFixed(2)} 元`}
              </p>
              <p className="mt-1 text-[11px] text-white/70">{statusText(rp)}</p>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {rp.items.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">还没有人领取</p>
              ) : (
                rp.items.map((it) => (
                  <div key={it.idx} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{it.receiverName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatTime(it.receivedAt)}</span>
                    <span className="w-14 shrink-0 text-right font-medium tabular-nums">
                      {(it.amount / 100).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}

/** 状态文案（与后端 RedPacketView.canGrab 对齐） */
function statusText(rp: RedPacketView | null): string {
  if (!rp) return '加载中…'
  if (rp.receivedByMe != null) return `已领取 ${(Number(rp.receivedByMe) / 100).toFixed(2)} 元`
  if (rp.status === 'EXPIRED') return '已过期，未领金额已退回'
  if (rp.status === 'FINISHED' || rp.remainCount === 0) return '已被抢完'
  if (rp.canGrab) return '点击领取'
  return '待领取'
}
