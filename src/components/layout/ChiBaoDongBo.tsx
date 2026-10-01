import { useEffect, useState, useSyncExternalStore } from 'react'
import { Tag, Tooltip } from 'antd'
import { CheckCircleOutlined, LoadingOutlined, WarningOutlined } from '@ant-design/icons'
import { isSupabaseEnabled, layTrangThaiGhi, ngheTrangThaiGhi } from '@/lib/supabase'

// Cho người dùng biết dữ liệu vừa nhập đã lên máy chủ chưa. Trước đây lệnh ghi lỗi chỉ
// ghi vào console, người dùng vẫn tin là đã lưu và có thể tắt máy khi dữ liệu chỉ nằm ở máy mình.
export default function ChiBaoDongBo() {
  const tt = useSyncExternalStore(ngheTrangThaiGhi, layTrangThaiGhi)
  const [, veLai] = useState(0)

  // Nhãn "Đã lưu" chỉ hiện vài giây sau lần ghi thành công
  useEffect(() => {
    if (!tt.lanThanhCongCuoi) return
    const conLai = 4000 - (Date.now() - tt.lanThanhCongCuoi)
    if (conLai <= 0) return
    const hen = window.setTimeout(() => veLai((n) => n + 1), conLai)
    return () => window.clearTimeout(hen)
  }, [tt.lanThanhCongCuoi])

  // Còn dữ liệu chưa lên máy chủ mà đóng trang là mất
  const chuaXong = tt.dangGhi > 0 || tt.loi.length > 0
  useEffect(() => {
    if (!chuaXong) return
    const khiDong = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', khiDong)
    return () => window.removeEventListener('beforeunload', khiDong)
  }, [chuaXong])

  if (!isSupabaseEnabled) return null

  if (tt.loi.length > 0) {
    return (
      <Tooltip
        title={(
          <div>
            <div>Dữ liệu vừa nhập mới lưu trên máy này, chưa lên được máy chủ. Hệ thống đang tự thử lại.</div>
            <div>Hãy kiểm tra mạng và <b>không đóng trang</b>, không xóa dữ liệu trình duyệt.</div>
            <div style={{ marginTop: 4, opacity: 0.8 }}>{tt.loi[0].thongBao}</div>
          </div>
        )}
      >
        <Tag color="error" icon={<WarningOutlined />} style={{ marginInlineEnd: 0, cursor: 'help' }}>Chưa lưu lên máy chủ</Tag>
      </Tooltip>
    )
  }
  if (tt.dangGhi > 0) {
    return <Tag color="processing" icon={<LoadingOutlined />} style={{ marginInlineEnd: 0 }}>Đang lưu...</Tag>
  }
  if (tt.lanThanhCongCuoi && Date.now() - tt.lanThanhCongCuoi < 4000) {
    return <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginInlineEnd: 0 }}>Đã lưu lên máy chủ</Tag>
  }
  return null
}
