import { http, unwrap } from './client'
import type { ChannelMessageView, ChannelView } from '@/types/api'

export const channelApi = {
  list() {
    return unwrap<ChannelView[]>(http.get('/channels'))
  },
  create(body: { name: string; description?: string }) {
    return unwrap<ChannelView>(http.post('/channels', body))
  },
  join(id: number) {
    return unwrap<void>(http.post(`/channels/${id}/join`))
  },
  quit(id: number) {
    return unwrap<void>(http.delete(`/channels/${id}/join`))
  },
  dissolve(id: number) {
    return unwrap<void>(http.delete(`/channels/${id}`))
  },
  send(id: number, content: string) {
    return unwrap<ChannelMessageView>(http.post(`/channels/${id}/messages`, { content }))
  },
  history(id: number) {
    return unwrap<ChannelMessageView[]>(http.get(`/channels/${id}/messages`))
  }
}
