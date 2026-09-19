import { create } from 'zustand'
import { toast } from 'sonner'
import { friendApi } from '@/api/friends'
import { groupApi } from '@/api/groups'
import { messageApi } from '@/api/messages'
import { uploadFile } from '@/api/files'
import { errorMessage, newClientMsgId, isGroupConversation, ConversationIds } from '@/lib/utils'
import { notifyDesktop } from '@/lib/desktop'
import { socket } from '@/ws/socket'
import { useAuthStore } from './auth'
import type {
  FriendRequestView,
  GroupView,
  MessageView,
  MessageType,
  NotifyPayload,
  UserView
} from '@/types/api'

export interface Conversation {
  id: string
  type: 'dm' | 'group' | 'ai'
  peerId?: number
  groupId?: number
  name: string
  avatarUrl?: string | null
  lastMessage?: MessageView
}

/** AI 助手固定会话（前端本地，消息不落库不进消息链路） */
export const AI_CONV_ID = 'ai:assistant'
export const AI_CONVERSATION: Conversation = { id: AI_CONV_ID, type: 'ai', name: 'AI 助手' }

/** 本地消息：带发送状态 */
export type LocalMessage = MessageView & { pending?: boolean; failed?: boolean }

/** 发送附加项：引用回复 / @提及 / 阅后即焚 */
export interface SendOptions {
  replyToId?: string | null
  mentionedUserIds?: number[] | null
  burnAfterRead?: boolean
}

interface ChatState {
  friends: UserView[]
  friendById: Record<number, UserView>
  groups: GroupView[]
  friendRequests: FriendRequestView[]
  conversations: Conversation[]
  messages: Record<string, LocalMessage[]>
  unread: Record<string, number>
  activeId: string | null
  /** 正在引用回复的消息（输入框上方展示，发送后清除） */
  replyTo: LocalMessage | null
  /** 输入中状态：conversationId → senderId → 失效时间戳（3s 无续包消失） */
  typing: Record<string, Record<number, number>>
  loadingHistory: boolean
  initialized: boolean

  init: () => Promise<void>
  openConversation: (id: string) => Promise<void>
  loadMore: (id: string) => Promise<void>
  setActive: (id: string | null) => void
  sendText: (target: ConversationTarget, content: string, opts?: SendOptions) => Promise<void>
  sendFile: (target: ConversationTarget, file: File, type: MessageType, opts?: SendOptions) => Promise<void>
  /** 语音消息：content = 时长秒数字符串 */
  sendVoice: (target: ConversationTarget, blob: Blob, seconds: number) => Promise<void>
  /** 视频消息：content = 时长秒数字符串（与语音一致，上限 60s） */
  sendVideo: (target: ConversationTarget, blob: Blob, seconds: number) => Promise<void>
  recallMessage: (id: string, conversationId: string) => Promise<void>
  /** 置顶 / 取消置顶（成功后本地原地更新，对端经 WS 推送原地更新） */
  togglePin: (message: LocalMessage) => Promise<void>
  /** 转发消息到多个目标会话 */
  forwardMessage: (id: string, targets: { type: 'dm' | 'group'; targetId: number }[]) => Promise<number>
  setReplyTo: (m: LocalMessage | null) => void
  /** 全局搜索跳转：会话不存在时本地补建占位 */
  ensureConversation: (conv: Conversation) => void
  handleIncoming: (view: MessageView) => void
  handleNotify: (payload: NotifyPayload) => void
  clearUnread: (id: string) => Promise<void>
  refreshFriends: () => Promise<void>
  refreshGroups: () => Promise<void>
  refreshRequests: () => Promise<void>
  acceptRequest: (requestId: number) => Promise<void>
  addFriend: (toUserId: number, remark?: string) => Promise<void>
  removeFriend: (friendId: number) => Promise<void>
  createGroup: (name: string, memberIds: number[]) => Promise<void>
  quitGroup: (groupId: number) => Promise<void>
}

export interface ConversationTarget {
  /** 单聊对方 userId */
  peerId?: number
  /** 群 id */
  groupId?: number
}

function conversationIdOf(target: ConversationTarget, selfId: number): string {
  if (target.groupId) return ConversationIds.group(target.groupId)
  return ConversationIds.dm(selfId, target.peerId!)
}

export const useChatStore = create<ChatState>((set, get) => ({
  friends: [],
  friendById: {},
  groups: [],
  friendRequests: [],
  conversations: [],
  messages: {},
  unread: {},
  activeId: null,
  replyTo: null,
  typing: {},
  loadingHistory: false,
  initialized: false,

  init: async () => {
    await Promise.all([get().refreshFriends(), get().refreshGroups(), get().refreshRequests()])
    // 组装会话列表并补拉最后一条消息 / 未读数
    const { friends, groups } = get()
    const selfId = useAuthStore.getState().user!.id
    const conversations: Conversation[] = [
      ...friends.map<UserView, Conversation>((f) => ({
        id: ConversationIds.dm(selfId, f.id),
        type: 'dm',
        peerId: f.id,
        name: f.nickname || f.username,
        avatarUrl: f.avatarUrl
      })),
      ...groups.map((g) => ({
        id: ConversationIds.group(g.id),
        type: 'group',
        groupId: g.id,
        name: g.name,
        avatarUrl: g.avatarUrl
      }))
    ]

    const ids = conversations.map((c) => c.id)
    const unreadMap = ids.length ? await messageApi.unread(ids).catch(() => ({})) : {}

    await Promise.allSettled(
      conversations.map(async (c) => {
        const history = await messageApi.history(c.id, undefined, 1).catch(() => [])
        if (history.length > 0) c.lastMessage = history[0]
      })
    )

    conversations.sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''))
    // AI 助手固定会话置顶（不参与排序、无未读）
    conversations.unshift(AI_CONVERSATION)

    set({
      conversations,
      unread: unreadMap,
      initialized: true
    })
  },

  openConversation: async (id) => {
    // AI 会话：纯前端本地，无历史/未读
    if (id === AI_CONV_ID) {
      set({ activeId: id })
      return
    }
    set({ activeId: id })
    void get().clearUnread(id)
    if (get().messages[id]?.length) return
    set({ loadingHistory: true })
    try {
      const history = await messageApi.history(id, undefined, 50)
      set((s) => ({ messages: { ...s.messages, [id]: history } }))
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      set({ loadingHistory: false })
    }
  },

  loadMore: async (id) => {
    const list = get().messages[id] ?? []
    if (list.length === 0) return
    const oldest = list[0].createdAt
    const older = await messageApi.history(id, oldest, 50).catch(() => [])
    if (older.length > 0) {
      set((s) => ({ messages: { ...s.messages, [id]: [...older, ...(s.messages[id] ?? [])] } }))
    }
  },

  setActive: (id) => set({ activeId: id }),

  sendText: async (target, content, opts) => {
    await sendWithRetry(set, get, target, { type: 'TEXT', content, ...opts })
  },

  sendFile: async (target, file, type, opts) => {
    const clientMsgId = newClientMsgId()
    const selfId = useAuthStore.getState().user!.id
    const convId = conversationIdOf(target, selfId)
    const placeholder: LocalMessage = {
      id: `pending:${clientMsgId}`,
      conversationId: convId,
      senderId: selfId,
      receiverId: target.peerId ?? null,
      groupId: target.groupId ?? null,
      type,
      content: file.name,
      refObjectKey: null,
      replyToId: opts?.replyToId ?? null,
      mentionedUserIds: opts?.mentionedUserIds ?? null,
      clientMsgId,
      recalled: false,
      createdAt: new Date().toISOString(),
      pending: true
    }
    appendMessage(set, convId, placeholder)
    try {
      const presign = await uploadFile(file, clientMsgId)
      await sendRequest(target, { type, content: file.name, refObjectKey: presign.objectKey, clientMsgId, ...opts }, set, get)
    } catch (err) {
      markFailed(set, convId, clientMsgId)
      toast.error(errorMessage(err))
    }
  },

  sendVoice: async (target, blob, seconds) => {
    await sendMediaMessage(set, get, target, blob, seconds, 'VOICE', 'voice')
  },

  sendVideo: async (target, blob, seconds) => {
    await sendMediaMessage(set, get, target, blob, seconds, 'VIDEO', 'video')
  },

  recallMessage: async (id, conversationId) => {
    try {
      await messageApi.recall(id)
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
            m.id === id ? { ...m, recalled: true } : m
          )
        }
      }))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  },

  setReplyTo: (m) => set({ replyTo: m }),

  togglePin: async (message) => {
    const next = !message.pinned
    try {
      const view = await messageApi.pin(message.id, next)
      set((s) => ({
        messages: {
          ...s.messages,
          [message.conversationId]: (s.messages[message.conversationId] ?? []).map((m) =>
            m.id === message.id
              ? { ...m, pinned: view.pinned, pinnedBy: view.pinnedBy ?? null, pinnedAt: view.pinnedAt ?? null }
              : m
          )
        }
      }))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  },

  forwardMessage: async (id, targets) => {
    const results = await messageApi.forward(id, targets)
    // 目标会话已加载过消息 → 拉取新消息本体补进本地，避免等下次进入会话
    await Promise.allSettled(
      results.map(async (r) => {
        if (get().messages[r.conversationId]) {
          const view = await messageApi.getById(r.messageId)
          appendMessage(set, r.conversationId, view)
        }
      })
    )
    return results.length
  },

  ensureConversation: (conv) =>
    set((s) =>
      s.conversations.some((c) => c.id === conv.id) ? {} : { conversations: [conv, ...s.conversations] }
    ),

  handleIncoming: (view) => {
    const state = get()

    // 撤回事件：id = 被撤回的原消息 ID，原地标记
    if (view.type === 'RECALL') {
      set((s) => ({
        messages: {
          ...s.messages,
          [view.conversationId]: (s.messages[view.conversationId] ?? []).map((m) =>
            m.id === view.id ? { ...m, recalled: true } : m
          )
        },
        conversations: s.conversations.map((c) =>
          c.id === view.conversationId && c.lastMessage?.id === view.id
            ? { ...c, lastMessage: { ...c.lastMessage, recalled: true } }
            : c
        )
      }))
      return
    }

    // 已存在：置顶变更推送 → 原地更新 pinned（其余重复推送忽略）
    const existing = state.messages[view.conversationId]?.find(
      (m) => m.id === view.id || (view.clientMsgId && m.clientMsgId === view.clientMsgId)
    )
    if (existing) {
      if (view.pinned !== undefined && view.pinned !== existing.pinned) {
        set((s) => ({
          messages: {
            ...s.messages,
            [view.conversationId]: (s.messages[view.conversationId] ?? []).map((m) =>
              m.id === existing.id
                ? { ...m, pinned: view.pinned, pinnedBy: view.pinnedBy ?? null, pinnedAt: view.pinnedAt ?? null }
                : m
            )
          }
        }))
      }
      // 阅后即焚焚毁推送 → 原地清空内容（含会话列表摘要）
      if (view.burned && !existing.burned) {
        set((s) => ({
          messages: {
            ...s.messages,
            [view.conversationId]: (s.messages[view.conversationId] ?? []).map((m) =>
              m.id === existing.id ? { ...m, burned: true, content: '', refObjectKey: null } : m
            )
          },
          conversations: s.conversations.map((c) =>
            c.id === view.conversationId && c.lastMessage?.id === existing.id
              ? { ...c, lastMessage: { ...c.lastMessage, burned: true, content: '', refObjectKey: null } }
              : c
          )
        }))
      }
      return
    }
    appendMessage(set, view.conversationId, view)

    // 会话可能不存在（首次收到某人消息）→ 本地补建，后台刷新修正
    if (!state.conversations.some((c) => c.id === view.conversationId)) {
      const selfId = useAuthStore.getState().user!.id
      let conv: Conversation
      if (isGroupConversation(view.conversationId)) {
        conv = { id: view.conversationId, type: 'group', groupId: view.groupId!, name: '群聊' }
        void get().refreshGroups() // 刷新后名称由 syncConversations 修正
      } else {
        const peer = view.senderId === selfId ? view.receiverId! : view.senderId
        const known = state.friendById[peer]
        conv = {
          id: view.conversationId,
          type: 'dm',
          peerId: peer,
          name: known?.nickname || known?.username || `用户 ${peer}`,
          avatarUrl: known?.avatarUrl ?? null
        }
        if (!known) void get().refreshFriends()
      }
      set((s) => ({ conversations: [conv, ...s.conversations] }))
    }

    // 未读：非当前会话 或 页面不可见
    const isActive = state.activeId === view.conversationId && document.visibilityState === 'visible'
    if (!isActive) {
      set((s) => ({
        unread: { ...s.unread, [view.conversationId]: (s.unread[view.conversationId] ?? 0) + 1 }
      }))
      // Tauri 桌面端原生通知（Web 端静默跳过）
      const sender = state.friendById[view.senderId]
      const senderName = sender?.nickname || sender?.username || `用户 ${view.senderId}`
      const preview =
        view.type === 'IMAGE'
          ? '[图片]'
          : view.type === 'FILE'
            ? `[文件] ${view.content}`
            : view.content
      notifyDesktop('WeTalk', `${senderName}：${preview}`)
    }
    bumpConversation(set, view)
  },

  handleNotify: (payload) => {
    if (payload.event === 'FRIEND_REQUEST') {
      toast.info('收到新的好友请求')
      void get().refreshRequests()
    } else if (payload.event === 'FRIEND_ACCEPTED') {
      toast.success('好友请求已通过')
      void get().refreshFriends()
    } else if (payload.event === 'ACHIEVEMENT') {
      const data = payload.data as { code: string; title: string; description: string; emoji: string } | null
      if (data?.title) {
        toast.success(`${data.emoji ?? '🏅'} 解锁成就「${data.title}」`, { description: data.description })
      }
    } else if (payload.event === 'WHITEBOARD') {
      // 白板事件转发给 WhiteboardDialog（以 conversationId 过滤）
      window.dispatchEvent(new CustomEvent('wetalk:whiteboard', { detail: payload.data }))
    } else if (payload.event === 'GAME') {
      // 五子棋事件转发给 GameDialog（以 conversationId 过滤）
      window.dispatchEvent(new CustomEvent('wetalk:game', { detail: payload.data }))
    } else if (payload.event === 'TYPING') {
      const data = payload.data as { conversationId: string; senderId: number }
      const selfId = useAuthStore.getState().user?.id
      if (!data || data.senderId === selfId) return
      const expireAt = Date.now() + 3000
      set((s) => ({
        typing: {
          ...s.typing,
          [data.conversationId]: { ...(s.typing[data.conversationId] ?? {}), [data.senderId]: expireAt }
        }
      }))
      // 3s 无续包自动消失
      setTimeout(() => {
        set((s) => {
          const map = { ...(s.typing[data.conversationId] ?? {}) }
          for (const [uid, exp] of Object.entries(map)) {
            if ((exp as number) <= Date.now()) delete map[Number(uid)]
          }
          return { typing: { ...s.typing, [data.conversationId]: map } }
        })
      }, 3100)
    }
  },

  clearUnread: async (id) => {
    if ((get().unread[id] ?? 0) > 0) {
      set((s) => ({ unread: { ...s.unread, [id]: 0 } }))
      await messageApi.clearUnread(id).catch(() => undefined)
    }
  },

  refreshFriends: async () => {
    const friends = await friendApi.list().catch(() => [])
    set({
      friends,
      friendById: Object.fromEntries(friends.map((f) => [f.id, f])),
      conversations: syncConversations(get, friends, get().groups)
    })
  },

  refreshGroups: async () => {
    const groups = await groupApi.my().catch(() => [])
    set({ groups, conversations: syncConversations(get, get().friends, groups) })
  },

  refreshRequests: async () => {
    const friendRequests = await friendApi.requests().catch(() => [])
    set({ friendRequests: friendRequests.filter((r) => r.status === 'PENDING') })
  },

  acceptRequest: async (requestId) => {
    await friendApi.acceptRequest(requestId)
    await Promise.all([get().refreshRequests(), get().refreshFriends()])
  },

  addFriend: async (toUserId, remark) => {
    await friendApi.sendRequest({ toUserId, remark })
    toast.success('好友请求已发送')
  },

  removeFriend: async (friendId) => {
    await friendApi.remove(friendId)
    const selfId = useAuthStore.getState().user!.id
    const convId = ConversationIds.dm(selfId, friendId)
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== convId),
      messages: Object.fromEntries(Object.entries(s.messages).filter(([k]) => k !== convId)),
      unread: Object.fromEntries(Object.entries(s.unread).filter(([k]) => k !== convId)),
      activeId: s.activeId === convId ? null : s.activeId
    }))
    await get().refreshFriends()
  },

  createGroup: async (name, memberIds) => {
    const group = await groupApi.create({ name, memberIds })
    await get().refreshGroups()
    toast.success(`群「${group.name}」创建成功`)
  },

  quitGroup: async (groupId) => {
    const convId = ConversationIds.group(groupId)
    await groupApi.quit(groupId)
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== convId),
      activeId: s.activeId === convId ? null : s.activeId
    }))
    await get().refreshGroups()
  }
}))

/* ---------- 内部工具 ---------- */

/** 语音/视频消息通用发送：占位 → presign 直传 → 发送（content = 时长秒数） */
async function sendMediaMessage(
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  get: () => ChatState,
  target: ConversationTarget,
  blob: Blob,
  seconds: number,
  type: 'VOICE' | 'VIDEO',
  prefix: string
) {
  const clientMsgId = newClientMsgId()
  const selfId = useAuthStore.getState().user!.id
  const convId = conversationIdOf(target, selfId)
  const file = new File([blob], `${prefix}-${clientMsgId}.webm`, { type: blob.type || `${prefix}/webm` })
  const placeholder: LocalMessage = {
    id: `pending:${clientMsgId}`,
    conversationId: convId,
    senderId: selfId,
    receiverId: target.peerId ?? null,
    groupId: target.groupId ?? null,
    type,
    content: String(seconds),
    refObjectKey: null,
    replyToId: null,
    mentionedUserIds: null,
    clientMsgId,
    recalled: false,
    createdAt: new Date().toISOString(),
    pending: true
  }
  appendMessage(set, convId, placeholder)
  try {
    const presign = await uploadFile(file, clientMsgId)
    await sendRequest(target, { type, content: String(seconds), refObjectKey: presign.objectKey, clientMsgId }, set, get)
  } catch (err) {
    markFailed(set, convId, clientMsgId)
    toast.error(errorMessage(err))
  }
}

async function sendRequest(
  target: ConversationTarget,
  body: {
    type: MessageType
    content: string
    refObjectKey?: string | null
    clientMsgId: string
    replyToId?: string | null
    mentionedUserIds?: number[] | null
    burnAfterRead?: boolean
  },
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  get: () => ChatState
) {
  const selfId = useAuthStore.getState().user!.id
  const convId = conversationIdOf(target, selfId)
  try {
    const result = await messageApi.send({
      receiverId: target.groupId ? null : (target.peerId ?? null),
      groupId: target.groupId ?? null,
      ...body
    })
    // 用 SendResult 把 pending 消息转正
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: (s.messages[convId] ?? []).map((m) =>
          m.clientMsgId === body.clientMsgId
            ? { ...m, id: result.messageId, createdAt: result.createdAt, pending: false }
            : m
        )
      }
    }))
    bumpConversation(set, {
      id: convId,
      senderId: selfId,
      groupId: target.groupId ?? null,
      receiverId: target.peerId ?? null,
      type: body.type,
      content: body.content,
      refObjectKey: body.refObjectKey ?? null,
      replyToId: body.replyToId ?? null,
      mentionedUserIds: body.mentionedUserIds ?? null,
      clientMsgId: body.clientMsgId,
      recalled: false,
      conversationId: convId,
      createdAt: result.createdAt
    })
  } catch (err) {
    markFailed(set, convId, body.clientMsgId)
    throw err
  }
}

async function sendWithRetry(
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  get: () => ChatState,
  target: ConversationTarget,
  body: {
    type: MessageType
    content: string
    replyToId?: string | null
    mentionedUserIds?: number[] | null
    burnAfterRead?: boolean
  }
) {
  const selfId = useAuthStore.getState().user!.id
  const convId = conversationIdOf(target, selfId)
  const clientMsgId = newClientMsgId()
  const placeholder: LocalMessage = {
    id: `pending:${clientMsgId}`,
    conversationId: convId,
    senderId: selfId,
    receiverId: target.peerId ?? null,
    groupId: target.groupId ?? null,
    type: body.type,
    content: body.content,
    refObjectKey: null,
    replyToId: body.replyToId ?? null,
    mentionedUserIds: body.mentionedUserIds ?? null,
    clientMsgId,
    recalled: false,
    createdAt: new Date().toISOString(),
    pending: true
  }
  appendMessage(set, convId, placeholder)
  try {
    await sendRequest(target, { ...body, clientMsgId }, set, get)
  } catch (err) {
    toast.error(errorMessage(err))
  }
}

function appendMessage(
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  convId: string,
  message: LocalMessage
) {
  set((s) => {
    const list = s.messages[convId] ?? []
    // 去重：同 id 或同 clientMsgId
    if (list.some((m) => m.id === message.id || (message.clientMsgId && m.clientMsgId === message.clientMsgId))) {
      return {}
    }
    return { messages: { ...s.messages, [convId]: [...list, message] } }
  })
}

function markFailed(
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  convId: string,
  clientMsgId: string
) {
  set((s) => ({
    messages: {
      ...s.messages,
      [convId]: (s.messages[convId] ?? []).map((m) =>
        m.clientMsgId === clientMsgId ? { ...m, pending: false, failed: true } : m
      )
    }
  }))
}

/** 新消息到达 / 消息发出后更新会话置顶 */
function bumpConversation(set: (fn: (s: ChatState) => Partial<ChatState>) => void, view: MessageView) {
  set((s) => {
    const conversations = [...s.conversations]
    const idx = conversations.findIndex((c) => c.id === view.conversationId)
    if (idx >= 0) {
      const [conv] = conversations.splice(idx, 1)
      conv.lastMessage = view
      conversations.unshift(conv)
    }
    return { conversations }
  })
}

/** friends/groups 变化后同步会话列表（保留 lastMessage / 排序） */
function syncConversations(
  get: () => ChatState,
  friends: UserView[],
  groups: GroupView[]
): Conversation[] {
  const selfId = useAuthStore.getState().user!.id
  const prev = new Map(get().conversations.map((c) => [c.id, c]))
  const next: Conversation[] = [
    ...friends.map((f) => ({
      id: ConversationIds.dm(selfId, f.id),
      type: 'dm' as const,
      peerId: f.id,
      name: f.nickname || f.username,
      avatarUrl: f.avatarUrl,
      ...(prev.get(ConversationIds.dm(selfId, f.id))?.lastMessage
        ? { lastMessage: prev.get(ConversationIds.dm(selfId, f.id))!.lastMessage }
        : {})
    })),
    ...groups.map((g) => ({
      id: ConversationIds.group(g.id),
      type: 'group' as const,
      groupId: g.id,
      name: g.name,
      avatarUrl: g.avatarUrl,
      ...(prev.get(ConversationIds.group(g.id))?.lastMessage
        ? { lastMessage: prev.get(ConversationIds.group(g.id))!.lastMessage }
        : {})
    }))
  ]
  next.sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''))
  // AI 助手固定会话始终置顶
  return [AI_CONVERSATION, ...next]
}
