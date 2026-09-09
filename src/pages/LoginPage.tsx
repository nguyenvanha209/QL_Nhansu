import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, Alert, Divider, Tag, Table } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { logAction } from '@/utils/auditLogger'

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

  const onFinish = ({ username, password }: { username: string; password: string }) => {
    setLoading(true)
    setError('')
    setTimeout(() => {
      const user = findByUsername(username)
      if (!user) { setError('Tài khoản không tồn tại'); setLoading(false); return }
      if (user.password !== password) { setError('Mật khẩu không đúng'); setLoading(false); return }
      login(user)
      logAction(user.id, user.fullName, 'LOGIN', 'User', user.id, `Đăng nhập: ${user.username}`)
      navigate('/dashboard')
    }, 300)
  }

  // Lấy danh sách trường có ít nhất 1 tài khoản KT hoặc HT
  const schoolAccounts = useMemo(() => {
    const activeDonVis = donVis
      .filter((d) => d.active)
      .sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))

    return activeDonVis.map((dv) => {
      const kt = users.find((u) => u.active && u.donViId === dv.id && u.role === 'CB_TRUONG')
      const ht = users.find((u) => u.active && u.donViId === dv.id && u.role === 'HIEU_TRUONG')
      return { key: dv.id, ten: dv.ten, kt: kt?.username ?? '—', ht: ht?.username ?? '—' }
    }).filter((r) => r.kt !== '—' || r.ht !== '—')
  }, [donVis, users])

  const columns = [
    { title: 'Trường', dataIndex: 'ten', key: 'ten', ellipsis: true },
    {
      title: <Tag color="green" style={{ margin: 0 }}>Kế toán (KT)</Tag>,
      dataIndex: 'kt', key: 'kt', width: 120, align: 'center' as const,
      render: (v: string) => v === '—' ? <Text type="secondary">—</Text> : <Text code style={{ fontSize: 13 }}>{v}</Text>,
    },
    {
      title: <Tag color="gold" style={{ margin: 0 }}>Hiệu trưởng (HT)</Tag>,
      dataIndex: 'ht', key: 'ht', width: 140, align: 'center' as const,
      render: (v: string) => v === '—' ? <Text type="secondary">—</Text> : <Text code style={{ fontSize: 13 }}>{v}</Text>,
    },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)', padding: '24px 16px' }}>
      <Card style={{ width: '100%', maxWidth: 680, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Title level={3} style={{ margin: 0 }}>Hệ thống Quản lý Viên chức</Title>
          <Text type="secondary" style={{ fontSize: 15 }}>UBND Phường Gia Viên</Text>
        </div>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <Form form={form} onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
            <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading} size="large">Đăng nhập</Button>
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
            <PhoneOutlined style={{ marginRight: 6, color: '#1677ff' }} />
            Đ/c Nguyễn Văn Hạ — 0902.121.599
          </Text>
        </div>
      </Card>
    </div>
  )
}
