import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { cn, errorMessage } from '@/lib/utils'
import { userApi } from '@/api/users'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import type { UserView } from '@/types/api'

/** 搜索用户并发送好友请求：支持用户名 / 昵称模糊搜索，纯数字自动尝试按 ID 精确查找 */
export default function AddFriendDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selfId = useAuthStore((s) => s.user!.id)
  const addFriend = useChatStore((s) => s.addFriend)
  const [keyword, setKeyword] = useState('')
  const [remark, setRemark] = useState('')
  const [results, setResults] = useState<UserView[]>([])
  const [selected, setSelected] = useState<UserView | null>(null)
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState(false)

  function reset() {
    setKeyword('')
    setRemark('')
    setResults([])
    setSelected(null)
  }

  async function search() {
    const kw = keyword.trim()
    if (!kw) return
    setSearching(true)
    try {
      let list = await userApi.search(kw)
      // 纯数字且模糊搜索无结果 → 尝试按 ID 精确查找
      if (list.length === 0 && /^\d+$/.test(kw)) {
        try {
          list = [await userApi.byId(Number(kw))]
        } catch {
          /* 保持空结果 */
        }
      }
      setResults(list.filter((u) => u.id !== selfId))
      setSelected(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSearching(false)
    }
  }

  async function send() {
    if (!selected) return
    setSending(true)
    try {
      await addFriend(selected.id, remark.trim() || undefined)
      reset()
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="添加好友">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="用户名 / 昵称 / 用户 ID"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
          />
          <Button onClick={() => void search()} disabled={searching || !keyword.trim()}>
            {searching ? '查找中…' : '搜索'}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="scrollbar-thin max-h-56 space-y-0.5 overflow-y-auto rounded-md border p-1">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded p-2 text-left transition-colors hover:bg-accent',
                  selected?.id === u.id && 'bg-accent'
                )}
              >
                <Avatar name={u.nickname || u.username} size={32} src={u.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.nickname || u.username}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    @{u.username} · ID: {u.id}
                  </p>
                </div>
                <input type="radio" checked={selected?.id === u.id} readOnly className="pointer-events-none" />
              </button>
            ))}
          </div>
        )}
        {results.length === 0 && keyword.trim() && !searching && selected === null && (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            点击「搜索」查找用户
          </p>
        )}

        <Input
          placeholder="验证留言（选填）"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          maxLength={64}
        />

        <Button className="w-full" disabled={!selected || sending} onClick={() => void send()}>
          {sending ? '发送中…' : selected ? `向 ${selected.nickname || selected.username} 发送好友请求` : '发送好友请求'}
        </Button>
      </div>
    </Dialog>
  )
}
