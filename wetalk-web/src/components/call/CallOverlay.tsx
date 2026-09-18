import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, MonitorUp, Phone, PhoneOff, Video, VideoOff } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getLocalStream, getRemoteStream, useCallStore } from '@/webrtc/call'

/** 通话浮层：来电弹窗 + 通话中悬浮面板（App 级挂载，任意页面可接听） */
export default function CallOverlay() {
  const active = useCallStore((s) => s.active)
  const incoming = useCallStore((s) => s.incoming)
  if (!active && !incoming) return null

  return (
    <>
      {incoming && <IncomingDialog />}
      {active && <ActivePanel />}
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
