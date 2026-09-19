import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { applyFilter, PHOTO_FILTERS } from '@/lib/filters'

/**
 * 图片滤镜选择：选图后弹出，预览区实时切换滤镜，确认后 canvas 烘焙像素再走发送链路。
 */
export default function FilterPickerDialog({
  file,
  open,
  onClose,
  onConfirm
}: {
  file: File | null
  open: boolean
  onClose: () => void
  onConfirm: (file: File, filterName: string) => void
}) {
  const [filterId, setFilterId] = useState('none')
  const [applying, setApplying] = useState(false)
  const [url, setUrl] = useState<string | null>(null)

  // file 变化时重建预览 URL，关闭时释放
  useEffect(() => {
    if (!open || !file) return
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    setFilterId('none')
    return () => {
      URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [file, open])

  const filter = PHOTO_FILTERS.find((f) => f.id === filterId) ?? PHOTO_FILTERS[0]

  async function confirm() {
    if (!file) return
    setApplying(true)
    try {
      onConfirm(await applyFilter(file, filter.css), filter.name)
    } finally {
      setApplying(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="图片滤镜" className="max-w-lg">
      {file && url && (
        <>
          <div className="flex max-h-72 items-center justify-center overflow-hidden rounded-md bg-muted">
            <img src={url} alt="预览" className="max-h-72 object-contain" style={{ filter: filter.css }} />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {PHOTO_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterId(f.id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border p-1.5 text-[11px] transition-colors',
                  filterId === f.id ? 'border-primary ring-1 ring-primary' : 'hover:bg-accent'
                )}
              >
                <img src={url} alt="" className="h-12 w-full rounded object-cover" style={{ filter: f.css }} />
                {f.name}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={() => void confirm()} disabled={applying}>
              {applying && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} 发送
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
