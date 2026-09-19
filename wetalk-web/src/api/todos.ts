import http, { unwrap } from './client'

/** 待办视图（对齐 wetalk-message Todo 实体） */
export interface TodoView {
  id: number
  userId: number
  content: string
  done: boolean
  dueAt: string | null
  createdAt: string
}

/** 个人待办：列表 / 新增 / 勾选 / 删除 */
export const todoApi = {
  list() {
    return unwrap<TodoView[]>(http.get('/todos'))
  },
  create(content: string, dueAt?: string | null) {
    return unwrap<TodoView>(http.post('/todos', { content, dueAt: dueAt ?? null }))
  },
  toggle(id: number) {
    return unwrap<TodoView>(http.put(`/todos/${id}/toggle`))
  },
  remove(id: number) {
    return unwrap<void>(http.delete(`/todos/${id}`))
  }
}
