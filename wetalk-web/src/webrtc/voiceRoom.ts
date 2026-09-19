import { create } from 'zustand'
import { toast } from 'sonner'
import { socket } from '@/ws/socket'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { useCallStore } from '@/webrtc/call'
import type { VoiceRoomView, VoipSignal } from '@/types/api'

/**
 * 在线语音房间（mesh P2P 纯音频，复用 voip 房间信令 /app/voip.room）。
 * 语义与通话/会议互斥：进入房间前检查 useCallStore 无进行中的通话。
 */
export interface ActiveVoiceRoom {
  id: number
  name: string
}

interface RoomMember {
  userId: number
  name: string
}

interface VoiceRoomState {
  room: ActiveVoiceRoom | null
  members: RoomMember[]
  muted: boolean
  /** 远端流版本号：ontrack 后自增触发 <audio> 重绑 */
  version: number
  join: (room: VoiceRoomView) => Promise<void>
  leave: () => void
  toggleMute: () => void
}

/* ---------- 非序列化运行时 ---------- */

interface RoomPeer {
  userId: number
  pc: RTCPeerConnection
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  pendingIce: RTCIceCandidateInit[]
}

const peers = new Map<number, RoomPeer>()
const streams = new Map<number, MediaStream>()
let localStream: MediaStream | null = null
let iceServersCache: RTCIceServer[] = []

export const getRoomStream = (userId: number) => streams.get(userId) ?? null
export const getRoomLocalStream = () => localStream

/** STUN 常备（TURN 与会议同源配置；房间纯音频 P2P 一般 STUN 足够） */
async function loadIceServers(): Promise<RTCIceServer[]> {
  if (iceServersCache.length) return iceServersCache
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined
  const turnSecret = import.meta.env.VITE_TURN_SECRET as string | undefined
  if (turnUrl && turnSecret) {
    const username = String(Math.floor(Date.now() / 1000) + 3600)
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(turnSecret), {
      name: 'HMAC',
      hash: 'SHA-1'
    }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username))
    const credential = btoa(String.fromCharCode(...new Uint8Array(sig)))
    servers.push({ urls: turnUrl, username, credential })
  }
  iceServersCache = servers
  return servers
}

function memberName(userId: number): string {
  const friend = useChatStore.getState().friendById[userId]
  return friend?.nickname || friend?.username || `用户 ${userId}`
}

export const useVoiceRoomStore = create<VoiceRoomState>((set, get) => {
  function send(signal: Omit<VoipSignal, 'fromUserId'>) {
    const room = get().room
    if (!room) return
    socket.sendRoom({ ...signal, roomId: room.id })
  }

  function bump() {
    set((s) => ({ version: s.version + 1 }))
  }

  function closePeer(userId: number) {
    const peer = peers.get(userId)
    if (!peer) return
    peers.delete(userId)
    streams.delete(userId)
    peer.pc.onicecandidate = null
    peer.pc.ontrack = null
    peer.pc.onnegotiationneeded = null
    peer.pc.onconnectionstatechange = null
    peer.pc.close()
    set((s) => ({ members: s.members.filter((m) => m.userId !== userId) }))
    bump()
  }

  function ensurePeer(userId: number): RoomPeer {
    const existing = peers.get(userId)
    if (existing) return existing
    const selfId = useAuthStore.getState().user!.id
    const conn = new RTCPeerConnection({ iceServers: iceServersCache })
    const peer: RoomPeer = {
      userId,
      pc: conn,
      polite: selfId < userId,
      makingOffer: false,
      ignoreOffer: false,
      pendingIce: []
    }
    peers.set(userId, peer)

    localStream?.getTracks().forEach((t) => conn.addTrack(t, localStream!))
    conn.onicecandidate = (e) => {
      if (e.candidate) send({ callId: `room-ice`, event: 'ICE', payload: JSON.stringify(e.candidate.toJSON()) })
    }
    conn.ontrack = (e) => {
      streams.set(userId, e.streams[0] ?? null)
      bump()
    }
    conn.onnegotiationneeded = () => {
      void (async () => {
        try {
          peer.makingOffer = true
          await conn.setLocalDescription()
          send({ callId: `room-${userId}`, event: 'OFFER', payload: JSON.stringify(conn.localDescription) })
        } catch {
          // 连接已关闭等，忽略
        } finally {
          peer.makingOffer = false
        }
      })()
    }
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'failed') {
        closePeer(userId)
      }
    }

    set((s) => ({
      members: s.members.some((m) => m.userId === userId)
        ? s.members
        : [...s.members, { userId, name: memberName(userId) }]
    }))
    return peer
  }

  async function flushIce(peer: RoomPeer) {
    const queued = peer.pendingIce
    peer.pendingIce = []
    for (const c of queued) {
      await peer.pc.addIceCandidate(c).catch(() => undefined)
    }
  }

  function teardown() {
    for (const userId of [...peers.keys()]) closePeer(userId)
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
    set({ room: null, members: [], muted: false, version: 0 })
  }

  async function handleSignal(signal: VoipSignal) {
    if (signal.roomId == null) return
    if (signal.roomId !== get().room?.id) return
    const from = signal.fromUserId ?? 0

    switch (signal.event) {
      case 'ROOM_JOINED': {
        // 回执：已有在线成员列表 → 逐个建连（自己为 offer 发起方语义，双方自动协商由 perfect negotiation 兜底）
        let userIds: number[] = []
        try {
          userIds = JSON.parse(signal.payload ?? '[]') as number[]
        } catch {
          userIds = []
        }
        for (const userId of userIds) {
          ensurePeer(userId)
        }
        return
      }
      case 'ROOM_PEER_JOINED': {
        if (from) ensurePeer(from)
        return
      }
      case 'ROOM_PEER_LEFT': {
        // 服务端对本人 leave 也会回 ROOM_PEER_LEFT（fromUserId=自己）——跳过
        if (from && from !== useAuthStore.getState().user?.id) {
          toast.info(`${memberName(from)} 离开了房间`)
          closePeer(from)
        }
        return
      }
      case 'OFFER': {
        const peer = ensurePeer(from)
        const collision = peer.makingOffer || peer.pc.signalingState !== 'stable'
        peer.ignoreOffer = !peer.polite && collision
        if (peer.ignoreOffer) return
        await peer.pc.setRemoteDescription(JSON.parse(signal.payload!) as RTCSessionDescriptionInit)
        const answer = await peer.pc.createAnswer()
        await peer.pc.setLocalDescription(answer)
        send({ callId: `room-${from}`, event: 'ANSWER', payload: JSON.stringify(answer) })
        await flushIce(peer)
        return
      }
      case 'ANSWER': {
        const peer = peers.get(from)
        if (!peer || peer.ignoreOffer) return
        await peer.pc.setRemoteDescription(JSON.parse(signal.payload!) as RTCSessionDescriptionInit)
        await flushIce(peer)
        return
      }
      case 'ICE': {
        const peer = peers.get(from)
        if (!peer || peer.ignoreOffer) return
        const candidate = JSON.parse(signal.payload!) as RTCIceCandidateInit
        if (peer.pc.remoteDescription) {
          await peer.pc.addIceCandidate(candidate).catch(() => undefined)
        } else {
          peer.pendingIce.push(candidate)
        }
        return
      }
      case 'ERROR': {
        toast.error(signal.payload || '房间请求被拒绝')
        teardown()
        return
      }
    }
  }

  // 信令接线：/user/queue/voip 多播（call.ts 与本模块各自订阅，互不影响）
  socket.onVoipMessage((signal) => {
    if (signal.roomId != null) void handleSignal(signal)
  })

  return {
    room: null,
    members: [],
    muted: false,
    version: 0,

    join: async (roomView) => {
      if (get().room) {
        toast.error('已在房间中，请先离开当前房间')
        return
      }
      const call = useCallStore.getState()
      if (call.active || call.incoming || call.meeting) {
        toast.error('当前有通话/会议进行中')
        return
      }
      if (socket.status !== 'open') {
        toast.error('连接未就绪，稍后再试')
        return
      }
      try {
        await loadIceServers()
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      } catch {
        toast.error('无法访问麦克风，请检查浏览器权限')
        return
      }
      set({ room: { id: roomView.id, name: roomView.name }, members: [], muted: false, version: 0 })
      socket.sendRoom({ callId: `room-${roomView.id}`, event: 'ROOM_JOIN', roomId: roomView.id, media: 'AUDIO' })
    },

    leave: () => {
      const room = get().room
      if (room) {
        socket.sendRoom({ callId: `room-${room.id}`, event: 'ROOM_LEAVE', roomId: room.id, media: 'AUDIO' })
      }
      teardown()
    },

    toggleMute: () => {
      const room = get().room
      if (!room) return
      const muted = !get().muted
      localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted))
      set({ muted })
    }
  }
})
