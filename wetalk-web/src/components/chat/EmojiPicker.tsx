import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const EMOJIS = [
  '😀', '😄', '😂', '🤣', '😊', '😇', '🙂', '😉',
  '😍', '🥰', '😘', '😜', '🤪', '🤗', '🤔', '🤭',
  '😴', '😪', '😮', '😯', '😅', '😥', '😭', '😤',
  '😡', '🤬', '😱', '🥵', '🥶', '😵', '🤯', '🥳',
  '👍', '👎', '👌', '✌️', '🤝', '🙏', '💪', '👏',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '💔', '💯',
  '🎉', '🎊', '🎂', '🌹', '☕', '🍺', '🍉', '🍬',
  '🐶', '🐱', '🐼', '🦊', '🌟', '⚡', '🔥', '🌈'
]

export function EmojiPicker({
  onPick,
  onClose
}: {
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // 点击面板外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // 延迟注册，避免打开面板的同一点击立即触发关闭
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className={cn(
        'z-10 w-80 rounded-lg border bg-card p-2 shadow-lg',
        'grid grid-cols-8 gap-0.5'
      )}
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onPick(emoji)}
          className="rounded p-1 text-xl transition-colors hover:bg-accent"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
