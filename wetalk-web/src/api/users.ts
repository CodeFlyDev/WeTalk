import { http, unwrap } from './client'
import type { UserView } from '@/types/api'

export const userApi = {
  byId(id: number) {
    return unwrap<UserView>(http.get(`/users/${id}`))
  }
}
