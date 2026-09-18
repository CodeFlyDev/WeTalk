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

/** ws /user/queue/notify 事件 */
export type NotifyEvent = 'FRIEND_REQUEST' | 'FRIEND_ACCEPTED'

export interface NotifyPayload {
  event: NotifyEvent
  data: unknown
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

export type CallMedia = 'AUDIO' | 'VIDEO'

/** /user/queue/voip 与 /app/voip.signal 载荷；fromUserId = 信令来源（服务端盖章） */
export interface VoipSignal {
  peerId: number
  callId: string
  event: VoipEvent
  media?: CallMedia | null
  /** SDP / ICE 候选 JSON / 文本原因 */
  payload?: string | null
  fromUserId?: number | null
}
