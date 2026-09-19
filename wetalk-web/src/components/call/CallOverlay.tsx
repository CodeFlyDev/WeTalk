import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, MonitorUp, Phone, PhoneOff, Video, VideoOff } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getLocalStream,
  getMeetingLocalStream,
  getMeetingStream,
  getRemoteStream,
  useCallStore
} from '@/webrtc/call'
import { useAuthStore } from '@/store/auth'

/** 通话浮层：来电弹窗 + 通话中悬浮面板 + 会议宫格（App 级挂载，任意页面可接听/加入） */
export default function CallOverlay() {
  const active = useCallStore((s) => s.active)
  const incoming = useCallStore((s) => s.incoming)
  const meeting = useCallStore((s) => s.meeting)
  if (!active && !incoming && !meeting) return null

  return (
    <>
      {incoming && <IncomingDialog />}
      {active && <ActivePanel />}
      {meeting && <MeetingPanel />}
    </>
  )
}

/* ---------- 来电 ---------- */

function IncomingDialog() {
  const incoming = useCallStore((s) => s.incoming)!
  const acceptCall = useCallStore((s) => s.acceptCall)
  const rejectCall = useCallStore((s) => s.rejectCall)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-72 rounded-2xl border bg-card p-6 text-center shadow-xl">
        <div className="mb-3 flex justify-center">
          <div className="animate-pulse">
            <Avatar name={incoming.fromName} size={72} />
          </div>
        </div>
        <p className="text-base font-semibold">{incoming.fromName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          邀请你{incoming.media === 'VIDEO' ? '视频' : '语音'}通话…
        </p>
        <div className="mt-5 flex justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full border-red-300 text-red-500 hover:bg-red-50 hover:text-red-600"
            title="拒绝"
            onClick={rejectCall}
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full bg-emerald-500 text-white hover:bg-emerald-600"
            title="接听"
            onClick={() => void acceptCall()}
          >
            <Phone className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------- 通话中 ---------- */

function ActivePanel() {
  const active = useCallStore((s) => s.active)!
  const streamVersion = useCallStore((s) => s.streamVersion)
  const toggleMute = useCallStore((s) => s.toggleMute)
  const toggleCam = useCallStore((s) => s.toggleCam)
  const toggleScreen = useCallStore((s) => s.toggleScreen)
  const hangup = useCallStore((s) => s.hangup)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  // 绑定媒体流（远端流到达 / 本地流重挂时刷新）
  useEffect(() => {
    if (active.media === 'VIDEO') {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = getRemoteStream()
      if (localVideoRef.current) localVideoRef.current.srcObject = getLocalStream()
    }
  }, [active.media, streamVersion])

  const statusText =
    active.phase === 'outgoing'
      ? '正在等待对方接受…'
      : active.phase === 'incoming'
        ? '正在接通…'
        : null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 overflow-hidden rounded-2xl border bg-card shadow-xl">
      {active.media === 'VIDEO' ? (
        <div className="relative h-56 bg-black">
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-2 right-2 h-20 w-28 rounded-lg border border-white/20 bg-black object-cover"
          />
          {active.phase !== 'connected' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
              {statusText}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-40 flex-col items-center justify-center gap-2 bg-gradient-to-b from-primary/10 to-transparent">
          <Avatar name={active.peerName} size={64} />
          <p className="mt-1 text-sm font-semibold">{active.peerName}</p>
          <p className={cn('text-xs text-muted-foreground', active.phase === 'connected' && 'text-emerald-600')}>
            {statusText ?? <DurationTicker />}
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 border-t py-3">
        <Button
          variant="outline"
          size="icon"
          className={cn('h-10 w-10 rounded-full', active.muted && 'bg-red-500 text-white hover:bg-red-600')}
          title={active.muted ? '取消静音' : '静音'}
          onClick={toggleMute}
        >
          {active.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        {active.media === 'VIDEO' && (
          <>
            <Button
              variant="outline"
              size="icon"
              className={cn('h-10 w-10 rounded-full', active.camOff && 'bg-red-500 text-white hover:bg-red-600')}
              title={active.camOff ? '开启摄像头' : '关闭摄像头'}
              onClick={toggleCam}
            >
              {active.camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn('h-10 w-10 rounded-full', active.sharing && 'bg-primary text-primary-foreground')}
              title={active.sharing ? '停止共享' : '共享屏幕'}
              onClick={() => void toggleScreen()}
            >
              <MonitorUp className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-red-500 text-white hover:bg-red-600"
          title="挂断"
          onClick={hangup}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/** 通话时长（接通后每秒刷新） */
function DurationTicker() {
  const phase = useCallStore((s) => s.active?.phase)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (phase !== 'connected') return
    setSeconds(0)
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [phase])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return <span>{`${mm}:${ss}`}</span>
}

/* ---------- 群会议宫格 ---------- */

/** 单个瓦片：视频流（无流/纯语音时头像占位）；muted 用于本地瓦片防回声 */
function MeetingTile({ name, stream, muted, mirror }: { name: string; stream: MediaStream | null; muted?: boolean; mirror?: boolean }) {
  const media = useCallStore((s) => s.meeting?.media)
  const meetVersion = useCallStore((s) => s.meetVersion)
  const mediaRef = useRef<HTMLVideoElement>(null)

  // 绑定媒体流（ontrack 后 meetVersion 自增触发重绑）
  useEffect(() => {
    if (mediaRef.current) mediaRef.current.srcObject = stream
  }, [stream, meetVersion])

  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      <video
        ref={mediaRef}
        autoPlay
        playsInline
        muted={muted}
        className={cn('h-full w-full', media === 'VIDEO' && stream && 'object-cover', mirror && 'scale-x-[-1]')}
      />
      {(!stream || media !== 'VIDEO') && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-primary/10 to-transparent">
          <Avatar name={name} size={48} />
        </div>
      )}
      <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{name}</span>
    </div>
  )
}

function MeetingPanel() {
  const meeting = useCallStore((s) => s.meeting)!
  const meetMembers = useCallStore((s) => s.meetMembers)
  const toggleMeetMute = useCallStore((s) => s.toggleMeetMute)
  const toggleMeetCam = useCallStore((s) => s.toggleMeetCam)
  const leaveMeeting = useCallStore((s) => s.leaveMeeting)
  const selfName = useAuthStore((s) => s.user?.nickname || s.user?.username || '我')

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[26rem] overflow-hidden rounded-2xl border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-sm font-semibold">{meeting.groupName} · 会议</p>
        <span className="text-xs text-muted-foreground">{meetMembers.length + 1} 人</span>
      </div>
      <div className="grid h-72 auto-rows-fr grid-cols-2 gap-1 bg-black p-1">
        <MeetingTile name={selfName} stream={getMeetingLocalStream()} muted mirror />
        {meetMembers.map((m) => (
          <MeetingTile key={m.userId} name={m.name} stream={getMeetingStream(m.userId)} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 border-t py-3">
        <Button
          variant="outline"
          size="icon"
          className={cn('h-10 w-10 rounded-full', meeting.muted && 'bg-red-500 text-white hover:bg-red-600')}
          title={meeting.muted ? '取消静音' : '静音'}
          onClick={toggleMeetMute}
        >
          {meeting.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        {meeting.media === 'VIDEO' && (
          <Button
            variant="outline"
            size="icon"
            className={cn('h-10 w-10 rounded-full', meeting.camOff && 'bg-red-500 text-white hover:bg-red-600')}
            title={meeting.camOff ? '开启摄像头' : '关闭摄像头'}
            onClick={toggleMeetCam}
          >
            {meeting.camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </Button>
        )}
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-red-500 text-white hover:bg-red-600"
          title="离开会议"
          onClick={leaveMeeting}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
