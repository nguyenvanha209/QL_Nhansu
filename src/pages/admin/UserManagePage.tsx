import { useState, useMemo } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm, message, Typography } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { ROLE_LABELS } from '@/types/auth'
import type { UserRole } from '@/types/auth'
import { formatDate } from '@/utils/helpers'

const { Title } = Typography

export default function UserManagePage() {
  const { users, addUser, updateUser, softDelete } = useUserStore()
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()
  const [selectedRole, setSelectedRole] = useState<UserRole | undefined>()

  const onSave = (values: any) => {
    if (editing) {
      const patch: any = { role: values.role, donViId: values.donViId ?? null, fullName: values.fullName, active: true }
      if (values.password) patch.password = values.password
      updateUser(editing.id, patch)
      message.success('Đã cập nhật tài khoản')
    } else {
      addUser({ username: values.username, password: values.password, fullName: values.fullName, role: values.role, donViId: values.donViId ?? null, active: true })
      message.success('Đã tạo tài khoản')
    }
    setOpen(false); setEditing(null); form.resetFields(); setSelectedRole(undefined)
  }

  const cols = [
    { title: 'Tên đăng nhập', dataIndex: 'username', key: 'un', width: 140 },
    { title: 'Họ và tên', dataIndex: 'fullName', key: 'fn' },
    { title: 'Vai trò', dataIndex: 'role', key: 'role', render: (v: UserRole) => <Tag color={v === 'ADMIN' ? 'red' : v === 'CB_VH_XH' ? 'blue' : v === 'LANH_DAO' ? 'purple' : 'green'}>{ROLE_LABELS[v]}</Tag> },
    {
      title: 'Phạm vi đơn vị', dataIndex: 'donViId', key: 'dv',
      render: (id: string | null) => id ? donVis.find((d) => d.id === id)?.ten ?? id : <Tag>Toàn phường</Tag>,
    },
    { title: 'Trạng thái', dataIndex: 'active', key: 'ac', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? 'Hoạt động' : 'Đã khóa'}</Tag> },
    { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'ct', width: 110, render: (v: string) => formatDate(v) },
    {
      title: 'Thao tác', key: 'act',
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); setSelectedRole(r.role); form.setFieldsValue({ ...r, password: '' }); setOpen(true) }} />
          {r.active && <Popconfirm title="Khóa tài khoản?" onConfirm={() => { softDelete(r.id); message.success('Đã khóa') }}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Quản lý tài khoản</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setSelectedRole(undefined); form.resetFields(); setOpen(true) }}>Tạo tài khoản</Button>
      </div>
      <Table dataSource={users} columns={cols} rowKey="id" size="small" pagination={{ pageSize: 20 }} />

      <Modal open={open} title={editing ? 'Sửa tài khoản' : 'Tạo tài khoản'} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={onSave}>
          {!editing && <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]}><Input /></Form.Item>}
          <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label={editing ? 'Mật khẩu mới (để trống = không đổi)' : 'Mật khẩu'} rules={!editing ? [{ required: true }] : []}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={Object.entries(ROLE_LABELS).map(([k, v]) => ({ value: k, label: v }))} onChange={(v) => setSelectedRole(v as UserRole)} />
          </Form.Item>
          {selectedRole === 'CB_TRUONG' && (
            <Form.Item name="donViId" label="Đơn vị phụ trách" rules={[{ required: true }]}>
              <Select options={donVis.map((d) => ({ value: d.id, label: d.ten }))} placeholder="Chọn trường" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  )
}
