import { create } from 'zustand'
import { toast } from 'sonner'
import { socket } from '@/ws/socket'
import { notifyDesktop } from '@/lib/desktop'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import type { CallMedia, VoipSignal } from '@/types/api'

export type CallPhase = 'outgoing' | 'incoming' | 'connected'

export interface ActiveCall {
  callId: string
  peerId: number
  peerName: string
  media: CallMedia
  phase: CallPhase
  muted: boolean
  camOff: boolean
  /** 正在共享屏幕（视频轨已替换为屏幕采集） */
  sharing: boolean
}

export interface IncomingCall {
  callId: string
  fromUserId: number
  fromName: string
  media: CallMedia
}

/** 群会议状态（mesh P2P：每成员一条独立 PeerConnection） */
export interface MeetingState {
  groupId: number
  groupName: string
  media: CallMedia
  muted: boolean
  camOff: boolean
}

interface CallState {
  active: ActiveCall | null
  incoming: IncomingCall | null
  /** 远端流版本号：ontrack 后自增触发 UI 重新绑定 <video> */
  streamVersion: number
  /** 群会议（与一对一通话互斥） */
  meeting: MeetingState | null
  /** 会议成员（不含自己）：MEET_JOIN 增、MEET_LEAVE 减 */
  meetMembers: { userId: number; name: string }[]
  /** 会议远端流版本号：ontrack 后自增触发宫格重绑 */
  meetVersion: number
  startCall: (peerId: number, peerName: string, media: CallMedia) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => void
  hangup: () => void
  toggleMute: () => void
  toggleCam: () => void
  toggleScreen: () => Promise<void>
  startMeeting: (groupId: number, groupName: string, media: CallMedia) => Promise<void>
  leaveMeeting: () => void
  toggleMeetMute: () => void
  toggleMeetCam: () => void
}

/* ---------- 非序列化运行时（不进 store） ---------- */

let pc: RTCPeerConnection | null = null
let localStream: MediaStream | null = null
let remoteStream: MediaStream | null = null
let pendingIce: RTCIceCandidateInit[] = []
let ringingTimer: ReturnType<typeof setTimeout> | null = null
let screenTrack: MediaStreamTrack | null = null
let cameraTrack: MediaStreamTrack | null = null

/* ---------- 会议运行时（mesh：每成员一条连接，非序列化不进 store） ---------- */

interface MeetPeer {
  userId: number
  pc: RTCPeerConnection
  /** perfect negotiation：polite = selfId < peerId */
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  pendingIce: RTCIceCandidateInit[]
}

const meetPeers = new Map<number, MeetPeer>()
const meetStreams = new Map<number, MediaStream>()
let meetLocalStream: MediaStream | null = null
/** 会议 ICE 配置（startMeeting 预取一次，mesh 内复用） */
let cachedIceServers: RTCIceServer[] = []

/** 主叫振铃超时 */
const RING_TIMEOUT_MS = 60_000

export const getLocalStream = () => localStream
export const getRemoteStream = () => remoteStream
export const getMeetingLocalStream = () => meetLocalStream
export const getMeetingStream = (userId: number) => meetStreams.get(userId) ?? null

/* ---------- ICE 服务器：STUN 常备；配置 TURN 时按 coturn REST 鉴权生成临时凭据 ---------- */

async function iceServers(): Promise<RTCIceServer[]> {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined
  const turnSecret = import.meta.env.VITE_TURN_SECRET as string | undefined
  if (turnUrl && turnSecret) {
    // coturn --use-auth-secret：username=过期时间戳，credential=base64(HMAC-SHA1(secret, username))
    const username = String(Math.floor(Date.now() / 1000) + 3600)
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(turnSecret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username))
    const credential = btoa(String.fromCharCode(...new Uint8Array(sig)))
    servers.push({ urls: turnUrl, username, credential })
  }
  return servers
}

/* ---------- 状态机 ---------- */

export const useCallStore = create<CallState>((set, get) => {
  function send(signal: Omit<VoipSignal, 'fromUserId'>) {
    const active = get().active
    const incoming = get().incoming
    const peerId = active?.peerId ?? incoming?.fromUserId
    if (peerId == null) return
    socket.sendVoip({ ...signal, peerId })
  }

  function stopRingingTimer() {
    if (ringingTimer) {
      clearTimeout(ringingTimer)
      ringingTimer = null
    }
  }

  /** 挂断清理：停媒体流、关连接、复位状态 */
  function teardown() {
    stopRingingTimer()
    pendingIce = []
    screenTrack?.stop()
    screenTrack = null
    cameraTrack = null
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
    remoteStream = null
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
      pc = null
    }
    set({ active: null, incoming: null, streamVersion: 0 })
  }

  /** 将视频轨替换进发送器与本地预览流（屏幕共享切换） */
  function replaceVideoTrack(track: MediaStreamTrack) {
    const sender = pc?.getSenders().find((s) => s.track?.kind === 'video')
    void sender?.replaceTrack(track)
    if (localStream) {
      for (const vt of localStream.getVideoTracks()) localStream.removeTrack(vt)
      localStream.addTrack(track)
    }
  }

  function stopScreenShare() {
    screenTrack?.stop()
    screenTrack = null
    if (cameraTrack && cameraTrack.readyState === 'live') {
      replaceVideoTrack(cameraTrack)
      set((s) => ({ active: s.active ? { ...s.active, sharing: false } : null }))
    } else {
      cameraTrack = null
      // 摄像头轨已不可用：通知对端视频已停止
      const active = get().active
      if (active) {
        send({ callId: active.callId, event: 'END' })
        teardown()
      }
    }
  }

  async function createPeerConnection(): Promise<RTCPeerConnection> {
    pc = new RTCPeerConnection({ iceServers: await iceServers() })

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({ callId: currentCallId(), event: 'ICE', payload: JSON.stringify(e.candidate.toJSON()) })
      }
    }
    pc.ontrack = (e) => {
      remoteStream = e.streams[0] ?? null
      set((s) => ({ streamVersion: s.streamVersion + 1 }))
    }
    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'failed') {
        toast.error('通话连接失败，请检查网络')
        send({ callId: currentCallId(), event: 'END' })
        teardown()
      }
    }
    return pc
  }

  function currentCallId(): string {
    return get().active?.callId ?? get().incoming?.callId ?? ''
  }

  async function getLocalMedia(media: CallMedia) {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: media === 'VIDEO' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
    })
  }

  async function handleSignal(signal: VoipSignal) {
    // 会议信令（携带 groupId）：走会议状态机
    if (signal.groupId != null) {
      await handleMeetingSignal(signal)
      return
    }
    const state = get()
    const from = signal.fromUserId ?? 0

    switch (signal.event) {
      case 'INVITE': {
        if (state.active || state.incoming || state.meeting) {
          // 忙线：告知对端
          socket.sendVoip({ peerId: from, callId: signal.callId, event: 'BUSY' })
          return
        }
        const friend = useChatStore.getState().friendById[from]
        set({
          incoming: {
            callId: signal.callId,
            fromUserId: from,
            fromName: friend?.nickname || friend?.username || `用户 ${from}`,
            media: signal.media === 'VIDEO' ? 'VIDEO' : 'AUDIO'
          }
        })
        notifyDesktop('WeTalk 通话', `${friend?.nickname || `用户 ${from}`} 邀请你${signal.media === 'VIDEO' ? '视频' : '语音'}通话`)
        return
      }
      case 'CANCEL': {
        if (state.incoming?.callId === signal.callId) {
          toast.info('对方已取消')
          set({ incoming: null })
        }
        return
      }
      case 'ACCEPT': {
        // 被叫已接受（主叫收）：发起 Offer
        if (state.active?.phase !== 'outgoing') return
        stopRingingTimer()
        const conn = pc ?? (await createPeerConnection())
        if (!localStream) return
        const offer = await conn.createOffer()
        await conn.setLocalDescription(offer)
        send({ callId: signal.callId, event: 'OFFER', payload: JSON.stringify(offer) })
        return
      }
      case 'OFFER': {
        // 被叫收：接通后应答
        if (state.active?.callId !== signal.callId || !pc) return
        await pc.setRemoteDescription(JSON.parse(signal.payload!) as RTCSessionDescriptionInit)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        send({ callId: signal.callId, event: 'ANSWER', payload: JSON.stringify(answer) })
        await flushIce(pc)
        set((s) => ({
          active: s.active ? { ...s.active, phase: 'connected' } : null
        }))
        return
      }
      case 'ANSWER': {
        if (state.active?.callId !== signal.callId || !pc) return
        await pc.setRemoteDescription(JSON.parse(signal.payload!) as RTCSessionDescriptionInit)
        await flushIce(pc)
        return
      }
      case 'ICE': {
        const candidate = JSON.parse(signal.payload!) as RTCIceCandidateInit
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(candidate).catch(() => undefined)
        } else {
          pendingIce.push(candidate)
        }
        return
      }
      case 'REJECT': {
        if (state.active?.callId === signal.callId) {
          toast.info('对方已拒绝')
          teardown()
        }
        return
      }
      case 'BUSY': {
        if (state.active?.callId === signal.callId) {
          toast.info('对方忙碌中')
          teardown()
        }
        return
      }
      case 'OFFLINE': {
        if (state.active?.callId === signal.callId) {
          toast.info('对方不在线')
          teardown()
        }
        return
      }
      case 'ERROR': {
        if (state.active?.callId === signal.callId || state.incoming?.callId === signal.callId) {
          toast.error(signal.payload || '通话请求失败')
          teardown()
        }
        return
      }
      case 'END': {
        if (state.active?.callId === signal.callId || state.incoming?.callId === signal.callId) {
          toast.info('通话已结束')
          teardown()
        }
        return
      }
    }
  }

  async function flushIce(conn: RTCPeerConnection) {
    const queued = pendingIce
    pendingIce = []
    for (const c of queued) {
      await conn.addIceCandidate(c).catch(() => undefined)
    }
  }

  /* ---------- 群会议（mesh P2P）：MEET_JOIN 广播建连，perfect negotiation 防协商碰撞 ---------- */

  function meetCallId(groupId: number): string {
    return `meet-${groupId}`
  }

  function bumpMeet() {
    set((s) => ({ meetVersion: s.meetVersion + 1 }))
  }

  function sendMeet(groupId: number, event: VoipSignal['event'], opts?: { payload?: string; media?: CallMedia }) {
    socket.sendVoip({ callId: meetCallId(groupId), groupId, event, payload: opts?.payload, media: opts?.media })
  }

  function memberName(userId: number): string {
    const chat = useChatStore.getState()
    const friend = chat.friendById[userId]
    if (friend) return friend.nickname || friend.username
    const group = chat.groups.find((g) => g.id === get().meeting?.groupId)
    const member = group?.members.find((m) => m.userId === userId)
    return member ? member.nickname || member.username : `用户 ${userId}`
  }

  function closeMeetPeer(userId: number) {
    const peer = meetPeers.get(userId)
    if (!peer) return
    meetPeers.delete(userId)
    meetStreams.delete(userId)
    peer.pc.onicecandidate = null
    peer.pc.ontrack = null
    peer.pc.onnegotiationneeded = null
    peer.pc.onconnectionstatechange = null
    peer.pc.close()
    set((s) => ({ meetMembers: s.meetMembers.filter((m) => m.userId !== userId) }))
    bumpMeet()
  }

  /** 同步建连：ICE 配置在 startMeeting 时预取，避免 JOIN/OFFER 并发建连竞态 */
  function ensureMeetPeer(userId: number): MeetPeer {
    const existing = meetPeers.get(userId)
    if (existing) return existing

    const selfId = useAuthStore.getState().user!.id
    const conn = new RTCPeerConnection({ iceServers: cachedIceServers ?? [] })
    const peer: MeetPeer = {
      userId,
      pc: conn,
      // perfect negotiation：固定角色裁决 Offer 碰撞
      polite: selfId < userId,
      makingOffer: false,
      ignoreOffer: false,
      pendingIce: []
    }
    meetPeers.set(userId, peer)

    meetLocalStream?.getTracks().forEach((t) => conn.addTrack(t, meetLocalStream!))
    conn.onicecandidate = (e) => {
      const groupId = get().meeting?.groupId
      if (e.candidate && groupId != null) {
        sendMeet(groupId, 'ICE', { payload: JSON.stringify(e.candidate.toJSON()) })
      }
    }
    conn.ontrack = (e) => {
      meetStreams.set(userId, e.streams[0] ?? null)
      bumpMeet()
    }
    // onnegotiationneeded 自动发起 Offer（双方同发由 perfect negotiation 裁决）
    conn.onnegotiationneeded = () => {
      void (async () => {
        const groupId = get().meeting?.groupId
        if (groupId == null) return
        try {
          peer.makingOffer = true
          await conn.setLocalDescription()
          sendMeet(groupId, 'OFFER', { payload: JSON.stringify(conn.localDescription) })
        } catch {
          // 协商异常（连接已关闭等）忽略
        } finally {
          peer.makingOffer = false
        }
      })()
    }
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'failed') {
        toast.error(`与 ${memberName(userId)} 的会议连接失败`)
        closeMeetPeer(userId)
      }
    }

    // 成员列表增人（宫格渲染新瓦片）
    set((s) => ({
      meetMembers: s.meetMembers.some((m) => m.userId === userId)
        ? s.meetMembers
        : [...s.meetMembers, { userId, name: memberName(userId) }]
    }))
    return peer
  }

  async function flushMeetIce(peer: MeetPeer) {
    const queued = peer.pendingIce
    peer.pendingIce = []
    for (const c of queued) {
      await peer.pc.addIceCandidate(c).catch(() => undefined)
    }
  }

  /** 离开会议：广播 MEET_LEAVE + 关全部连接 + 停本地采集 */
  function leaveMeeting() {
    const meeting = get().meeting
    if (meeting) {
      sendMeet(meeting.groupId, 'MEET_LEAVE', { media: meeting.media })
    }
    for (const userId of [...meetPeers.keys()]) closeMeetPeer(userId)
    meetLocalStream?.getTracks().forEach((t) => t.stop())
    meetLocalStream = null
    set({ meeting: null, meetMembers: [] })
  }

  async function handleMeetingSignal(signal: VoipSignal) {
    const meeting = get().meeting
    const from = signal.fromUserId ?? 0

    switch (signal.event) {
      case 'MEET_JOIN': {
        if (!meeting) return
        ensureMeetPeer(from)
        return
      }
      case 'MEET_LEAVE': {
        if (meetPeers.has(from)) toast.info(`${memberName(from)} 已离开会议`)
        closeMeetPeer(from)
        return
      }
      case 'OFFER': {
        if (!meeting) return
        const peer = ensureMeetPeer(from)
        const desc = JSON.parse(signal.payload!) as RTCSessionDescriptionInit
        // 协商碰撞：impolite 端忽略对方 Offer；polite 端 setRemoteDescription 隐式回退
        const collision = peer.makingOffer || peer.pc.signalingState !== 'stable'
        peer.ignoreOffer = !peer.polite && collision
        if (peer.ignoreOffer) return
        await peer.pc.setRemoteDescription(desc)
        const answer = await peer.pc.createAnswer()
        await peer.pc.setLocalDescription(answer)
        sendMeet(meeting.groupId, 'ANSWER', { payload: JSON.stringify(answer) })
        await flushMeetIce(peer)
        return
      }
      case 'ANSWER': {
        const peer = meetPeers.get(from)
        if (!peer || peer.ignoreOffer) return
        await peer.pc.setRemoteDescription(JSON.parse(signal.payload!) as RTCSessionDescriptionInit)
        await flushMeetIce(peer)
        return
      }
      case 'ICE': {
        const peer = meetPeers.get(from)
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
        // 服务端拒绝（如非群成员）：尚无任何连接时视同会议被拒，整体退出
        if (!meetPeers.size && get().meeting) {
          toast.error(signal.payload || '会议请求被拒绝')
          leaveMeeting()
        }
        return
      }
    }
  }

  // 信令接线（模块加载即挂上，socket 未连接时事件不会到达）
  socket.onVoip = (signal) => void handleSignal(signal)

  return {
    active: null,
    incoming: null,
    streamVersion: 0,
    meeting: null,
    meetMembers: [],
    meetVersion: 0,

    /** 发起群会议：采媒体 → 置会议态 → 广播 MEET_JOIN（在线成员各自建连） */
    startMeeting: async (groupId, groupName, media) => {
      if (get().active || get().incoming || get().meeting) {
        toast.error('当前有通话/会议进行中')
        return
      }
      if (socket.status !== 'open') {
        toast.error('连接未就绪，稍后再试')
        return
      }
      try {
        cachedIceServers = await iceServers()
        meetLocalStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: media === 'VIDEO' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
        })
      } catch {
        toast.error('无法访问麦克风/摄像头，请检查浏览器权限')
        return
      }
      set({
        meeting: { groupId, groupName, media, muted: false, camOff: false },
        meetMembers: [],
        meetVersion: 0
      })
      sendMeet(groupId, 'MEET_JOIN', { media })
    },

    startCall: async (peerId, peerName, media) => {
      if (get().active || get().incoming || get().meeting) {
        toast.error('当前有通话/会议进行中')
        return
      }
      if (socket.status !== 'open') {
        toast.error('连接未就绪，稍后再试')
        return
      }
      const callId = crypto.randomUUID()
      try {
        await getLocalMedia(media)
      } catch {
        toast.error('无法访问麦克风/摄像头，请检查浏览器权限')
        return
      }
      const conn = await createPeerConnection()
      localStream?.getTracks().forEach((t) => conn.addTrack(t, localStream!))
      set({
        active: { callId, peerId, peerName, media, phase: 'outgoing', muted: false, camOff: false, sharing: false }
      })
      socket.sendVoip({ peerId, callId, event: 'INVITE', media })
      stopRingingTimer()
      ringingTimer = setTimeout(() => {
        if (get().active?.phase === 'outgoing') {
          toast.info('对方无应答')
          send({ callId, event: 'CANCEL' })
          teardown()
        }
      }, RING_TIMEOUT_MS)
    },

    acceptCall: async () => {
      const incoming = get().incoming
      if (!incoming) return
      try {
        await getLocalMedia(incoming.media)
      } catch {
        toast.error('无法访问麦克风/摄像头，请检查浏览器权限')
        // 采媒体失败视同拒绝
        send({ callId: incoming.callId, event: 'REJECT' })
        set({ incoming: null })
        return
      }
      const conn = await createPeerConnection()
      localStream?.getTracks().forEach((t) => conn.addTrack(t, localStream!))
      set({
        incoming: null,
        active: {
          callId: incoming.callId,
          peerId: incoming.fromUserId,
          peerName: incoming.fromName,
          media: incoming.media,
          phase: 'incoming',
          muted: false,
          camOff: false,
          sharing: false
        }
      })
      send({ callId: incoming.callId, event: 'ACCEPT' })
    },

    rejectCall: () => {
      const incoming = get().incoming
      if (!incoming) return
      send({ callId: incoming.callId, event: 'REJECT' })
      set({ incoming: null })
    },

    hangup: () => {
      const active = get().active
      if (active) {
        send({ callId: active.callId, event: 'END' })
      }
      teardown()
    },

    toggleMute: () => {
      const active = get().active
      if (!active) return
      const muted = !active.muted
      localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted))
      set((s) => ({ active: s.active ? { ...s.active, muted } : null }))
    },

    toggleCam: () => {
      const active = get().active
      if (!active) return
      const camOff = !active.camOff
      localStream?.getVideoTracks().forEach((t) => (t.enabled = !camOff))
      set((s) => ({ active: s.active ? { ...s.active, camOff } : null }))
    },

    toggleScreen: async () => {
      const active = get().active
      if (!active) return
      if (screenTrack) {
        stopScreenShare()
        return
      }
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        screenTrack = display.getVideoTracks()[0] ?? null
        if (!screenTrack) return
        cameraTrack = localStream?.getVideoTracks()[0] ?? null
        screenTrack.onended = () => {
          if (screenTrack) stopScreenShare()
        }
        replaceVideoTrack(screenTrack)
        set((s) => ({ active: s.active ? { ...s.active, sharing: true, camOff: false } : null }))
      } catch {
        // 用户取消了窗口选择
      }
    },

    leaveMeeting,

    toggleMeetMute: () => {
      const meeting = get().meeting
      if (!meeting) return
      const muted = !meeting.muted
      meetLocalStream?.getAudioTracks().forEach((t) => (t.enabled = !muted))
      set((s) => ({ meeting: s.meeting ? { ...s.meeting, muted } : null }))
    },

    toggleMeetCam: () => {
      const meeting = get().meeting
      if (!meeting) return
      const camOff = !meeting.camOff
      meetLocalStream?.getVideoTracks().forEach((t) => (t.enabled = !camOff))
      set((s) => ({ meeting: s.meeting ? { ...s.meeting, camOff } : null }))
    }
  }
})
