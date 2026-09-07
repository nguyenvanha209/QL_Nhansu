import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, Alert, Space, Divider, Tag } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { logAction } from '@/utils/auditLogger'

const { Title, Text } = Typography

const DEMO_ACCOUNTS = [
  { username: 'admin', label: 'Quản trị viên', color: 'red' },
  { username: 'vhxh01', label: 'Cán bộ VH-XH', color: 'blue' },
  { username: 'lanhdao01', label: 'Lãnh đạo', color: 'purple' },
  { username: 'truong01', label: 'Cán bộ trường', color: 'green' },
]

export default function LoginPage() {
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const findByUsername = useUserStore((s) => s.findByUsername)
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #e6f4ff 0%, #f0f5ff 100%)' }}>
      <Card style={{ width: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}>Hệ thống Quản lý Viên chức</Title>
          <Text type="secondary">UBND Phường Gia Viên</Text>
        </div>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <Form form={form} onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
            <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>Đăng nhập</Button>
          </Form.Item>
        </Form>

        <Divider plain><Text type="secondary" style={{ fontSize: 12 }}>Tài khoản demo (mật khẩu: 123456)</Text></Divider>
        <Space wrap style={{ justifyContent: 'center', width: '100%' }}>
          {DEMO_ACCOUNTS.map((acc) => (
            <Tag
              key={acc.username}
              color={acc.color}
              style={{ cursor: 'pointer', marginBottom: 4 }}
              onClick={() => {
                form.setFieldsValue({ username: acc.username, password: '123456' })
                form.submit()
              }}
            >
              {acc.username} · {acc.label}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  )
}
