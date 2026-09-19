import http, { unwrap } from './client'

/** 评论视图（对齐 wetalk-social PostView.CommentView） */
export interface PostCommentView {
  id: number
  userId: number
  userName: string
  content: string
  createdAt: string
}

/** 动态视图（对齐 wetalk-social PostView） */
export interface PostView {
  id: number
  authorId: number
  authorName: string
  authorAvatar: string | null
  content: string
  imageKeys: string[]
  createdAt: string
  likeCount: number
  likedByMe: boolean
  comments: PostCommentView[]
}

/** 朋友圈：发布 / feed / 点赞 / 评论 / 删除 */
export const postApi = {
  publish(content: string, imageKeys: string[]) {
    return unwrap<PostView>(http.post('/posts', { content, imageKeys }))
  },
  feed() {
    return unwrap<PostView[]>(http.get('/posts/feed'))
  },
  detail(id: number) {
    return unwrap<PostView>(http.get(`/posts/${id}`))
  },
  remove(id: number) {
    return unwrap<void>(http.delete(`/posts/${id}`))
  },
  like(id: number) {
    return unwrap<void>(http.post(`/posts/${id}/like`))
  },
  unlike(id: number) {
    return unwrap<void>(http.delete(`/posts/${id}/like`))
  },
  comment(id: number, content: string) {
    return unwrap<PostView>(http.post(`/posts/${id}/comments`, { content }))
  }
}
