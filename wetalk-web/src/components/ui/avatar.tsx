import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { getFileUrl } from '@/api/files'

interface AvatarProps {
  name: string
  /** 真实 URL 或 MinIO objectKey（自动解析） */
  src?: string | null
  size?: number
  className?: string
}

/** objectKey → 下载 URL 会话级缓存（跨 Avatar 实例复用，避免重复请求） */
const objectUrlCache = new Map<string, string>()

/** 首字母头像（有图片用图片，否则用首字符 + 稳定配色） */
export function Avatar({ name, src, size = 40, className }: AvatarProps) {
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444']
  const color = palette[hashString(name) % palette.length]
  const [url, setUrl] = useState<string | null>(() => resolveSync(src))

  useEffect(() => {
    let cancelled = false
    const resolved = resolveSync(src)
    if (resolved) {
      setUrl(resolved)
      return
    }
    setUrl(null)
    if (src) {
      const cached = objectUrlCache.get(src)
      if (cached) {
        setUrl(cached)
        return
      }
      getFileUrl(src)
        .then((u) => {
          objectUrlCache.set(src, u)
          if (!cancelled) setUrl(u)
        })
        .catch(() => {
          // 解析失败回退首字母占位
        })
    }
    return () => {
      cancelled = true
    }
  }, [src])

  if (url) {
    return (
      <img
        src={url}
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

/** http(s) URL 直接可用；objectKey 需异步解析 */
function resolveSync(src?: string | null): string | null {
  if (!src) return null
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:')) return src
  return objectUrlCache.get(src) ?? null
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
