import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Form, Input, Button, Typography, Alert, Divider, Tag, Space } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { logAction } from '@/utils/auditLogger'

const { Title, Text } = Typography

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
            <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>Đăng nhập</Button>
          </Form.Item>
        </Form>

        <Divider plain style={{ margin: '20px 0 12px' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>Loại tài khoản</Text>
        </Divider>
        <Space style={{ justifyContent: 'center', width: '100%', marginBottom: 4 }}>
          <Tag color="gold" style={{ fontSize: 13, padding: '2px 10px' }}>Hiệu trưởng</Tag>
          <Tag color="green" style={{ fontSize: 13, padding: '2px 10px' }}>Kế toán</Tag>
        </Space>
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Tài khoản và mật khẩu do quản trị viên cung cấp
          </Text>
        </div>

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
