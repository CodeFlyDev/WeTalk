import { Client, type IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { MessageView, NotifyPayload, SendResult } from '@/types/api'

export type WsStatus = 'connecting' | 'open' | 'closed'

/**
 * STOMP 连接管理：SockJS 传输 + 自动重连 + /app/heartbeat 在线续期。
 * 对齐后端：握手 ?token=JWT；订阅 /user/queue/{messages,ack,notify}。
 */
class SocketManager {
  private client: Client | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private accessToken: string | null = null

  status: WsStatus = 'closed'
  onStatusChange: ((status: WsStatus) => void) | null = null
  onMessage: ((view: MessageView) => void) | null = null
  onAck: ((ack: SendResult) => void) | null = null
  onNotify: ((payload: NotifyPayload) => void) | null = null

  connect(accessToken: string) {
    if (this.client && this.accessToken === accessToken) return
    this.disconnect()
    this.accessToken = accessToken

    const wsUrl = `${location.origin}/ws?token=${encodeURIComponent(accessToken)}`

    this.client = new Client({
      // 开发环境经 vite 代理；SockJS 自带降级（xhr-streaming → polling）
      webSocketFactory: () => new SockJS(wsUrl) as unknown as WebSocket,
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.setStatus('open')
        this.subscribeAll()
        this.startHeartbeat()
      },
      onWebSocketClose: () => this.setStatus('closed'),
      onStompError: () => this.setStatus('closed')
    })

    this.setStatus('connecting')
    this.client.activate()
  }

  disconnect() {
    this.stopHeartbeat()
    if (this.client) {
      this.client.deactivate().catch(() => undefined)
      this.client = null
    }
    this.setStatus('closed')
  }

  private subscribeAll() {
    if (!this.client?.connected) return
    this.client.subscribe('/user/queue/messages', (msg: IMessage) => {
      try {
        this.onMessage?.(JSON.parse(msg.body) as MessageView)
      } catch {
        // 忽略无法解析的推送
      }
    })
    this.client.subscribe('/user/queue/ack', (msg: IMessage) => {
      try {
        this.onAck?.(JSON.parse(msg.body) as SendResult)
      } catch {
        // ignore
      }
    })
    this.client.subscribe('/user/queue/notify', (msg: IMessage) => {
      try {
        this.onNotify?.(JSON.parse(msg.body) as NotifyPayload)
      } catch {
        // ignore
      }
    })
  }

  /** 定期心跳续期在线状态（对齐后端 PresenceService） */
  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.client?.connected) {
        this.client.publish({ destination: '/app/heartbeat', body: 'ping' })
      }
    }, 30_000)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private setStatus(status: WsStatus) {
    if (this.status === status) return
    this.status = status
    this.onStatusChange?.(status)
  }
}

export const socket = new SocketManager()
