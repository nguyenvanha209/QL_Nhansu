import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Typography, Alert, Divider, Tag, Table } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { logAction } from '@/utils/auditLogger'
import { dangNhap } from '@/lib/auth'

const { Title, Text } = Typography

export default function LoginPage() {
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const findByUsername = useUserStore((s) => s.findByUsername)
  const users = useUserStore((s) => s.users)
  const donVis = useDanhMucStore((s) => s.donVis)
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
            ? `Đăng nhập thất bại: ${username} — tài khoản đang bị tạm khóa`
            : `Đăng nhập thất bại: ${username} — sai mật khẩu (còn ${kq.conLai} lần thử)`,
          donViId: u?.donViId ?? undefined,
        })
      }
      if (kq.lyDo === 'KHOA') {
        const den = new Date(kq.khoaDen)
        setError(`Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${den.toLocaleTimeString('vi-VN')}.`)
      } else if (kq.lyDo === 'CHUA_CAU_HINH') {
        setError('Chưa cấu hình máy chủ dữ liệu. Liên hệ quản trị viên.')
      } else if (kq.lyDo === 'LOI') {
        setError('Không kết nối được máy chủ. Kiểm tra kết nối mạng rồi thử lại.')
      } else {
        setError(`Tên đăng nhập hoặc mật khẩu không đúng. Còn ${kq.conLai} lần thử.`)
      }
      setLoading(false)
      return
    }

    const user = findByUsername(username)
    if (!user) {
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

  const DV_ORDER: Record<string, number> = { MAM_NON: 1, TIEU_HOC: 2, THCS: 3 }
  const DV_LABEL: Record<string, string> = { MAM_NON: 'Mầm non', TIEU_HOC: 'Tiểu học', THCS: 'THCS' }

  const schoolAccounts = useMemo(() => {
    const activeDonVis = donVis
      .filter((d) => d.active)
      .sort((a, b) => {
        const oa = DV_ORDER[a.loai] ?? 9
        const ob = DV_ORDER[b.loai] ?? 9
        if (oa !== ob) return oa - ob
        return a.ten.localeCompare(b.ten, 'vi')
      })

    const result: Array<{ key: string; ten: string; kt: string; ht: string; loai?: string; isGroup?: boolean }> = []
    let lastLoai = ''
    for (const dv of activeDonVis) {
      const kt = users.find((u) => u.active && u.donViId === dv.id && u.role === 'CB_TRUONG')
      const ht = users.find((u) => u.active && u.donViId === dv.id && u.role === 'HIEU_TRUONG')
      if (!kt && !ht) continue
      if (dv.loai !== lastLoai) {
        result.push({ key: `group_${dv.loai}`, ten: DV_LABEL[dv.loai] ?? dv.loai, kt: '', ht: '', isGroup: true })
        lastLoai = dv.loai
      }
      result.push({ key: dv.id, ten: dv.ten, kt: kt?.username ?? '—', ht: ht?.username ?? '—' })
    }
    return result
  }, [donVis, users])

  const columns = [
    {
      title: 'Trường', dataIndex: 'ten', key: 'ten',
      render: (v: string, r: any) => r.isGroup
        ? <Text strong style={{ color: '#2563eb', fontSize: 13 }}>── {v} ──</Text>
        : v,
    },
    {
      title: <Tag color="green" style={{ margin: 0 }}>Kế toán (KT)</Tag>,
      dataIndex: 'kt', key: 'kt', width: 130, align: 'center' as const,
      render: (v: string, r: any) => r.isGroup ? null : v === '—' ? <Text type="secondary">—</Text> : <Text code style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: <Tag color="gold" style={{ margin: 0 }}>Hiệu trưởng (HT)</Tag>,
      dataIndex: 'ht', key: 'ht', width: 145, align: 'center' as const,
      render: (v: string, r: any) => r.isGroup ? null : v === '—' ? <Text type="secondary">—</Text> : <Text code style={{ fontSize: 13 }}>{v}</Text>,
    },
  ]

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
              alt="Quản lý nhân sự lao động tiền lương — Phường Gia Viên"
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

            {schoolAccounts.length > 0 && (
              <>
                <Divider plain style={{ margin: '24px 0 12px' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Danh mục tài khoản theo trường</Text>
                </Divider>
                <Table
                  dataSource={schoolAccounts}
                  columns={columns}
                  size="small"
                  pagination={false}
                  rowClassName={(r: any) => r.isGroup ? 'login-group-row' : ''}
                  style={{ marginBottom: 4 }}
                />
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Mật khẩu sẽ được cung cấp riêng — không hiển thị tại đây
                  </Text>
                </div>
              </>
            )}

            <Divider style={{ margin: '16px 0 12px' }} />
            <div style={{ textAlign: 'center', padding: '0 8px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Nếu không đăng nhập được, xin liên hệ:
              </Text>
              <br />
              <Text style={{ fontSize: 13, fontWeight: 600 }}>
                <PhoneOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                Đ/c Nguyễn Văn Hạ — 0902.121.599
              </Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
