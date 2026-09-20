import { Client, type IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { ChannelMessageView, MessageView, NotifyPayload, SendResult, VoipSignal } from '@/types/api'

export type WsStatus = 'connecting' | 'open' | 'closed'

/**
 * STOMP 连接管理：SockJS 传输 + 自动重连 + /app/heartbeat 在线续期。
 * 对齐后端：握手 ?token=JWT；订阅 /user/queue/{messages,ack,notify,voip} + /topic/channel.{id}。
 */
class SocketManager {
  private client: Client | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private accessToken: string | null = null
  /** 频道动态订阅：channelId → STOMP subscription（离开频道页退订） */
  private channelSubs = new Map<number, IMessage>()
  /** voip 信令多播（点对点/会议与语音房间各自消费，按 roomId 字段分流） */
  private voipListeners = new Set<(signal: VoipSignal) => void>()

  status: WsStatus = 'closed'
  onStatusChange: ((status: WsStatus) => void) | null = null
  onMessage: ((view: MessageView) => void) | null = null
  onAck: ((ack: SendResult) => void) | null = null
  onNotify: ((payload: NotifyPayload) => void) | null = null
  onVoip: ((signal: VoipSignal) => void) | null = null
  onChannelMessage: ((view: ChannelMessageView) => void) | null = null

  /** 注册 voip 信令监听（返回取消函数）；与 onVoip 单播并存 */
  onVoipMessage(listener: (signal: VoipSignal) => void) {
    this.voipListeners.add(listener)
    return () => this.voipListeners.delete(listener)
  }

  connect(accessToken: string) {
    if (this.client && this.accessToken === accessToken) return
    this.disconnect()
    this.accessToken = accessToken

    const wsUrl = `${location.origin}/ws`

    this.client = new Client({
      // 开发环境经 vite 代理；SockJS 自带降级（xhr-streaming → polling）
      webSocketFactory: () => new SockJS(wsUrl) as unknown as WebSocket,
      // STOMP CONNECT 帧携带 Authorization 头，token 不再出现在 URL 中
      connectHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
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
    this.clearChannelSubs()
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
    this.client.subscribe('/user/queue/voip', (msg: IMessage) => {
      try {
        const signal = JSON.parse(msg.body) as VoipSignal
        this.onVoip?.(signal)
        for (const listener of this.voipListeners) {
          listener(signal)
        }
      } catch {
        // ignore
      }
    })
  }

  /** 通话信令发送：/app/voip.signal（服务端补 fromUserId 后转发对端） */
  sendVoip(signal: VoipSignal) {
    if (this.client?.connected) {
      this.client.publish({ destination: '/app/voip.signal', body: JSON.stringify(signal) })
    }
  }

  /** 输入中状态：/app/typing，内置按会话 2s 节流 */
  private typingSentAt = new Map<string, number>()
  sendTyping(conversationId: string) {
    if (!this.client?.connected) return
    const now = Date.now()
    const last = this.typingSentAt.get(conversationId) ?? 0
    if (now - last < 2000) return
    this.typingSentAt.set(conversationId, now)
    this.client.publish({
      destination: '/app/typing',
      body: JSON.stringify({ conversationId })
    })
  }

  /** 协作白板：/app/whiteboard（STROKE 笔画 / CLEAR 清空） */
  sendWhiteboard(conversationId: string, event: 'STROKE' | 'CLEAR', data: string | null) {
    if (this.client?.connected) {
      this.client.publish({
        destination: '/app/whiteboard',
        body: JSON.stringify({ conversationId, event, data })
      })
    }
  }

  /** 频道动态订阅（进入频道页时调用；同一频道幂等） */
  subscribeChannel(channelId: number) {
    if (!this.client?.connected || this.channelSubs.has(channelId)) return
    this.channelSubs.set(
      channelId,
      this.client.subscribe(`/topic/channel.${channelId}`, (msg: IMessage) => {
        try {
          this.onChannelMessage?.(JSON.parse(msg.body) as ChannelMessageView)
        } catch {
          // ignore
        }
      })
    )
  }

  /** 频道退订（离开频道页时调用） */
  unsubscribeChannel(channelId: number) {
    this.channelSubs.get(channelId)?.unsubscribe()
    this.channelSubs.delete(channelId)
  }

  /** 断线时清理全部频道订阅（重连后由页面 effect 重新订阅） */
  clearChannelSubs() {
    for (const sub of this.channelSubs.values()) {
      try {
        sub.unsubscribe()
      } catch {
        // ignore
      }
    }
    this.channelSubs.clear()
  }

  /** 语音房间信令发送：/app/voip.room */
  sendRoom(signal: Omit<VoipSignal, 'fromUserId'>) {
    if (this.client?.connected) {
      this.client.publish({ destination: '/app/voip.room', body: JSON.stringify(signal) })
    }
  }

  /** 五子棋对局信令：/app/game（INVITE/ACCEPT/REJECT/CANCEL/MOVE/RESIGN） */
  sendGame(request: { conversationId: string; event: string; gameId?: string | null; idx?: number | null }) {
    if (this.client?.connected) {
      this.client.publish({ destination: '/app/game', body: JSON.stringify(request) })
    }
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
