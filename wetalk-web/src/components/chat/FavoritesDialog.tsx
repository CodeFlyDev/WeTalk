import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, Star, Trash2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { favoriteApi, type FavoriteView } from '@/api/favorites'
import { cn, errorMessage, formatTime } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { getFileUrl } from '@/api/files'

/** 收藏项摘要（对齐会话列表预览风格） */
function previewOf(f: FavoriteView): string {
  if (f.type === 'IMAGE') return '[图片]'
  if (f.type === 'FILE') return `[文件] ${f.content ?? ''}`
  if (f.type === 'VOICE') return `[语音] ${f.content ?? ''}″`
  if (f.type === 'VIDEO') return `[视频] ${f.content ?? ''}″`
  if (f.type === 'RED_PACKET') return '[红包]'
  return f.content ?? ''
}

/** 我的收藏：列表 + 跳转原会话 + 取消收藏 */
export default function FavoritesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<FavoriteView[] | null>(null)
  const selfId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    if (open) {
      setItems(null)
      favoriteApi
        .list()
        .then(setItems)
        .catch((err) => {
          setItems([])
          toast.error(errorMessage(err))
        })
    }
  }, [open])

  /** 跳转原会话（会话缺失时本地补建占位，后台刷新修正） */
  function jump(f: FavoriteView) {
    const store = useChatStore.getState()
    if (!store.conversations.some((c) => c.id === f.conversationId)) {
      if (f.conversationId.startsWith('g:')) {
        const groupId = Number(f.conversationId.slice(2))
        store.ensureConversation({ id: f.conversationId, type: 'group', groupId, name: '群聊' })
        void store.refreshGroups()
      } else {
        const [a, b] = f.conversationId.slice(3).split(':').map(Number)
        const peer = a === selfId ? b : a
        store.ensureConversation({
          id: f.conversationId,
          type: 'dm',
          peerId: peer,
          name: `用户 ${peer}`
        })
        void store.refreshFriends()
      }
    }
    void store.openConversation(f.conversationId)
    onClose()
  }

  async function remove(f: FavoriteView) {
    try {
      await favoriteApi.remove(f.messageId)
      setItems((prev) => (prev ? prev.filter((i) => i.messageId !== f.messageId) : prev))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="我的收藏">
      <div className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto">
        {items === null && (
          <p className="py-6 text-center text-xs text-muted-foreground">加载中…</p>
        )}
        {items !== null && items.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            还没有收藏，悬停消息点 ☆ 收藏
          </p>
        )}
        {items?.map((f) => (
          <div
            key={f.id}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
          >
            <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => jump(f)}>
              {f.type === 'FILE' && f.refObjectKey ? (
                <FileText className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Star className="h-4 w-4 shrink-0 text-amber-500" />
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{previewOf(f)}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(f.createdAt)}</span>
            </button>
            {f.type === 'FILE' && f.refObjectKey && (
              <button
                title="下载"
                className={cn('shrink-0 rounded p-1 text-muted-foreground hover:text-foreground')}
                onClick={async () => {
                  const url = await getFileUrl(f.refObjectKey!).catch(() => null)
                  if (url) window.open(url, '_blank')
                }}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              title="取消收藏"
              className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              onClick={() => void remove(f)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>
          关闭
        </Button>
      </div>
    </Dialog>
  )
}
