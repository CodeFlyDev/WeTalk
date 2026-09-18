import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { errorMessage } from '@/lib/utils'
import { userApi } from '@/api/users'
import { useChatStore } from '@/store/chat'
import type { UserView } from '@/types/api'

/** 通过用户 ID 查找并发送好友请求（P0：后端暂无按用户名搜索接口） */
export default function AddFriendDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addFriend = useChatStore((s) => s.addFriend)
  const [userIdInput, setUserIdInput] = useState('')
  const [remark, setRemark] = useState('')
  const [found, setFound] = useState<UserView | null>(null)
  const [searching, setSearching] = useState(false)
  const [sending, setSending] = useState(false)

  function reset() {
    setUserIdInput('')
    setRemark('')
    setFound(null)
  }

  async function search() {
    const id = Number(userIdInput.trim())
    if (!Number.isInteger(id) || id <= 0) {
      toast.error('请输入有效的用户 ID（正整数）')
      return
    }
    setSearching(true)
    try {
      const user = await userApi.byId(id)
      setFound(user)
    } catch (err) {
      setFound(null)
      toast.error(errorMessage(err))
    } finally {
      setSearching(false)
    }
  }

  async function send() {
    if (!found) return
    setSending(true)
    try {
      await addFriend(found.id, remark.trim() || undefined)
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
            placeholder="输入对方用户 ID"
            value={userIdInput}
            onChange={(e) => {
              setUserIdInput(e.target.value.replace(/\D/g, ''))
              setFound(null)
            }}
            inputMode="numeric"
          />
          <Button onClick={() => void search()} disabled={searching || !userIdInput}>
            {searching ? '查找中…' : '查找'}
          </Button>
        </div>

        {found && (
          <div className="flex items-center gap-3 rounded-md border bg-secondary/40 p-3">
            <Avatar name={found.nickname || found.username} size={40} src={found.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{found.nickname || found.username}</p>
              <p className="truncate text-xs text-muted-foreground">
                @{found.username} · ID: {found.id}
              </p>
            </div>
          </div>
        )}

        <Input
          placeholder="验证留言（选填）"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          maxLength={64}
        />

        <Button className="w-full" disabled={!found || sending} onClick={() => void send()}>
          {sending ? '发送中…' : '发送好友请求'}
        </Button>
      </div>
    </Dialog>
  )
}
