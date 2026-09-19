/** 后端 DTO 对齐定义（对齐 wetalk-server 各模块 dto 包） */

export interface ApiResult<T> {
  code: number
  message: string
  data: T
}

export interface UserView {
  id: number
  username: string
  nickname: string
  avatarUrl: string | null
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: UserView
}

export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'FILE'
  | 'VOICE'
  | 'VIDEO'
  | 'EMOJI'
  | 'LOCATION'
  | 'CARD'
  | 'RED_PACKET'
  | 'RECALL'

export interface SendMessageRequest {
  receiverId?: number | null
  groupId?: number | null
  type: MessageType
  content: string
  refObjectKey?: string | null
  clientMsgId?: string | null
  /** 引用回复的原消息 ID */
  replyToId?: string | null
  /** 群聊 @ 提及的用户 ID */
  mentionedUserIds?: number[] | null
  /** 阅后即焚 */
  burnAfterRead?: boolean | null
}

export interface MessageView {
  id: string
  conversationId: string
  senderId: number
  receiverId: number | null
  groupId: number | null
  type: MessageType
  content: string
  refObjectKey: string | null
  replyToId: string | null
  mentionedUserIds: number[] | null
  clientMsgId: string | null
  recalled: boolean
  createdAt: string
  /** 置顶状态（dm 双方 / 群任意成员均可置顶） */
  pinned?: boolean
  pinnedBy?: number | null
  pinnedAt?: string | null
  /** 阅后即焚（接收方倒计时结束调 burn） */
  burnAfterReading?: boolean
  /** 已焚毁（内容清空，展示占位） */
  burned?: boolean
}

export interface SendResult {
  messageId: string
  conversationId: string
  clientMsgId: string | null
  createdAt: string
}

export interface FriendRequestView {
  id: number
  fromUser: UserView
  remark: string | null
  status: string
  createdAt: string
}

export interface GroupView {
  id: number
  name: string
  ownerId: number
  avatarUrl: string | null
  announcement: string | null
  createdAt: string
  members: GroupMemberView[]
}

export interface GroupMemberView {
  userId: number
  username: string
  nickname: string
  role: string
}

export interface PresignResult {
  objectKey: string
  uploadUrl: string
  uploadExpireSeconds: number
}

/* ---------- 钱包 / 红包（对齐 wetalk-wallet dto，金额单位「分」） ---------- */

export interface WalletTxView {
  id: number
  type: string
  amount: number
  refId: string | null
  remark: string | null
  createdAt: string
}

export interface WalletView {
  balance: number
  transactions: WalletTxView[]
}

export interface RedPacketItemView {
  idx: number
  amount: number
  receiverId: number
  receiverName: string
  receivedAt: string
}

export interface RedPacketView {
  id: string
  senderId: number
  senderName: string
  conversationId: string
  totalAmount: number
  count: number
  type: 'ORDINARY' | 'LUCKY'
  greeting: string
  status: 'ACTIVE' | 'FINISHED' | 'EXPIRED'
  expireAt: string
  /** 我领取到的金额（分），未领为 null */
  receivedByMe: number | null
  canGrab: boolean
  remainCount: number
  items: RedPacketItemView[]
}

/** ws /user/queue/notify 事件 */
export type NotifyEvent =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'TYPING'
  | 'WHITEBOARD'
  | 'ACHIEVEMENT'
  | 'GAME'

/** 成就解锁通知（ACHIEVEMENT 事件 data） */
export interface AchievementNotify {
  code: string
  title: string
  description: string
  emoji: string
}

/** 我的成就列表项（GET /api/achievements） */
export interface AchievementView {
  code: string
  title: string
  description: string
  emoji: string
  unlocked: boolean
  unlockedAt: string | null
}

export interface NotifyPayload {
  event: NotifyEvent
  data: unknown
}

/** 白板 notify data（WHITEBOARD 事件） */
export interface WhiteboardNotify {
  conversationId: string
  event: 'STROKE' | 'CLEAR'
  stroke: string | null
  fromUserId: number
}

/** 群文件（由群会话内 type=FILE 消息聚合） */
export interface GroupFileView {
  messageId: string
  senderId: number
  fileName: string
  objectKey: string | null
  createdAt: string
}

/* ---------- 音视频信令（对齐 wetalk-voip dto） ---------- */

export type VoipEvent =
  | 'INVITE'
  | 'ACCEPT'
  | 'REJECT'
  | 'CANCEL'
  | 'BUSY'
  | 'OFFLINE'
  | 'OFFER'
  | 'ANSWER'
  | 'ICE'
  | 'END'
  | 'ERROR'
  | 'MEET_JOIN'
  | 'MEET_LEAVE'
  | 'ROOM_JOIN'
  | 'ROOM_LEAVE'
  | 'ROOM_JOINED'
  | 'ROOM_PEER_JOINED'
  | 'ROOM_PEER_LEFT'

export type CallMedia = 'AUDIO' | 'VIDEO'

/** /user/queue/voip 与 /app/voip.signal 载荷；fromUserId = 信令来源（服务端盖章） */
export interface VoipSignal {
  /** 点对点信令目标（群会议广播为空） */
  peerId?: number | null
  callId: string
  event: VoipEvent
  media?: CallMedia | null
  /** 会议广播目标群（仅 MEET_JOIN/MEET_LEAVE/OFFER/ANSWER/ICE 会议信令携带） */
  groupId?: number | null
  /** SDP / ICE 候选 JSON / 文本原因 */
  payload?: string | null
  fromUserId?: number | null
  /** 语音房间 id（仅房间信令携带） */
  roomId?: number | null
}

/* ---------- 语音房间 / 频道（Phase 7） ---------- */

/** 语音房间（GET /api/voip/rooms） */
export interface VoiceRoomView {
  id: number
  name: string
  ownerId: number
  ownerName: string
  onlineCount: number
  mine: boolean
}

/** 频道（GET /api/channels，后端返回 Map 结构） */
export interface ChannelView {
  id: number
  name: string
  description: string
  ownerId: number
  ownerName: string
  memberCount: number
  joined: boolean
  isOwner: boolean
  createdAt: string
}

/** 频道消息（REST 返回 + /topic/channel.{id} 广播） */
export interface ChannelMessageView {
  id: string
  channelId: number
  senderId: number
  senderName: string
  content: string
  createdAt: string
}

/* ---------- 五子棋（GAME 事件 data，后端 wetalk-game） ---------- */

export type GameAction =
  | 'INVITE'
  | 'START'
  | 'REJECT'
  | 'CANCEL'
  | 'MOVE'
  | 'GAME_OVER'

export interface GameEventData {
  action: GameAction
  conversationId: string
  gameId: string
  /** INVITE */
  from?: number
  /** START */
  blackId?: number
  whiteId?: number
  myColor?: 'BLACK' | 'WHITE'
  /** MOVE */
  idx?: number
  color?: 'BLACK' | 'WHITE'
  win?: boolean
  nextId?: number
  winnerId?: number | null
  reason?: string
}

/* ---------- 开放平台 / 统计（Phase 7） ---------- */

export interface ApiKeyView {
  id: number
  name: string
  apiKey: string
  revoked: boolean
  createdAt: string | null
}

export interface WebhookView {
  id: number
  url: string
  secret: string
  active: boolean
  createdAt: string | null
}

export interface StatsOverview {
  users: number
  groups: number
  messages: number
  todayMessages: number
}

export interface StatsTrendPoint {
  day: string
  count: number
}
