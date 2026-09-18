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

export interface SendMessageRequest {
  receiverId?: number | null
  groupId?: number | null
  type: MessageType
  content: string
  refObjectKey?: string | null
  clientMsgId?: string | null
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
  clientMsgId: string | null
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
