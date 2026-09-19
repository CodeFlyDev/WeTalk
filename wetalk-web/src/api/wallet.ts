import http, { unwrap } from './client'
import type { RedPacketView, WalletView } from '@/types/api'

/** 钱包 + 红包（金额单位「分」，发红包后消息经 RocketMQ 异步入会话） */
export const walletApi = {
  /** 余额 + 最近流水 */
  get() {
    return unwrap<WalletView>(http.get('/wallet'))
  },

  /** 测试充值（分） */
  recharge(amount: number) {
    return unwrap<void>(http.post('/wallet/recharge', { amount }))
  },

  /** 发红包：返回红包 ID；消息由后端事务消息异步发出 */
  sendRedPacket(req: { conversationId: string; totalAmount: number; count: number; type: string; greeting: string }) {
    return unwrap<string>(http.post('/red-packets', req))
  },

  /** 抢红包：返回领取后的红包详情 */
  grab(id: string) {
    return unwrap<RedPacketView>(http.post(`/red-packets/${id}/grab`))
  },

  /** 红包详情（含领取列表） */
  detail(id: string) {
    return unwrap<RedPacketView>(http.get(`/red-packets/${id}`))
  }
}
