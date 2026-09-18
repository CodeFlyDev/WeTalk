import { cn } from '@/lib/utils'

interface AvatarProps {
  name: string
  src?: string | null
  size?: number
  className?: string
}

/** 首字母头像（有图片用图片，否则用首字符 + 稳定配色） */
export function Avatar({ name, src, size = 40, className }: AvatarProps) {
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444']
  const color = palette[hashString(name) % palette.length]

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.42 }}
      className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white',
        className
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
