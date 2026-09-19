import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Heart, Image as ImageIcon, Loader2, Send as SendIcon, Trash2, X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn, errorMessage, formatTime, newClientMsgId } from '@/lib/utils'
import { uploadFile, getFileUrl } from '@/api/files'
import { postApi, type PostView } from '@/api/social'
import { useAuthStore } from '@/store/auth'

/** 朋友圈：发布（文字 + 最多 9 图）+ feed（好友 + 自己）+ 点赞 / 评论 / 删除 */
export default function MomentsPage() {
  const navigate = useNavigate()
  const self = useAuthStore((s) => s.user)
  const [posts, setPosts] = useState<PostView[]>([])
  const [content, setContent] = useState('')
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [pending, setPending] = useState<{ file: File; key: string }[]>([])
  const [commentFor, setCommentFor] = useState<number | null>(null)
  const [commentText, setCommentText] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    postApi
      .feed()
      .then(setPosts)
      .catch((err) => toast.error(errorMessage(err)))
  }, [])

  /** 选图 → presign 直传，攒 objectKey 待发布 */
  async function onPickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    if (pending.length + files.length > 9) {
      toast.error('最多 9 张图')
      return
    }
    setUploading(true)
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => ({ file, key: (await uploadFile(file, newClientMsgId())).objectKey }))
      )
      setPending((prev) => [...prev, ...uploaded])
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  async function publish() {
    if (!content.trim() || publishing) return
    setPublishing(true)
    try {
      const view = await postApi.publish(content.trim(), pending.map((p) => p.key))
      setPosts((prev) => [view, ...prev])
      setContent('')
      setPending([])
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPublishing(false)
    }
  }

  function replacePost(view: PostView) {
    setPosts((prev) => prev.map((p) => (p.id === view.id ? view : p)))
  }

  async function toggleLike(post: PostView) {
    try {
      if (post.likedByMe) await postApi.unlike(post.id)
      else await postApi.like(post.id)
      replacePost(await postApi.detail(post.id))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function submitComment(id: number) {
    if (!commentText.trim()) return
    try {
      const view = await postApi.comment(id, commentText.trim())
      replacePost(view)
      setCommentText('')
      setCommentFor(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function removePost(id: number) {
    try {
      await postApi.remove(id)
      setPosts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col">
      {/* 顶栏 */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} title="返回">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">朋友圈</h1>
      </div>

      {/* 发布框 */}
      <div className="shrink-0 space-y-2 border-b bg-card p-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="分享此刻的想法…"
          className="w-full resize-none rounded-md bg-background px-3 py-2 text-sm outline-none ring-1 ring-border placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        {pending.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pending.map((p, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                <ImageIcon className="h-3 w-3" />
                {p.file.name.slice(0, 16)}
                <button onClick={() => setPending((prev) => prev.filter((_, j) => j !== i))}>
                  <X className="h-3 w-3 hover:text-red-500" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-1 h-4 w-4" />}
            图片（{pending.length}/9）
          </Button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void onPickImages(e)}
          />
          <Button size="sm" className="ml-auto" onClick={() => void publish()} disabled={!content.trim() || publishing}>
            {publishing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} 发布
          </Button>
        </div>
      </div>

      {/* 动态流 */}
      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {posts.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">还没有动态，发第一条吧</p>
        )}
        {posts.map((p) => (
          <div key={p.id} className="flex gap-2.5 rounded-lg border bg-card p-3">
            <Avatar name={p.authorName} size={38} src={p.authorAvatar} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  {p.authorId === self?.id ? '我' : p.authorName}
                </span>
                <span className="text-[11px] text-muted-foreground">{formatTime(p.createdAt)}</span>
                {p.authorId === self?.id && (
                  <button
                    className="ml-auto rounded p-1 text-muted-foreground hover:text-red-500"
                    onClick={() => void removePost(p.id)}
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{p.content}</p>
              {p.imageKeys.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {p.imageKeys.map((k) => (
                    <FeedImage key={k} objectKey={k} />
                  ))}
                </div>
              )}
              {/* 点赞 / 评论 */}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <button
                  className={cn('flex items-center gap-1 hover:text-red-500', p.likedByMe && 'text-red-500')}
                  onClick={() => void toggleLike(p)}
                >
                  <Heart className={cn('h-3.5 w-3.5', p.likedByMe && 'fill-current')} />
                  {p.likeCount > 0 ? p.likeCount : '赞'}
                </button>
                <button className="hover:text-foreground" onClick={() => setCommentFor(commentFor === p.id ? null : p.id)}>
                  评论
                </button>
              </div>
              {commentFor === p.id && (
                <div className="mt-2 flex gap-1.5">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void submitComment(p.id)}
                    maxLength={500}
                    autoFocus
                    placeholder="写下评论…"
                    className="min-w-0 flex-1 rounded-md bg-background px-2.5 py-1.5 text-xs outline-none ring-1 ring-border focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button size="sm" variant="outline" onClick={() => void submitComment(p.id)}>
                    <SendIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {p.comments.length > 0 && (
                <div className="mt-2 space-y-1 rounded-md bg-muted/60 px-2.5 py-2">
                  {p.comments.map((c) => (
                    <p key={c.id} className="text-xs leading-relaxed">
                      <span className="font-medium">{c.userId === self?.id ? '我' : c.userName}</span>
                      <span className="mx-1 text-muted-foreground">{formatTime(c.createdAt)}</span>
                      <span className="break-words">{c.content}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeedImage({ objectKey }: { objectKey: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    void getFileUrl(objectKey).then(setUrl).catch(() => undefined)
  }, [objectKey])
  if (!url) {
    return <div className="aspect-square animate-pulse rounded bg-muted" />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="动态图片" loading="lazy" className="aspect-square w-full rounded object-cover" />
    </a>
  )
}
