import { create } from 'zustand'
import { toast } from 'sonner'
import { socket } from '@/ws/socket'
import { notifyDesktop } from '@/lib/desktop'
import { useChatStore } from '@/store/chat'
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
}

export interface IncomingCall {
  callId: string
  fromUserId: number
  fromName: string
  media: CallMedia
}

interface CallState {
  active: ActiveCall | null
  incoming: IncomingCall | null
  /** 远端流版本号：ontrack 后自增触发 UI 重新绑定 <video> */
  streamVersion: number
  startCall: (peerId: number, peerName: string, media: CallMedia) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => void
  hangup: () => void
  toggleMute: () => void
  toggleCam: () => void
}

/* ---------- 非序列化运行时（不进 store） ---------- */

let pc: RTCPeerConnection | null = null
let localStream: MediaStream | null = null
let remoteStream: MediaStream | null = null
let pendingIce: RTCIceCandidateInit[] = []
let ringingTimer: ReturnType<typeof setTimeout> | null = null

/** 主叫振铃超时 */
const RING_TIMEOUT_MS = 60_000

export const getLocalStream = () => localStream
export const getRemoteStream = () => remoteStream

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
    const state = get()
    const from = signal.fromUserId ?? 0

    switch (signal.event) {
      case 'INVITE': {
        if (state.active || state.incoming) {
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

  // 信令接线（模块加载即挂上，socket 未连接时事件不会到达）
  socket.onVoip = (signal) => void handleSignal(signal)

  return {
    active: null,
    incoming: null,
    streamVersion: 0,

    startCall: async (peerId, peerName, media) => {
      if (get().active || get().incoming) {
        toast.error('当前有通话进行中')
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
        active: { callId, peerId, peerName, media, phase: 'outgoing', muted: false, camOff: false }
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
          camOff: false
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
    }
  }
})
