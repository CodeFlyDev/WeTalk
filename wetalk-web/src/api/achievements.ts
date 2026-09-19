import { http, unwrap } from './client'
import type { AchievementView } from '@/types/api'

export const achievementApi = {
  /** 我的成就：全部定义 + 解锁状态/时间 */
  mine() {
    return unwrap<AchievementView[]>(http.get('/achievements'))
  }
}
