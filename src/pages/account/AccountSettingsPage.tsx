import { useState } from 'react'
import { Card, Form, Input, Button, App, Typography, Descriptions, Tag, Divider, Space } from 'antd'
import { UserOutlined, LockOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'
import { useUserStore } from '@/store/userStore'
import { useAuthStore } from '@/store/authStore'
import { ROLE_LABELS } from '@/types/auth'
import type { User } from '@/types/auth'
import { useDanhMucStore } from '@/store/danhMucStore'
import { formatDate } from '@/utils/helpers'

const { Title, Text } = Typography

export default function AccountSettingsPage() {
  const { message } = App.useApp()
  const { currentUser } = useAuth()
  const updateUser = useUserStore((s) => s.updateUser)
  const login = useAuthStore((s) => s.login)
  const donVis = useDanhMucStore((s) => s.donVis)

  const [editingProfile, setEditingProfile] = useState(false)
  const [editingPassword, setEditingPassword] = useState(false)
  const [profileForm] = Form.useForm()
  const [pwForm] = Form.useForm()

  if (!currentUser) return null

  const donViTen = currentUser.donViId ? donVis.find((d) => d.id === currentUser.donViId)?.ten ?? currentUser.donViId : 'Toàn phường'

  const onSaveProfile = (values: { fullName: string }) => {
    const updated: User = { ...currentUser, fullName: values.fullName }
    updateUser(currentUser.id, { fullName: values.fullName })
    login(updated)
    message.success('Đã cập nhật thông tin tài khoản')
    setEditingProfile(false)
  }

  const onChangePassword = (values: { currentPassword: string; newPassword: string }) => {
    if (values.currentPassword !== currentUser.password) {
      message.error('Mật khẩu hiện tại không đúng')
      return
    }
    const updated: User = { ...currentUser, password: values.newPassword }
    updateUser(currentUser.id, { password: values.newPassword })
    login(updated)
    message.success('Đã đổi mật khẩu thành công')
    setEditingPassword(false)
    pwForm.resetFields()
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Card>
        <Space align="center" style={{ marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>{currentUser.fullName}</Title>
            <Text type="secondary">@{currentUser.username}</Text>
          </div>
        </Space>

        {/* Thông tin tài khoản */}
        {!editingProfile ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Tên đăng nhập">{currentUser.username}</Descriptions.Item>
              <Descriptions.Item label="Họ và tên">{currentUser.fullName}</Descriptions.Item>
              <Descriptions.Item label="Vai trò">
                <Tag color={{ ADMIN: 'red', CB_VH_XH: 'blue', LANH_DAO: 'purple', HIEU_TRUONG: 'gold', CB_TRUONG: 'green' }[currentUser.role] ?? 'default'}>
                  {ROLE_LABELS[currentUser.role] ?? currentUser.role}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Đơn vị phụ trách">{donViTen}</Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">{formatDate(currentUser.createdAt)}</Descriptions.Item>
            </Descriptions>
            <Button
              icon={<EditOutlined />}
              style={{ marginTop: 12 }}
              onClick={() => { setEditingProfile(true); profileForm.setFieldsValue({ fullName: currentUser.fullName }) }}
            >
              Cập nhật thông tin
            </Button>
          </>
        ) : (
          <Form form={profileForm} layout="vertical" onFinish={onSaveProfile}>
            <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ và tên' }]}>
              <Input prefix={<UserOutlined />} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Lưu</Button>
              <Button icon={<CloseOutlined />} onClick={() => setEditingProfile(false)}>Hủy</Button>
            </Space>
          </Form>
        )}

        <Divider />

        {/* Đổi mật khẩu */}
        <Title level={5} style={{ marginBottom: 16 }}>
          <LockOutlined style={{ marginRight: 6 }} />
          Đổi mật khẩu
        </Title>
        {!editingPassword ? (
          <Button icon={<LockOutlined />} onClick={() => setEditingPassword(true)}>
            Đổi mật khẩu
          </Button>
        ) : (
          <Form form={pwForm} layout="vertical" onFinish={onChangePassword}>
            <Form.Item name="currentPassword" label="Mật khẩu hiện tại" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="Mật khẩu mới"
              rules={[{ required: true }, { min: 6, message: 'Tối thiểu 6 ký tự' }]}
            >
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="Xác nhận mật khẩu mới"
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                    return Promise.reject(new Error('Mật khẩu xác nhận không khớp'))
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Đổi mật khẩu</Button>
              <Button icon={<CloseOutlined />} onClick={() => { setEditingPassword(false); pwForm.resetFields() }}>Hủy</Button>
            </Space>
          </Form>
        )}
      </Card>
    </div>
  )
}
