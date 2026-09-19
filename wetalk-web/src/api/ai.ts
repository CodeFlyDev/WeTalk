import http, { unwrap } from './client'

/** 对话消息（role: user / assistant，旧→新） */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** AI 能力：语音转写 / AI 助手（Ollama）/ 聊天摘要 */
export const aiApi = {
  /** 语音消息转文字（仅会话参与者可调用） */
  transcribe(messageId: string) {
    return unwrap<string>(http.get('/ai/transcribe', { params: { messageId } }))
  },

  /** AI 助手对话（历史由前端携带，服务端不落库；useKnowledge 引用知识库） */
  chat(message: string, history: ChatMessage[], useKnowledge = false) {
    return unwrap<string>(
      http.post('/ai/chat', { message, history, useKnowledge }, { timeout: 120000 })
    )
  },

  /** 聊天摘要（仅会话参与者，取最近 50 条有效消息） */
  summary(conversationId: string) {
    return unwrap<string>(http.post('/ai/summary', null, { params: { conversationId }, timeout: 120000 }))
  },

  /** 表情包文案生成（图像由前端 canvas 合成） */
  sticker(prompt: string) {
    return unwrap<{ text: string; tag: string }>(
      http.post('/ai/sticker', { prompt }, { timeout: 120000 })
    )
  },

  /* ---------- RAG 知识库 ---------- */

  knowledgeAdd(title: string, text: string) {
    return unwrap<KnowledgeDocView>(http.post('/ai/knowledge', { title, text }, { timeout: 120000 }))
  },
  knowledgeList() {
    return unwrap<KnowledgeDocView[]>(http.get('/ai/knowledge'))
  },
  knowledgeRemove(docId: string) {
    return unwrap<void>(http.delete(`/ai/knowledge/${docId}`))
  }
}

/** 知识库文档视图（对齐 wetalk-ai KnowledgeDocView） */
export interface KnowledgeDocView {
  docId: string
  title: string
  chunks: number
  createdAt: string
}
