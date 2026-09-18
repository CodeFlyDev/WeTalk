import http, { unwrap } from './client'

/** AI 能力（当前：语音转写） */
export const aiApi = {
  /** 语音消息转文字（仅会话参与者可调用） */
  transcribe(messageId: string) {
    return unwrap<string>(http.get('/ai/transcribe', { params: { messageId } }))
  }
}
