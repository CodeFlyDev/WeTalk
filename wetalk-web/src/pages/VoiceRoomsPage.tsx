import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Crown, Loader2, Mic, MicOff, PhoneOff, Plus, Radio, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Avatar } from '@/components/ui/avatar'
import { cn, errorMessage } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useVoiceRoomStore, getRoomStream } from '@/webrtc/voiceRoom'
import { voipApi } from '@/api/voip'
import type { VoiceRoomView } from '@/types/api'

/** 在线语音房间：房间列表（创建/解散）+ 房间内 mesh 语音（成员瓦片 + 静音/离开） */
export default function VoiceRoomsPage() {
  const navigate = useNavigate()
  const self = useAuthStore((s) => s.user)
  const [rooms, setRooms] = useState<VoiceRoomView[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const room = useVoiceRoomStore((s) => s.room)
  const members = useVoiceRoomStore((s) => s.members)
  const muted = useVoiceRoomStore((s) => s.muted)
  const version = useVoiceRoomStore((s) => s.version)
  const join = useVoiceRoomStore((s) => s.join)
  const leave = useVoiceRoomStore((s) => s.leave)
  const toggleMute = useVoiceRoomStore((s) => s.toggleMute)

  async function refresh() {
    try {
      setRooms(await voipApi.list())
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  useEffect(() => {
    void refresh()
    // 离开页面时若在房间中则退出
    return () => {
      if (useVoiceRoomStore.getState().room) useVoiceRoomStore.getState().leave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onCreate() {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      await voipApi.create(newName.trim())
      setNewName('')
      setCreateOpen(false)
      await refresh()
      toast.success('房间已创建')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  async function onDissolve(id: number) {
    try {
      await voipApi.dissolve(id)
      await refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function onJoin(r: VoiceRoomView) {
    await join(r)
    await refresh()
  }

  async function onLeave() {
    leave()
    await refresh()
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* 顶栏 */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-medium">语音房间</h1>
        <span className="text-xs text-muted-foreground">加入即开麦 · mesh 直连 · 上限 8 人</span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 房间列表 */}
        <div className="scrollbar-thin w-80 shrink-0 overflow-y-auto border-r p-3">
          <Button className="mb-3 w-full" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> 创建房间
          </Button>
          {rooms === null && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
            </p>
          )}
          {rooms?.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">还没有房间，创建一个吧</p>
          )}
          {rooms?.map((r) => (
            <div
              key={r.id}
              className={cn(
                'mb-2 flex items-center gap-2.5 rounded-lg border p-3',
                room?.id === r.id && 'border-primary bg-primary/5'
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Radio className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-medium">
                  {r.name}
                  {r.mine && <Crown className="h-3 w-3 text-amber-500" />}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" /> {r.onlineCount} 人在线 · {r.ownerName}
                </p>
              </div>
              {r.mine && (
                <Button size="sm" variant="ghost" title="解散房间" onClick={() => void onDissolve(r.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
              {room?.id === r.id ? (
                <Button size="sm" variant="destructive" onClick={() => void onLeave()}>
                  离开
                </Button>
              ) : (
                <Button size="sm" onClick={() => void onJoin(r)}>加入</Button>
              )}
            </div>
          ))}
        </div>

        {/* 房间内 */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-6 p-6">
          {!room ? (
            <div className="text-center text-sm text-muted-foreground">
              <Mic className="mx-auto mb-3 h-10 w-10 opacity-40" />
              选择左侧房间加入，与在线的朋友即时语音
            </div>
          ) : (
            <>
              <h2 className="text-lg font-medium">{room.name}</h2>
              <div className="flex flex-wrap items-start justify-center gap-5">
                <MemberTile name={self?.nickname || self?.username || '我'} isSelf muted={muted} />
                {members.map((m) => (
                  <MemberTile key={m.userId} userId={m.userId} name={m.name} muted={false} />
                ))}
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground">等待其他成员加入…（双方进入后自动接通）</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button size="lg" variant={muted ? 'destructive' : 'secondary'} onClick={toggleMute}>
                  {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  {muted ? '已静音' : '静音'}
                </Button>
                <Button size="lg" variant="destructive" onClick={() => void onLeave()}>
                  <PhoneOff className="h-5 w-5" /> 离开房间
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="创建语音房间" className="max-w-sm">
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={newName}
            maxLength={20}
            placeholder="房间名（最多 20 字）"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCreate()}
          />
          <Button onClick={() => void onCreate()} disabled={creating || !newName.trim()}>
            {creating && <Loader2 className="h-4 w-4 animate-spin" />} 创建
          </Button>
        </div>
      </Dialog>

      {/* 远端音频挂载（key 随成员集变化重建，srcObject 在 RemoteAudio 内绑定） */}
      {members.map((m) => (
        <RemoteAudio key={`${m.userId}-${version}`} userId={m.userId} />
      ))}
    </div>
  )
}

function MemberTile({
  userId,
  name,
  isSelf,
  muted
}: {
  userId?: number
  name: string
  isSelf?: boolean
  muted: boolean
}) {
  return (
    <div className="flex w-28 flex-col items-center gap-2">
      <div className="relative">
        <Avatar name={name} size={72} />
        {muted && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white">
            <MicOff className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <span className="max-w-full truncate text-xs text-muted-foreground">
        {name}
        {isSelf ? '（我）' : ''}
      </span>
    </div>
  )
}

/** 单个远端成员音频（srcObject 绑定不走 src 属性） */
function RemoteAudio({ userId }: { userId: number }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const el = ref.current
    const stream = getRoomStream(userId)
    if (el && stream) {
      el.srcObject = stream
      el.play().catch(() => undefined)
    }
  }, [userId])
  return <audio ref={ref} autoPlay className="hidden" />
}
