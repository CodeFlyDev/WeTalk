import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Bot, BookOpen, Loader2, Send as SendIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, errorMessage } from '@/lib/utils'
import { aiApi, type ChatMessage } from '@/api/ai'
import KnowledgeDialog from '@/components/chat/KnowledgeDialog'

/** 本地历史存储 key（不落库，清浏览器数据即清空） */
const STORAGE_KEY = 'wetalk.ai.chat'

interface StoredMessage extends ChatMessage {
  at: string
}

function loadHistory(): StoredMessage[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as StoredMessage[]
  } catch {
    return []
  }
}

/** AI 助手面板：固定会话，本地历史 + 后端 Ollama 生成 */
export default function AiChatPanel() {
  const [messages, setMessages] = useState<StoredMessage[]>(loadHistory)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  /** RAG：引用知识库回答（per 会话开关，记忆在 localStorage） */
  const [useKnowledge, setUseKnowledge] = useState(() => localStorage.getItem('wetalk.ai.knowledge') === '1')
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function persist(next: StoredMessage[]) {
    setMessages(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(-100)))
  }

  async function send() {
    const content = text.trim()
    if (!content || loading) return
    setText('')
    const userMsg: StoredMessage = { role: 'user', content, at: new Date().toISOString() }
    const history = [...messages, userMsg]
    persist(history)
    setLoading(true)
    try {
      const reply = await aiApi.chat(
        content,
        messages.slice(-20).map(({ role, content: c }) => ({ role, content: c })),
        useKnowledge
      )
      persist([...history, { role: 'assistant', content: reply, at: new Date().toISOString() }])
    } catch (err) {
      persist([...history, { role: 'assistant', content: `⚠ ${errorMessage(err)}`, at: new Date().toISOString() }])
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 头部说明 + 知识库开关 */}
      <div className="flex items-center justify-between border-b bg-card px-4 py-2">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Bot className="h-3.5 w-3.5" />
          由本地大模型（Ollama）生成，仅供参考；对话仅保存在本机
        </p>
        <div className="flex items-center gap-1">
          <button
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
              useKnowledge
                ? 'border-primary bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            )}
            title={useKnowledge ? '已开启：回答引用知识库内容' : '开启后回答将引用知识库（RAG）'}
            onClick={() =>
              setUseKnowledge((v) => {
                localStorage.setItem('wetalk.ai.knowledge', v ? '0' : '1')
                return !v
              })
            }
          >
            引用知识库
          </button>
          <Button variant="ghost" size="icon" title="知识库管理" onClick={() => setKnowledgeOpen(true)}>
            <BookOpen className="h-4 w-4" />
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" title="清空对话" onClick={() => persist([])}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 消息流 */}
      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bot className="h-10 w-10" />
            <p className="text-sm">有什么可以帮你？</p>
            <p className="text-xs">试试「帮我写一段会议通知」</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[70%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-sm leading-relaxed break-words',
                m.role === 'user'
                  ? 'rounded-br-sm bg-bubble-self'
                  : 'rounded-bl-sm bg-bubble-other text-foreground'
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-bubble-other px-3 py-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">思考中…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2 rounded-xl border bg-card p-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={2000}
            placeholder="问 AI 助手…（Enter 发送，Shift+Enter 换行）"
            className="max-h-32 flex-1 resize-none bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button size="icon" disabled={!text.trim() || loading} onClick={() => void send()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <KnowledgeDialog open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />
    </div>
  )
}
