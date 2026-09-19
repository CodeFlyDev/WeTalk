import { useState } from 'react'
import { Check, ListTodo, Star, UserPlus, Users, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn, formatTime, ConversationIds } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import AddFriendDialog from './AddFriendDialog'
import CreateGroupDialog from './CreateGroupDialog'
import FavoritesDialog from '@/components/chat/FavoritesDialog'
import TodoDialog from '@/components/chat/TodoDialog'

/** 通讯录：好友请求 / 好友列表 / 群列表 + 添加好友 / 创建群 / 我的收藏 */
export default function ContactsPanel() {
  const [addFriendOpen, setAddFriendOpen] = useState(false)
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [favoritesOpen, setFavoritesOpen] = useState(false)
  const [todoOpen, setTodoOpen] = useState(false)

  const selfId = useAuthStore((s) => s.user!.id)
  const friends = useChatStore((s) => s.friends)
  const groups = useChatStore((s) => s.groups)
  const friendRequests = useChatStore((s) => s.friendRequests)
  const acceptRequest = useChatStore((s) => s.acceptRequest)
  const removeFriend = useChatStore((s) => s.removeFriend)
  const openConversation = useChatStore((s) => s.openConversation)

  return (
    <div className="scrollbar-thin flex-1 overflow-y-auto">
      {/* 操作按钮 */}
      <div className="flex gap-2 border-b p-3">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setAddFriendOpen(true)}>
          <UserPlus className="h-4 w-4" /> 添加好友
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setCreateGroupOpen(true)}>
          <Users className="h-4 w-4" /> 创建群聊
        </Button>
      </div>

      {/* 我的收藏 / 我的待办 */}
      <button
        className="flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
        onClick={() => setFavoritesOpen(true)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <Star className="h-5 w-5" />
        </span>
        我的收藏
      </button>
      <button
        className="flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
        onClick={() => setTodoOpen(true)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <ListTodo className="h-5 w-5" />
        </span>
        我的待办
      </button>

      {/* 好友请求 */}
      {friendRequests.length > 0 && (
        <section>
          <h3 className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
            好友请求（{friendRequests.length}）
          </h3>
          {friendRequests.map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 px-3 py-2">
              <Avatar
                name={r.fromUser.nickname || r.fromUser.username}
                size={36}
                src={r.fromUser.avatarUrl}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {r.fromUser.nickname || r.fromUser.username}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.remark ? `留言：${r.remark} · ` : ''}
                  {formatTime(r.createdAt)}
                </p>
              </div>
              <Button size="sm" onClick={() => void acceptRequest(r.id)}>
                <Check className="h-4 w-4" /> 接受
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* 好友 */}
      <section>
        <h3 className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
          好友（{friends.length}）
        </h3>
        {friends.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">暂无好友</p>}
        {friends.map((f) => {
          const name = f.nickname || f.username
          return (
            <div
              key={f.id}
              className="group flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent"
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                onClick={() => void openConversation(ConversationIds.dm(selfId, f.id))}
              >
                <Avatar name={name} size={36} src={f.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">ID: {f.id}</p>
                </div>
              </button>
              <Button
                size="sm"
                variant="ghost"
                className={cn('opacity-0 transition-opacity group-hover:opacity-100')}
                title="删除好友"
                onClick={() => void removeFriend(f.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </section>

      {/* 群聊 */}
      <section>
        <h3 className="px-3 pb-1 pt-3 text-xs font-medium text-muted-foreground">
          群聊（{groups.length}）
        </h3>
        {groups.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">暂未加入任何群</p>
        )}
        {groups.map((g) => (
          <button
            key={g.id}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent"
            onClick={() => void openConversation(ConversationIds.group(g.id))}
          >
            <Avatar name={g.name} size={36} src={g.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{g.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {g.members?.length ?? 0} 人
              </p>
            </div>
          </button>
        ))}
      </section>

      <AddFriendDialog open={addFriendOpen} onClose={() => setAddFriendOpen(false)} />
      <CreateGroupDialog open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />
      <FavoritesDialog open={favoritesOpen} onClose={() => setFavoritesOpen(false)} />
      <TodoDialog open={todoOpen} onClose={() => setTodoOpen(false)} />
    </div>
  )
}
