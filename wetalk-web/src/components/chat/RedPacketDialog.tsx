import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/api/client'
import { walletApi } from '@/api/wallet'
import type { Conversation } from '@/store/chat'

/** 发红包弹窗：金额（元）→ 分；后端事务消息校验余额并异步入会话 */
export default function RedPacketDialog({
  conversation,
  open,
  onClose
}: {
  conversation: Conversation
  open: boolean
  onClose: () => void
}) {
  const [type, setType] = useState<'LUCKY' | 'ORDINARY'>('LUCKY')
  const [yuan, setYuan] = useState('')
  const [count, setCount] = useState('1')
  const [greeting, setGreeting] = useState('恭喜发财，大吉大利')
  const [balance, setBalance] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setYuan('')
    setCount('1')
    setGreeting('恭喜发财，大吉大利')
    setType('LUCKY')
    walletApi
      .get()
      .then((w) => setBalance(w.balance))
      .catch(() => setBalance(null))
  }, [open])

  const totalFen = Math.round(Number(yuan) * 100)
  const countNum = Number(count)
  const valid =
    Number.isFinite(totalFen) && totalFen >= countNum && countNum >= 1 && countNum <= 100 && totalFen <= 10_000_00

  async function submit() {
    if (!valid || sending) return
    setSending(true)
    try {
      await walletApi.sendRedPacket({
        conversationId: conversation.id,
        totalAmount: totalFen,
        count: countNum,
        type,
        greeting: greeting.trim() || '恭喜发财，大吉大利'
      })
      toast.success('红包已发出')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  async function recharge() {
    try {
      await walletApi.recharge(10_000_00)
      toast.success('已充值 10000.00 元（测试）')
      setBalance((b) => (b ?? 0) + 10_000_00)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="发红包" className="max-w-sm">
      {/* 红包类型 */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(
          [
            { key: 'LUCKY', label: '拼手气红包' },
            { key: 'ORDINARY', label: '普通红包' }
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setType(key)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-sm transition-colors',
              type === key ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <label className="flex items-center gap-3 text-sm">
          <span className="w-14 shrink-0 text-muted-foreground">总金额</span>
          <Input
            autoFocus
            inputMode="decimal"
            value={yuan}
            placeholder={type === 'LUCKY' ? '0.00 ~ 10000.00' : '0.00 ~ 10000.00'}
            onChange={(e) => setYuan(e.target.value.replace(/[^\d.]/g, ''))}
          />
          <span className="shrink-0 text-muted-foreground">元</span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-14 shrink-0 text-muted-foreground">个数</span>
          <Input
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))}
          />
          <span className="shrink-0 text-muted-foreground">个</span>
        </label>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-14 shrink-0 text-muted-foreground">祝福语</span>
          <Input value={greeting} maxLength={50} onChange={(e) => setGreeting(e.target.value)} />
        </label>
        {type === 'LUCKY' && countNum > 1 && totalFen > 0 && (
          <p className="text-xs text-muted-foreground">随机拆分，金额手气不同，每人至少 0.01 元</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>余额：{balance === null ? '加载中…' : (balance / 100).toFixed(2) + ' 元'}</span>
        {balance !== null && balance < totalFen && (
          <button className="text-primary hover:underline" onClick={() => void recharge()}>
            余额不足，测试充值
          </button>
        )}
      </div>

      <Button className="mt-3 w-full" disabled={!valid || sending} onClick={() => void submit()}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : '塞钱进红包'}
      </Button>
    </Dialog>
  )
}
