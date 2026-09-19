import { http, unwrap } from './client'
import type { VoiceRoomView } from '@/types/api'

export const voipApi = {
  /** 语音房间列表（含在线人数） */
  list() {
    return unwrap<VoiceRoomView[]>(http.get('/voip/rooms'))
  },
  /** 创建房间（创建者即房主） */
  create(name: string) {
    return unwrap<VoiceRoomView>(http.post('/voip/rooms', { name }))
  },
  /** 解散房间（仅房主） */
  dissolve(id: number) {
    return unwrap<void>(http.delete(`/voip/rooms/${id}`))
  }
}
