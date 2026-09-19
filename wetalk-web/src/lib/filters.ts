/** 图片滤镜（CSS filter 语义，canvas 真实处理后再上传） */

export interface PhotoFilter {
  id: string
  name: string
  css: string
}

/** 内置滤镜：原规划 MediaPipe AR 贴纸的简化落地（纯 CSS filter，零 AI 依赖） */
export const PHOTO_FILTERS: PhotoFilter[] = [
  { id: 'none', name: '原图', css: 'none' },
  { id: 'mono', name: '黑白', css: 'grayscale(1) contrast(1.1)' },
  { id: 'sepia', name: '怀旧', css: 'sepia(0.75) saturate(1.2)' },
  { id: 'cool', name: '冷调', css: 'hue-rotate(-15deg) saturate(1.15) brightness(1.02)' },
  { id: 'warm', name: '暖阳', css: 'sepia(0.3) saturate(1.3) brightness(1.05)' },
  { id: 'vivid', name: '鲜艳', css: 'saturate(1.6) contrast(1.1)' },
  { id: 'fade', name: '褪色', css: 'saturate(0.7) contrast(0.9) brightness(1.08)' },
  { id: 'invert', name: '反色', css: 'invert(1)' }
]

/**
 * 将滤镜真实烘焙进图片像素：createImageBitmap → canvas ctx.filter 绘制 → 导出。
 * GIF 经处理会变成静态首帧，跳过动图。
 */
export async function applyFilter(file: File, filterCss: string): Promise<File> {
  if (filterCss === 'none') return file
  if (file.type === 'image/gif') return file // 动图不处理，保留动画
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.filter = filterCss
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type || 'image/png'))
  if (!blob) return file
  return new File([blob], file.name, { type: file.type || 'image/png' })
}
