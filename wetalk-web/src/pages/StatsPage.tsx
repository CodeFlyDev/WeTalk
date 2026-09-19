import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/utils'
import { statsApi } from '@/api/stats'
import type { StatsOverview, StatsTrendPoint } from '@/types/api'

/** 数据统计后台（管理员限定；非管理员后端 403） */
export default function StatsPage() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState<StatsOverview | null>(null)
  const [trend, setTrend] = useState<StatsTrendPoint[]>([])

  useEffect(() => {
    Promise.all([statsApi.overview(), statsApi.trend()])
      .then(([o, t]) => {
        setOverview(o)
        setTrend(t)
      })
      .catch((err) => toast.error(errorMessage(err)))
  }, [])

  const max = Math.max(1, ...trend.map((t) => t.count))
  const cards: { label: string; value: number; accent: string }[] = [
    { label: '注册用户', value: overview?.users ?? 0, accent: 'text-sky-500' },
    { label: '群聊总数', value: overview?.groups ?? 0, accent: 'text-violet-500' },
    { label: '消息总量', value: overview?.messages ?? 0, accent: 'text-emerald-500' },
    { label: '今日消息', value: overview?.todayMessages ?? 0, accent: 'text-amber-500' }
  ]

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col">
      {/* 顶栏 */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} title="返回">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">数据统计</h1>
        <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
          仅管理员可见
        </span>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {/* 概览卡片 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${c.accent}`}>
                {c.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* 近 7 天消息趋势（纯 CSS 柱状图） */}
        <div className="rounded-lg border bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <BarChart3 className="h-4 w-4" /> 近 7 天消息趋势
          </p>
          <div className="mt-4 flex h-40 items-end gap-2">
            {trend.length === 0 && (
              <p className="w-full text-center text-xs text-muted-foreground">暂无数据</p>
            )}
            {trend.map((t) => (
              <div key={t.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-muted-foreground">{t.count}</span>
                <div
                  className="w-full max-w-10 rounded-t bg-primary/70 transition-all"
                  style={{ height: `${Math.max(2, (t.count / max) * 120)}px` }}
                  title={`${t.day}：${t.count} 条`}
                />
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                  {t.day.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
