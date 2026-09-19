import { http, unwrap } from './client'
import type { StatsOverview, StatsTrendPoint } from '@/types/api'

/** 数据统计后台（管理员限定） */
export const statsApi = {
  overview: () => unwrap<StatsOverview>(http.get('/stats/overview')),
  trend: () => unwrap<StatsTrendPoint[]>(http.get('/stats/trend'))
}
