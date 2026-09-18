import { http, unwrap } from './client'
import type { FriendRequestView, UserView } from '@/types/api'

export const friendApi = {
  list() {
    return unwrap<UserView[]>(http.get('/friends'))
  },
  requests() {
    return unwrap<FriendRequestView[]>(http.get('/friends/requests'))
  },
  sendRequest(body: { toUserId: number; remark?: string }) {
    return unwrap<void>(http.post('/friends/requests', body))
  },
  acceptRequest(requestId: number) {
    return unwrap<void>(http.post(`/friends/requests/${requestId}/accept`))
  },
  remove(friendId: number) {
    return unwrap<void>(http.delete(`/friends/${friendId}`))
  }
}
