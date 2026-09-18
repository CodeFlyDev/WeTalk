import { http, unwrap } from './client'
import type { GroupView } from '@/types/api'

export const groupApi = {
  create(body: { name: string; avatarUrl?: string | null; memberIds: number[] }) {
    return unwrap<GroupView>(http.post('/groups', body))
  },
  my() {
    return unwrap<GroupView[]>(http.get('/groups/my'))
  },
  detail(groupId: number) {
    return unwrap<GroupView>(http.get(`/groups/${groupId}`))
  },
  addMembers(groupId: number, userIds: number[]) {
    return unwrap<void>(http.post(`/groups/${groupId}/members`, null, { params: { userIds: userIds.join(',') } }))
  },
  removeMember(groupId: number, userId: number) {
    return unwrap<void>(http.delete(`/groups/${groupId}/members/${userId}`))
  },
  quit(groupId: number) {
    return unwrap<void>(http.post(`/groups/${groupId}/quit`))
  },
  dissolve(groupId: number) {
    return unwrap<void>(http.delete(`/groups/${groupId}`))
  }
}
