import { useRef, useState } from 'react'
import { Button, Space, Typography, App, Tooltip } from 'antd'
import { PaperClipOutlined, UploadOutlined, DeleteOutlined, DownloadOutlined, FilePdfOutlined, FileImageOutlined } from '@ant-design/icons'
import { taiLenMinhChung, linkMinhChung, dinhDangDungLuong } from '@/lib/minhChung'
import type { MinhChung } from '@/lib/minhChung'

const { Text } = Typography

/** Danh sách minh chứng: bấm tên để xem, nút tải về; có thể cho gỡ (khi đang sửa phiếu) */
export function DanhSachMinhChung({ value, onRemove, compact }: {
  value?: MinhChung[]
  onRemove?: (path: string) => void
  compact?: boolean
}) {
  const { message } = App.useApp()
  const mo = async (mc: MinhChung, taiVe = false) => {
    try {
      window.open(await linkMinhChung(mc, taiVe), '_blank', 'noopener')
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Không mở được minh chứng')
    }
  }
  if (!value?.length) return compact ? null : <Text type="secondary">Chưa có minh chứng</Text>
  return (
    <Space orientation="vertical" size={2} style={{ width: '100%' }}>
      {value.map((mc) => (
        <Space key={mc.path} size={6} wrap={false}>
          {mc.loai === 'application/pdf' ? <FilePdfOutlined style={{ color: '#dc2626' }} /> : <FileImageOutlined style={{ color: '#2563eb' }} />}
          <a onClick={() => mo(mc)} style={{ maxWidth: compact ? 140 : 360, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={mc.ten}>
            {mc.ten}
          </a>
          {!compact && <Text type="secondary" style={{ fontSize: 12 }}>{dinhDangDungLuong(mc.kichThuoc)}</Text>}
          <Tooltip title="Tải về"><Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => mo(mc, true)} /></Tooltip>
          {onRemove && <Tooltip title="Gỡ khỏi phiếu"><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => onRemove(mc.path)} /></Tooltip>}
        </Space>
      ))}
    </Space>
  )
}

/** Ô đính kèm: chọn nhiều file, kiểm tra ≤ 3 MB, nén ảnh, tải lên Supabase Storage */
export default function MinhChungField({ value, onChange, taiLenBoi, compact }: {
  value?: MinhChung[]
  onChange?: (v: MinhChung[]) => void
  taiLenBoi: string
  compact?: boolean
}) {
  const { message } = App.useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dangTai, setDangTai] = useState(false)
  const ds = value ?? []

  const chonFile = async (files: FileList | null) => {
    if (!files?.length) return
    setDangTai(true)
    const moi: MinhChung[] = []
    for (const f of Array.from(files)) {
      try {
        const mc = await taiLenMinhChung(f, taiLenBoi)
        if (![...ds, ...moi].some((x) => x.path === mc.path)) moi.push(mc)
      } catch (e) {
        message.error(e instanceof Error ? e.message : `Không tải được "${f.name}"`)
      }
    }
    setDangTai(false)
    if (inputRef.current) inputRef.current.value = ''
    if (moi.length) {
      onChange?.([...ds, ...moi])
      message.success(`Đã đính kèm ${moi.length} file`)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        style={{ display: 'none' }}
        onChange={(e) => chonFile(e.target.files)}
      />
      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
        <DanhSachMinhChung value={ds} compact={compact} onRemove={(path) => onChange?.(ds.filter((x) => x.path !== path))} />
        <Button
          size="small"
          icon={compact ? <PaperClipOutlined /> : <UploadOutlined />}
          loading={dangTai}
          onClick={() => inputRef.current?.click()}
        >
          {compact ? (ds.length ? 'Thêm' : 'Đính kèm') : 'Đính kèm minh chứng'}
        </Button>
        {!compact && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            PDF, JPG, PNG — tối đa 3 MB mỗi file. Ảnh chụp được tự nén. PDF scan nên để đen trắng hoặc xám, 150–200 dpi.
          </Text>
        )}
      </Space>
    </div>
  )
}
