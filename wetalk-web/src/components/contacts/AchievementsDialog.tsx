import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { cn, errorMessage, formatTime } from '@/lib/utils'
import { achievementApi } from '@/api/achievements'
import type { AchievementView } from '@/types/api'

/** 我的成就（全部定义网格 + 已解锁高亮/时间） */
export default function AchievementsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<AchievementView[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setItems(null)
    setError(null)
    achievementApi
      .mine()
      .then(setItems)
      .catch((err) => setError(errorMessage(err)))
  }, [open])

  const unlockedCount = items?.filter((i) => i.unlocked).length ?? 0

  return (
    <Dialog open={open} onClose={onClose} title="我的成就" className="max-w-md">
      {items === null && !error && (
        <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
        </p>
      )}
      {error && <p className="py-8 text-center text-sm text-red-500">{error}</p>}
      {items && (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            已解锁 {unlockedCount} / {items.length}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {items.map((a) => (
              <div
                key={a.code}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  a.unlocked ? 'border-amber-400/50 bg-amber-500/5' : 'opacity-60'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('text-2xl', !a.unlocked && 'grayscale')}>{a.emoji}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{a.description}</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {a.unlocked ? `✓ ${formatTime(a.unlockedAt!)}` : '未解锁'}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Dialog>
  )
}
