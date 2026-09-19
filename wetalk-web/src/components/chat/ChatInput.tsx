import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { Clock, FileUp, Flame, Image as ImageIcon, Mic, Smile, Sticker, Trash2, Send as SendIcon, Video as VideoIcon, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { encrypt } from '@/lib/e2ee'
import { EmojiPicker } from './EmojiPicker'
import RedPacketDialog from './RedPacketDialog'
import ScheduleDialog from './ScheduleDialog'
import StickerDialog from './StickerDialog'
import { previewOf } from './MessageItem'
import type { Conversation, SendOptions } from '@/store/chat'
import { useChatStore } from '@/store/chat'
import { useAuthStore } from '@/store/auth'
import { socket } from '@/ws/socket'
import { fileFromPath, isTauri, pickFile } from '@/lib/desktop'

/** 录音/录制上限（秒），与后端 MAX 限制对齐 */
const MAX_RECORD_SECONDS = 60

/** 输入区：文本（Enter 发送 / Shift+Enter 换行）+ 表情面板 + 图片/文件/音视频发送 + 引用回复 + @ 提及 */
export default function ChatInput({ conversation }: { conversation: Conversation }) {
  const sendText = useChatStore((s) => s.sendText)
  const sendFile = useChatStore((s) => s.sendFile)
  const sendVoice = useChatStore((s) => s.sendVoice)
  const sendVideo = useChatStore((s) => s.sendVideo)
  const replyTo = useChatStore((s) => s.replyTo)
  const setReplyTo = useChatStore((s) => s.setReplyTo)
  const groups = useChatStore((s) => s.groups)
  const selfId = useAuthStore((s) => s.user?.id)
  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIds, setMentionIds] = useState<number[]>([])
  const [recording, setRecording] = useState(false)
  const [recordMode, setRecordMode] = useState<'voice' | 'video'>('voice')
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [rpOpen, setRpOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [stickerOpen, setStickerOpen] = useState(false)
  /** 阅后即焚（dm 限定，per-conversation 记忆） */
  const burnKey = `wetalk.burn.${conversation.id}`
  const [burnOn, setBurnOn] = useState(() => localStorage.getItem(burnKey) === '1')
  useEffect(() => {
    setBurnOn(localStorage.getItem(`wetalk.burn.${conversation.id}`) === '1')
  }, [conversation.id])
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const previewRef = useRef<HTMLVideoElement>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const secondsRef = useRef(0)
  const cancelRef = useRef(false)

  /** 录音计时清理 */
  function stopRecordTimer() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current)
      recordTimerRef.current = null
    }
  }

  function startRecording(mode: 'voice' | 'video') {
    if (recording) return
    navigator.mediaDevices
      .getUserMedia(mode === 'voice' ? { audio: true } : { audio: true, video: true })
      .then((stream) => {
        if (mode === 'video' && previewRef.current) {
          previewRef.current.srcObject = stream
        }
        const rec = new MediaRecorder(stream)
        recorderRef.current = rec
        chunksRef.current = []
        secondsRef.current = 0
        cancelRef.current = false
        setRecordMode(mode)
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          if (previewRef.current) previewRef.current.srcObject = null
          stopRecordTimer()
          const seconds = secondsRef.current
          setRecording(false)
          setRecordSeconds(0)
          recorderRef.current = null
          if (cancelRef.current || seconds < 1) {
            toast.info(cancelRef.current ? '已取消发送' : (mode === 'voice' ? '录音时间太短' : '录制时间太短'))
            return
          }
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || (mode === 'voice' ? 'audio/webm' : 'video/webm') })
          if (mode === 'voice') void sendVoice(target, blob, seconds)
          else void sendVideo(target, blob, seconds)
        }
        rec.start()
        setRecording(true)
        recordTimerRef.current = setInterval(() => {
          secondsRef.current += 1
          setRecordSeconds(secondsRef.current)
          if (secondsRef.current >= MAX_RECORD_SECONDS) {
            recorderRef.current?.state === 'recording' && recorderRef.current.stop()
          }
        }, 1000)
      })
      .catch(() => toast.error(mode === 'voice' ? '无法访问麦克风，请检查浏览器权限' : '无法访问摄像头/麦克风，请检查浏览器权限'))
  }

  function stopRecording(cancel: boolean) {
    cancelRef.current = cancel
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  const target = conversation.type === 'dm' ? { peerId: conversation.peerId } : { groupId: conversation.groupId }

  /** 群成员（排除自己），用于 @ 补全 */
  const members = useMemo(() => {
    if (conversation.type !== 'group' || conversation.groupId == null) return []
    const group = groups.find((g) => g.id === conversation.groupId)
    return (group?.members ?? []).filter((mm) => mm.userId !== selfId)
  }, [conversation.type, conversation.groupId, groups, selfId])

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return members
      .filter((mm) => !mentionIds.includes(mm.userId))
      .filter((mm) => (mm.nickname || mm.username).toLowerCase().includes(q))
      .slice(0, 8)
  }, [mentionQuery, members, mentionIds])

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionCandidates.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault()
      pickMention(mentionCandidates[0].userId, mentionCandidates[0].nickname || mentionCandidates[0].username)
      return
    }
    if (e.key === 'Escape' && mentionQuery !== null) {
      setMentionQuery(null)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  /** 光标前的 @token 检测：`@xxx` 触发补全 */
  function detectMention(value: string, caret: number) {
    if (conversation.type !== 'group') return
    const before = value.slice(0, caret)
    const match = before.match(/(^|\s)@([^\s@]*)$/)
    setMentionQuery(match ? match[2] : null)
  }

  function pickMention(userId: number, name: string) {
    const el = textareaRef.current
    const caret = el?.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/(^|\s)@([^\s@]*)$/, (_m, p1) => `${p1}@${name} `)
    const next = before + text.slice(caret)
    setText(next)
    setMentionIds((ids) => [...ids, userId])
    setMentionQuery(null)
    textareaRef.current?.focus()
  }

  async function submit() {
    const content = text.trim()
    if (!content) return
    const opts: SendOptions = {}
    if (replyTo) opts.replyToId = replyTo.id
    if (mentionIds.length > 0) opts.mentionedUserIds = mentionIds
    if (burnOn && conversation.type === 'dm') opts.burnAfterRead = true
    // 单聊 E2EE 开启时加密明文（密文前缀 e2e:，失败不发送）
    let toSend = content
    if (conversation.type === 'dm' && localStorage.getItem(`wetalk.e2ee.on.${conversation.peerId}`) === '1') {
      try {
        toSend = await encrypt(conversation.peerId!, content)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '加密失败')
        return
      }
    }
    setText('')
    setMentionIds([])
    setMentionQuery(null)
    setEmojiOpen(false)
    setReplyTo(null)
    await sendText(target, toSend, opts)
  }

  function toggleBurn() {
    setBurnOn((v) => {
      localStorage.setItem(burnKey, v ? '0' : '1')
      return !v
    })
  }

  function onPickFile(kind: 'IMAGE' | 'FILE') {
    // 桌面端走原生文件对话框（路径 → asset 协议读字节 → 复用 presign 直传链路）
    if (isTauri()) {
      void (async () => {
        const paths = await pickFile(
          kind === 'IMAGE'
            ? { filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }] }
            : undefined
        )
        const path = paths?.[0]
        if (!path) return
        const file = await fileFromPath(path)
        if (!file) {
          toast.error('读取本地文件失败')
          return
        }
        const opts: SendOptions = replyTo ? { replyToId: replyTo.id } : {}
        setReplyTo(null)
        await sendFile(target, file, kind, opts)
      })()
      return
    }
    const input = kind === 'IMAGE' ? imageInputRef.current : fileInputRef.current
    input?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, kind: 'IMAGE' | 'FILE') {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const opts: SendOptions = replyTo ? { replyToId: replyTo.id } : {}
    setReplyTo(null)
    await sendFile(target, file, kind, opts)
  }

  return (
    <div className="relative shrink-0 border-t bg-card">
      {/* 引用回复条 */}
      {replyTo && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-md border-l-2 border-primary/50 bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
          <span className="shrink-0 font-medium text-foreground">回复</span>
          <span className="line-clamp-1 flex-1">{previewOf(replyTo)}</span>
          <button
            className="rounded p-0.5 hover:bg-background"
            title="取消回复"
            onClick={() => setReplyTo(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {emojiOpen && (
        <div className="absolute bottom-full left-2 mb-2">
          <EmojiPicker
            onPick={(emoji) => setText((t) => t + emoji)}
            onClose={() => setEmojiOpen(false)}
          />
        </div>
      )}

      {/* @ 成员补全面板 */}
      {mentionCandidates.length > 0 && (
        <div className="absolute bottom-full left-2 mb-2 w-56 overflow-hidden rounded-lg border bg-popover shadow-md">
          {mentionCandidates.map((mm) => (
            <button
              key={mm.userId}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => pickMention(mm.userId, mm.nickname || mm.username)}
            >
              {mm.nickname || mm.username}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 px-3 pt-2">
        {!recording && (
          <>
            <Button variant="ghost" size="icon" title="表情" onClick={() => setEmojiOpen((v) => !v)}>
              <Smile className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="发送图片" onClick={() => onPickFile('IMAGE')}>
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="发送文件" onClick={() => onPickFile('FILE')}>
              <FileUp className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="发红包" onClick={() => setRpOpen(true)}>
              <Wallet className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="AI 表情包" onClick={() => setStickerOpen(true)}>
              <Sticker className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" title="定时发送" onClick={() => setScheduleOpen(true)}>
              <Clock className="h-5 w-5" />
            </Button>
            {conversation.type === 'dm' && (
              <Button
                variant="ghost"
                size="icon"
                title={burnOn ? '阅后即焚：已开启' : '阅后即焚：已关闭'}
                onClick={toggleBurn}
              >
                <Flame className={cn('h-5 w-5', burnOn && 'text-orange-500')} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              title="按住说话（点击开始录音）"
              onClick={() => startRecording('voice')}
            >
              <Mic className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="录制视频消息"
              onClick={() => startRecording('video')}
            >
              <VideoIcon className="h-5 w-5" />
            </Button>
          </>
        )}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void handleFileChange(e, 'IMAGE')}
        />
        <input ref={fileInputRef} type="file" hidden onChange={(e) => void handleFileChange(e, 'FILE')} />
      </div>

      <RedPacketDialog conversation={conversation} open={rpOpen} onClose={() => setRpOpen(false)} />
      <ScheduleDialog conversation={conversation} open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <StickerDialog conversation={conversation} open={stickerOpen} onClose={() => setStickerOpen(false)} />

      {recording ? (
        <div className="flex items-center gap-3 px-3 py-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          {recordMode === 'video' && (
            <video
              ref={previewRef}
              autoPlay
              muted
              playsInline
              className="h-20 rounded-md border bg-black object-cover"
            />
          )}
          <span className="text-sm tabular-nums text-muted-foreground">
            {recordMode === 'voice' ? '录音中' : '录制视频中'}{' '}
            {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
            {String(recordSeconds % 60).padStart(2, '0')} / {MAX_RECORD_SECONDS}s
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => stopRecording(true)}>
              <Trash2 className="mr-1 h-4 w-4" /> 取消
            </Button>
            <Button size="sm" onClick={() => stopRecording(false)}>
              <SendIcon className="mr-1 h-4 w-4" /> 发送
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              detectMention(e.target.value, e.target.selectionStart)
              socket.sendTyping(conversation.id)
            }}
            onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
            onKeyDown={onKey}
            placeholder={
              conversation.type === 'group' ? '输入消息，@ 可提及成员，Enter 发送' : '输入消息，Enter 发送，Shift+Enter 换行'
            }
            rows={2}
            className="scrollbar-thin max-h-32 flex-1 resize-none rounded-md bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button size="lg" onClick={() => void submit()} disabled={!text.trim()}>
            发送
          </Button>
        </div>
      )}
    </div>
  )
}
