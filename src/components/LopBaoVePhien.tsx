import { useEffect, useState } from 'react'
import { Modal, Button, Progress, Space, Typography } from 'antd'
import { ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { useXungDotDongBo } from '@/hooks/useXungDotDongBo'

const { Text, Paragraph } = Typography

const BAO_TRUOC_GIAY = 60
const NHIP_KIEM_PHIEN_BAN = 5 * 60 * 1000

// Bản đang chạy được ghi vào lúc nạp trang. Nếu tệp index.html trên máy chủ đổi
// tên gói JavaScript nghĩa là đã có bản mới được triển khai.
async function layDauVanPhienBan(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}index.html`, { cache: 'no-store' })
    if (!res.ok) return null
    const html = await res.text()
    const m = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)
    return m ? m[0] : null
  } catch {
    return null
  }
}

export default function LopBaoVePhien() {
  const { giaySapThoat: giayConLai, tiepTuc } = useIdleTimeout()
  useXungDotDongBo()

  const [coBanMoi, setCoBanMoi] = useState(false)

  // Tab mở từ lâu vẫn chạy mã cũ trong bộ nhớ dù máy chủ đã có bản mới. Đã có
  // trường hợp người dùng đổi mật khẩu trên tab cũ, mã cũ ghi sai chỗ nên đổi
  // xong vẫn không đăng nhập được. Phát hiện sớm và mời tải lại.
  useEffect(() => {
    let huy = false
    let banDau: string | null = null

    const kiemTra = async () => {
      const hienTai = await layDauVanPhienBan()
      if (huy || !hienTai) return
      if (banDau === null) { banDau = hienTai; return }
      if (hienTai !== banDau) setCoBanMoi(true)
    }

    kiemTra()
    const dinhKy = window.setInterval(kiemTra, NHIP_KIEM_PHIEN_BAN)
    document.addEventListener('visibilitychange', kiemTra)

    return () => {
      huy = true
      window.clearInterval(dinhKy)
      document.removeEventListener('visibilitychange', kiemTra)
    }
  }, [])

  return (
    <>
      <Modal
        open={giayConLai !== null}
        closable={false}
        mask={{ closable: false }}
        footer={null}
        width={440}
        title={<Space><ClockCircleOutlined style={{ color: '#faad14' }} />Sắp tự động đăng xuất</Space>}
      >
        <Paragraph>
          Bạn không thao tác trong một thời gian. Hệ thống sẽ đăng xuất sau{' '}
          <Text strong style={{ color: '#cf1322' }}>{giayConLai ?? 0} giây</Text> để bảo vệ dữ liệu.
        </Paragraph>
        <Progress
          percent={Math.round(((giayConLai ?? 0) / BAO_TRUOC_GIAY) * 100)}
          showInfo={false}
          status="exception"
        />
        <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 12, marginBottom: 16 }}>
          Nội dung đang nhập dở mà chưa bấm Lưu sẽ không được giữ lại. Bấm nút bên dưới
          để tiếp tục làm việc.
        </Paragraph>
        <Button type="primary" block onClick={tiepTuc}>
          Tôi vẫn đang làm việc
        </Button>
      </Modal>

      <Modal
        open={coBanMoi}
        closable={false}
        mask={{ closable: false }}
        width={440}
        title={<Space><ReloadOutlined style={{ color: '#1677ff' }} />Đã có bản cập nhật mới</Space>}
        footer={[
          <Button key="sau" onClick={() => setCoBanMoi(false)}>Để sau</Button>,
          <Button key="tai" type="primary" onClick={() => window.location.reload()}>Tải lại ngay</Button>,
        ]}
      >
        <Paragraph>
          Phần mềm đã được cập nhật trên máy chủ nhưng trang này vẫn đang chạy bản cũ.
        </Paragraph>
        <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
          Nên tải lại trước khi nhập tiếp. Dùng bản cũ có thể khiến thao tác được lưu sai chỗ,
          chẳng hạn đổi mật khẩu xong nhưng đăng nhập lại không được.
        </Paragraph>
      </Modal>
    </>
  )
}
