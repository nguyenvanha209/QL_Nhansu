import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Typography, Alert, Divider, Tag, Table } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined, SafetyOutlined } from '@ant-design/icons'
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
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', fontSize: 28, fontWeight: 700,
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
            }}>
              GV
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.3 }}>
              Hệ thống Quản lý<br />Viên chức &amp; Lao động
            </h1>
            <p style={{ fontSize: 14, opacity: 0.75, margin: '0 0 32px', lineHeight: 1.6 }}>
              UBND Phường Gia Viên<br />
              Các cơ sở giáo dục trực thuộc
            </p>
            <div style={{
              display: 'flex', gap: 16, justifyContent: 'center',
              fontSize: 13, opacity: 0.6,
            }}>
              <div style={{ textAlign: 'center' }}>
                <SafetyOutlined style={{ fontSize: 20, marginBottom: 4, display: 'block' }} />
                Bảo mật
              </div>
              <div style={{ textAlign: 'center' }}>
                <UserOutlined style={{ fontSize: 20, marginBottom: 4, display: 'block' }} />
                Phân quyền
              </div>
            </div>
          </div>
        </div>

        {/* Form bên phải */}
        <div className="login-form-col" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 48px', overflow: 'auto',
        }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            <div style={{ marginBottom: 28 }}>
              <Title level={3} style={{ margin: '0 0 4px', fontWeight: 600 }}>Đăng nhập</Title>
              <Text type="secondary" style={{ fontSize: 14 }}>Nhập tài khoản đã được cấp để truy cập hệ thống</Text>
            </div>

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
