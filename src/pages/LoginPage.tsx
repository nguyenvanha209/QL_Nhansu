import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Typography, Alert, Divider } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { logAction } from '@/utils/auditLogger'
import { dangNhap, dangXuatMayChu } from '@/lib/auth'
import { syncFromSupabase } from '@/lib/syncFromSupabase'
import { initSeedData } from '@/utils/seed'

const { Title, Text } = Typography

export default function LoginPage() {
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const users = useUserStore((s) => s.users)
  const navigate = useNavigate()

  const onFinish = async ({ username, password }: { username: string; password: string }) => {
    setLoading(true)
    setError('')

    const kq = await dangNhap(username, password)

    if (!kq.ok) {
      if (kq.lyDo === 'SAI' || kq.lyDo === 'KHOA') {
        const u = users.find((x) => x.username === username)
        logAction(u?.id ?? 'unknown', u?.fullName ?? username, 'LOGIN_FAIL', 'User', {
          entityId: u?.id,
          moTa: kq.lyDo === 'KHOA'
            ? `Đăng nhập thất bại: ${username} - tài khoản đang bị tạm khóa`
            : `Đăng nhập thất bại: ${username} - sai mật khẩu (còn ${kq.conLai} lần thử)`,
          donViId: u?.donViId ?? undefined,
        })
      }
      if (kq.lyDo === 'KHOA') {
        const den = new Date(kq.khoaDen)
        setError(`Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${den.toLocaleTimeString('vi-VN')}.`)
      } else if (kq.lyDo === 'CHUA_CAU_HINH') {
        setError('Chưa cấu hình máy chủ dữ liệu. Liên hệ quản trị viên.')
      } else if (kq.lyDo === 'CHUA_KICH_HOAT') {
        setError('Tài khoản chưa được kích hoạt trên máy chủ xác thực. Liên hệ quản trị viên.')
      } else if (kq.lyDo === 'LOI') {
        setError('Không kết nối được máy chủ. Kiểm tra kết nối mạng rồi thử lại.')
      } else {
        setError(`Tên đăng nhập hoặc mật khẩu không đúng. Còn ${kq.conLai} lần thử.`)
      }
      setLoading(false)
      return
    }

    // Đã có phiên máy chủ → mới kéo được dữ liệu về (trước khi đăng nhập máy chủ không cho đọc)
    const dongBo = await syncFromSupabase()
    if (dongBo === 'error') {
      dangXuatMayChu()
      setError('Không tải được dữ liệu từ máy chủ. Kiểm tra kết nối mạng rồi thử lại.')
      setLoading(false)
      return
    }
    initSeedData()
    const user = useUserStore.getState().findByUsername(username)
    if (!user) {
      dangXuatMayChu()
      setError('Tài khoản đã bị khóa hoặc không còn hiệu lực.')
      setLoading(false)
      return
    }

    login(user)
    logAction(user.id, user.fullName, 'LOGIN', 'User', {
      entityId: user.id,
      moTa: `Đăng nhập: ${user.username}`,
      donViId: user.donViId ?? undefined,
    })
    navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#f1f5f9' }}>
      {/* Layout 2 cột */}
      <div className="login-layout" style={{ display: 'flex', width: '100%', minHeight: '100vh' }}>
        {/* Hero panel bên trái */}
        <div className="login-hero" style={{ flex: '0 0 400px', minHeight: '100vh' }}>
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            {/* Logo đặc trưng của phần mềm */}
            <img
              src={`${import.meta.env.BASE_URL}logo-phuong.png`}
              alt="Quản lý nhân sự lao động tiền lương - Phường Gia Viên"
              width={300}
              height={300}
              style={{
                display: 'block', width: 300, maxWidth: '80%', height: 'auto', aspectRatio: '1 / 1',
                margin: '0 auto', borderRadius: '50%',
                background: '#fff', padding: 6,
                boxShadow: '0 10px 40px rgba(15,23,42,0.28), 0 0 0 4px rgba(255,255,255,0.18)',
              }}
            />
          </div>
        </div>

        {/* Form bên phải */}
        <div className="login-form-col" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 48px', overflow: 'auto',
        }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            <Title level={3} style={{ margin: '0 0 24px', fontWeight: 600 }}>Đăng nhập</Title>

            {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 16, borderRadius: 8 }} />}

            <Form form={form} onFinish={onFinish} size="large" layout="vertical">
              <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
                <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="Nhập tên đăng nhập" autoComplete="username" style={{ borderRadius: 8, height: 44 }} />
              </Form.Item>
              <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="Nhập mật khẩu" autoComplete="current-password" style={{ borderRadius: 8, height: 44 }} />
              </Form.Item>
              <Form.Item style={{ marginBottom: 16 }}>
                <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ height: 44, borderRadius: 8, fontWeight: 600 }}>
                  Đăng nhập
                </Button>
              </Form.Item>
            </Form>

            {/* Không công khai danh sách tên đăng nhập (giúp kẻ xấu dò mật khẩu) - tên đăng nhập do Phòng VH-XH cấp riêng */}
            <Text type="secondary" style={{ fontSize: 13, display: 'block', textAlign: 'center' }}>
              Tên đăng nhập và mật khẩu do Phòng Văn hóa - Xã hội cấp riêng cho từng trường.
            </Text>

            <Divider style={{ margin: '16px 0 12px' }} />
            <div style={{ textAlign: 'center', padding: '0 8px' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Nếu không đăng nhập được, xin liên hệ:
              </Text>
              <br />
              <Text style={{ fontSize: 14, fontWeight: 600 }}>
                <PhoneOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                Đ/c Nguyễn Văn Hạ - 0902.121.599
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
