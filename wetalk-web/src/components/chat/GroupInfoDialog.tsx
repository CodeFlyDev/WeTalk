import { useEffect, useState } from 'react'
import { Download, FileText, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { errorMessage, formatTime } from '@/lib/utils'
import { groupApi } from '@/api/groups'
import { messageApi } from '@/api/messages'
import { getFileUrl } from '@/api/files'
import { useChatStore, type Conversation } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import type { GroupFileView, GroupView } from '@/types/api'

/** 群信息：公告（群主/管理员可编辑）+ 群文件（聚合群内 FILE 消息） */
export default function GroupInfoDialog({
  conversation,
  open,
  onClose
}: {
  conversation: Conversation
  open: boolean
  onClose: () => void
}) {
  const groupId = conversation.groupId
  const selfId = useAuthStore((s) => s.user?.id)
  const refreshGroups = useChatStore((s) => s.refreshGroups)
  const [detail, setDetail] = useState<GroupView | null>(null)
  const [files, setFiles] = useState<GroupFileView[]>([])
  const [loading, setLoading] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'announcement' | 'files'>('announcement')

  const canEdit =
    detail != null && selfId != null &&
    (detail.ownerId === selfId || detail.members.some((m) => m.userId === selfId && m.role === 'ADMIN'))

  useEffect(() => {
    if (!open || groupId == null) return
    setEditing(false)
    setTab('announcement')
    setLoading(true)
    Promise.all([groupApi.detail(groupId), messageApi.groupFiles(groupId).catch(() => [])])
      .then(([g, fs]) => {
        setDetail(g)
        setAnnouncement(g.announcement ?? '')
        setFiles(fs)
      })
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [open, groupId])

  async function saveAnnouncement() {
    if (groupId == null || saving) return
    setSaving(true)
    try {
      const g = await groupApi.setAnnouncement(groupId, announcement)
      setDetail(g)
      setEditing(false)
      toast.success('群公告已更新')
      void refreshGroups()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={conversation.name} className="max-w-lg">
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 成员概览 */}
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{detail?.members.length ?? 0} 名成员</span>
            <span className="line-clamp-1">
              {(detail?.members ?? [])
                .slice(0, 6)
                .map((m) => m.nickname || m.username)
                .join('、')}
            </span>
          </div>

          {/* Tab 切换 */}
          <div className="mb-3 flex gap-1 rounded-lg bg-muted p-1 text-xs">
            {(
              [
                ['announcement', '群公告'],
                ['files', `群文件 (${files.length})`]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={
                  'flex-1 rounded-md px-2 py-1.5 transition-colors ' +
                  (tab === key ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')
                }
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'announcement' ? (
            <div>
              {editing ? (
                <>
                  <textarea
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    rows={4}
                    maxLength={1024}
                    placeholder="输入群公告…"
                    className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                      取消
                    </Button>
                    <Button size="sm" onClick={() => void saveAnnouncement()} disabled={saving}>
                      {saving ? '保存中…' : '保存'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-md bg-muted/50 px-3 py-2.5 text-sm">
                  {detail?.announcement ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{detail.announcement}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">暂无公告</p>
                  )}
                  {canEdit && (
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => setEditing(true)}>
                      {detail?.announcement ? '编辑公告' : '写公告'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="scrollbar-thin max-h-64 space-y-1 overflow-y-auto">
              {files.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  群内还没有文件，发送文件后自动归集到这里
                </p>
              )}
              {files.map((f) => (
                <FileRow key={f.messageId} file={f} />
              ))}
            </div>
          )}
        </>
      )}
    </Dialog>
  )
}

function FileRow({ file }: { file: GroupFileView }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (file.objectKey) void getFileUrl(file.objectKey).then(setUrl).catch(() => undefined)
  }, [file.objectKey])

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
      onClick={(e) => !url && e.preventDefault()}
    >
      <FileText className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1 truncate">{file.fileName}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(file.createdAt)}</span>
      <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </a>
  )
}
