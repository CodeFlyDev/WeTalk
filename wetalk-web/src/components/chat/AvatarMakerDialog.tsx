import { useCallback, useEffect, useRef, useState } from 'react'
import { Dices, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Avatar } from '@/components/ui/avatar'
import { errorMessage } from '@/lib/utils'
import { uploadFile } from '@/api/files'
import { userApi } from '@/api/users'
import { useAuthStore } from '@/store/auth'
import type { UserView } from '@/types/api'

const BG_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#64748b']
const FG_COLORS = ['#ffffff', '#1e293b', '#fde047', '#a7f3d0']
const STICKERS = ['', '😀', '😎', '🐱', '🚀', '🌟', '🍀', '🔥']

/**
 * 虚拟头像合成器：canvas 像素风图案（底色 + 对称色块 + 可选表情贴纸）
 * → 生成 256×256 PNG → presign 直传 MinIO → PUT /api/users/me/avatar。
 */
export default function AvatarMakerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bg, setBg] = useState(0)
  const [fg, setFg] = useState(0)
  const [sticker, setSticker] = useState(0)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000))
  const [saving, setSaving] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const N = 5 // 5×5 对称网格（镜像左侧 3 列）
    const cell = 256 / N
    // 简单可复现的伪随机（mulberry32）
    let s = seed
    const rand = () => {
      s |= 0
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    ctx.fillStyle = BG_COLORS[bg]
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = FG_COLORS[fg]
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < Math.ceil(N / 2); x++) {
        if (rand() > 0.45) {
          ctx.fillRect(x * cell, y * cell, cell, cell)
          ctx.fillRect((N - 1 - x) * cell, y * cell, cell, cell)
        }
      }
    }
    const emoji = STICKERS[sticker]
    if (emoji) {
      ctx.font = '120px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(emoji, 128, 132)
    }
  }, [bg, fg, sticker, seed])

  useEffect(() => {
    if (open) draw()
  }, [open, draw])

  async function save() {
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('canvas 导出失败')
      const file = new File([blob], 'avatar.png', { type: 'image/png' })
      const presign = await uploadFile(file, `avatar-${Date.now()}`)
      const user: UserView = await userApi.updateAvatar(presign.objectKey)
      setUser(user)
      toast.success('头像已更新')
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="虚拟头像" className="max-w-sm">
      <div className="flex flex-col items-center gap-4">
        <canvas
          ref={canvasRef}
          width={256}
          height={256}
          className="h-40 w-40 cursor-pointer rounded-full"
          onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}
          title="点击图案随机换样式"
        />

        <Row label="底色">
          {BG_COLORS.map((c, i) => (
            <button
              key={c}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 rounded-full ring-offset-2 ${bg === i ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setBg(i)}
            />
          ))}
        </Row>
        <Row label="图案色">
          {FG_COLORS.map((c, i) => (
            <button
              key={c}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 rounded-full border ring-offset-2 ${fg === i ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setFg(i)}
            />
          ))}
        </Row>
        <Row label="贴纸">
          {STICKERS.map((s, i) => (
            <button
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ring-offset-2 ${
                sticker === i ? 'bg-muted ring-2 ring-primary' : 'bg-muted/50'
              }`}
              onClick={() => setSticker(i)}
            >
              {s || '无'}
            </button>
          ))}
        </Row>

        <div className="flex w-full gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}>
            <Dices className="h-4 w-4" /> 随机图案
          </Button>
          <Button className="flex-1" onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} 保存头像
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          当前
          <SelfAvatar />
        </div>
      </div>
    </Dialog>
  )
}

function SelfAvatar() {
  const user = useAuthStore((s) => s.user)
  return <Avatar name={user?.nickname || user?.username || '?'} size={24} src={user?.avatarUrl} />
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="w-14 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
