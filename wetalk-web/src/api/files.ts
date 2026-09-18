import axios from 'axios'
import { http, unwrap } from './client'
import type { PresignResult } from '@/types/api'

export const fileApi = {
  presign(body: { fileName: string; contentType: string; clientMsgId: string }) {
    return unwrap<PresignResult>(http.post('/files/presign', body))
  },
  downloadUrl(objectKey: string) {
    return unwrap<string>(http.get('/files/download-url', { params: { objectKey } }))
  }
}

/** presign → PUT 直传 MinIO */
export async function uploadFile(file: File, clientMsgId: string): Promise<PresignResult> {
  const presign = await fileApi.presign({
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    clientMsgId
  })
  await axios.put(presign.uploadUrl, file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' }
  })
  return presign
}

/** 下载地址缓存（同一 objectKey 会话内复用） */
const downloadUrlCache = new Map<string, string>()

export async function getFileUrl(objectKey: string): Promise<string> {
  const cached = downloadUrlCache.get(objectKey)
  if (cached) return cached
  const url = await fileApi.downloadUrl(objectKey)
  downloadUrlCache.set(objectKey, url)
  return url
}
