import { useRef, useState, type KeyboardEvent } from 'react'
import { FileUp, Image as ImageIcon, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmojiPicker } from './EmojiPicker'
import type { Conversation } from '@/store/chat'
import { useChatStore } from '@/store/chat'

/** 输入区：文本（Enter 发送 / Shift+Enter 换行）+ 表情面板 + 图片/文件发送 */
export default function ChatInput({ conversation }: { conversation: Conversation }) {
  const sendText = useChatStore((s) => s.sendText)
  const sendFile = useChatStore((s) => s.sendFile)
  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const target = conversation.type === 'dm' ? { peerId: conversation.peerId } : { groupId: conversation.groupId }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  async function submit() {
    const content = text.trim()
    if (!content) return
    setText('')
    setEmojiOpen(false)
    await sendText(target, content)
  }

  function onPickFile(kind: 'IMAGE' | 'FILE') {
    const input = kind === 'IMAGE' ? imageInputRef.current : fileInputRef.current
    input?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, kind: 'IMAGE' | 'FILE') {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await sendFile(target, file, kind)
  }

  return (
    <div className="relative shrink-0 border-t bg-card">
      {emojiOpen && (
        <div className="absolute bottom-full left-2 mb-2">
          <EmojiPicker
            onPick={(emoji) => setText((t) => t + emoji)}
            onClose={() => setEmojiOpen(false)}
          />
        </div>
      )}

      <div className="flex items-center gap-1 px-3 pt-2">
        <Button variant="ghost" size="icon" title="表情" onClick={() => setEmojiOpen((v) => !v)}>
          <Smile className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" title="发送图片" onClick={() => onPickFile('IMAGE')}>
          <ImageIcon className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" title="发送文件" onClick={() => onPickFile('FILE')}>
          <FileUp className="h-5 w-5" />
        </Button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void handleFileChange(e, 'IMAGE')}
        />
        <input ref={fileInputRef} type="file" hidden onChange={(e) => void handleFileChange(e, 'FILE')} />
      </div>

      <div className="flex items-end gap-2 px-3 py-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="输入消息，Enter 发送，Shift+Enter 换行"
          rows={2}
          className="scrollbar-thin max-h-32 flex-1 resize-none rounded-md bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button size="lg" onClick={() => void submit()} disabled={!text.trim()}>
          发送
        </Button>
      </div>
    </div>
  )
}
