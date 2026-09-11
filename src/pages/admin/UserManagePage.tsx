import { useState, useMemo } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm,
  Typography, App, Row, Col, Alert, Badge, Tooltip,
} from 'antd'
import {
  PlusOutlined, EditOutlined, LockOutlined, UnlockOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { ROLE_LABELS } from '@/types/auth'
import type { UserRole } from '@/types/auth'
import { formatDate } from '@/utils/helpers'
import { useAuth } from '@/hooks/useAuth'
import { adminDatMatKhau } from '@/lib/auth'

const { Title, Text } = Typography

// ── Ma trận quyền ──────────────────────────────────────────────────────────
const RESOURCES = [
  { key: 'vienChuc', label: 'Hồ sơ viên chức' },
  { key: 'viTri',    label: 'Vị trí việc làm' },
  { key: 'luong',    label: 'Lương & hệ số' },
  { key: 'deXuat',   label: 'Đề xuất điều chỉnh' },
  { key: 'baoCao',   label: 'Báo cáo' },
  { key: 'duBao',    label: 'Dự báo nghỉ hưu' },
  { key: 'admin',    label: 'Quản trị hệ thống' },
]

const PERM_MATRIX: Record<UserRole, Record<string, string[]>> = {
  ADMIN:      { '*': ['read', 'write', 'approve', 'admin'] },
  CB_VH_XH:  { vienChuc: ['read','write'], viTri: ['read','write'], luong: ['read','write'], deXuat: ['read','write','approve'], baoCao: ['read'], duBao: ['read'] },
  LANH_DAO:  { vienChuc: ['read'], viTri: ['read'], luong: ['read'], deXuat: ['read','approve'], baoCao: ['read'], duBao: ['read'] },
  HIEU_TRUONG: { vienChuc: ['read','write'], viTri: ['read'], luong: ['read'], deXuat: ['read','approve'], baoCao: ['read'], duBao: ['read'] },
  CB_TRUONG: { vienChuc: ['read','write'], viTri: ['read'], luong: ['read'], deXuat: ['read','write'], baoCao: ['read'], duBao: ['read'] },
}

const ROLE_DESC: Record<UserRole, string> = {
  ADMIN: 'Toàn quyền — quản trị hệ thống, tài khoản, danh mục. Không giới hạn phạm vi đơn vị.',
  CB_VH_XH: 'Cán bộ Phòng VH-XH: xem + sửa toàn bộ hồ sơ, lương, đề xuất của tất cả trường.',
  LANH_DAO: 'Lãnh đạo UBND phường: chỉ xem và phê duyệt, không chỉnh sửa dữ liệu.',
  HIEU_TRUONG: 'Hiệu trưởng: xem + sửa hồ sơ trường mình, tạo và duyệt đề xuất của trường.',
  CB_TRUONG: 'Cán bộ trường (kế toán): xem + sửa hồ sơ và tạo đề xuất — chỉ trong phạm vi trường được gán.',
}

const ROLE_COLOR: Record<UserRole, string> = {
  ADMIN: 'red', CB_VH_XH: 'blue', LANH_DAO: 'purple', HIEU_TRUONG: 'gold', CB_TRUONG: 'green',
}

function hasPerm(role: UserRole, resource: string, action: string): boolean {
  const m = PERM_MATRIX[role]
  return m['*']?.includes(action) || m[resource]?.includes(action) || false
}

function PermMatrix({ role }: { role: UserRole }) {
  const actions = [
    { key: 'read',    label: 'Xem' },
    { key: 'write',   label: 'Sửa' },
    { key: 'approve', label: 'Duyệt' },
    { key: 'admin',   label: 'Quản trị' },
  ]
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <Alert title={ROLE_DESC[role]} type="info" showIcon style={{ marginBottom: 8, fontSize: 12 }} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #f0f0f0' }}>Chức năng</th>
            {actions.map((a) => (
              <th key={a.key} style={{ textAlign: 'center', padding: '4px 8px', borderBottom: '1px solid #f0f0f0', width: 56 }}>{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((r) => (
            <tr key={r.key} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <td style={{ padding: '3px 8px' }}>{r.label}</td>
              {actions.map((a) => (
                <td key={a.key} style={{ textAlign: 'center', padding: '3px 8px' }}>
                  {hasPerm(role, r.key, a.key)
                    ? <CheckOutlined style={{ color: '#52c41a' }} />
                    : <CloseOutlined style={{ color: '#d9d9d9' }} />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Component chính ─────────────────────────────────────────────────────────
export default function UserManagePage() {
  const { message } = App.useApp()
  const { currentUser } = useAuth()
  const { users, addUser, updateUser, softDelete } = useUserStore()
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form] = Form.useForm()
  const [selectedRole, setSelectedRole] = useState<UserRole | undefined>()

  // Bộ lọc
  const [filterRole, setFilterRole] = useState<UserRole | 'ALL'>('ALL')
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'locked'>('ALL')
  const [filterDonVi, setFilterDonVi] = useState<string>('ALL')

  const filtered = useMemo(() => users.filter((u) => {
    if (filterRole !== 'ALL' && u.role !== filterRole) return false
    if (filterStatus === 'active' && !u.active) return false
    if (filterStatus === 'locked' && u.active) return false
    if (filterDonVi !== 'ALL' && u.donViId !== filterDonVi) return false
    return true
  }), [users, filterRole, filterStatus, filterDonVi])

  const openCreate = () => { setEditing(null); setSelectedRole(undefined); form.resetFields(); setOpen(true) }
  const openEdit = (r: any) => { setEditing(r); setSelectedRole(r.role); form.setFieldsValue({ ...r, password: '' }); setOpen(true) }
  const closeModal = () => { setOpen(false); setEditing(null); form.resetFields(); setSelectedRole(undefined) }

  const onSave = async (values: any) => {
    if (!currentUser) return
    const username = editing ? editing.username : values.username

    // Mật khẩu nằm trên máy chủ, không nằm trong hồ sơ tài khoản.
    // Đặt mật khẩu là thao tác đặc quyền nên admin phải xác nhận danh tính.
    if (values.password) {
      setSaving(true)
      const kq = await adminDatMatKhau(
        currentUser.username, values.matKhauAdmin,
        username, values.password, values.role === 'ADMIN',
      )
      setSaving(false)
      if (!kq.ok) {
        if (kq.lyDo === 'SAI_MK_ADMIN') message.error('Mật khẩu quản trị viên không đúng, hoặc tài khoản của bạn không có quyền đặt mật khẩu.')
        else if (kq.lyDo === 'CHUA_CAU_HINH') message.error('Chưa cấu hình máy chủ. Liên hệ quản trị viên.')
        else message.error('CHƯA đặt được mật khẩu — không kết nối được máy chủ. Vui lòng thử lại.')
        return
      }
    }

    if (editing) {
      updateUser(editing.id, { role: values.role, donViId: values.donViId ?? null, fullName: values.fullName })
      message.success(values.password ? 'Đã cập nhật tài khoản và đặt lại mật khẩu' : 'Đã cập nhật tài khoản')
    } else {
      addUser({ username, fullName: values.fullName, role: values.role, donViId: values.donViId ?? null, active: true })
      message.success('Đã tạo tài khoản')
    }
    closeModal()
  }

  const toggleActive = (r: any) => {
    if (r.active) {
      softDelete(r.id)
      message.success('Đã khóa tài khoản')
    } else {
      updateUser(r.id, { active: true })
      message.success('Đã mở lại tài khoản')
    }
  }

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = users.filter((u) => u.active).length
    const byRole = Object.keys(ROLE_LABELS).map((role) => ({
      role: role as UserRole,
      count: users.filter((u) => u.active && u.role === role).length,
    }))
    return { total, byRole }
  }, [users])

  const cols = [
    { title: 'Tên đăng nhập', dataIndex: 'username', key: 'un', width: 140 },
    { title: 'Họ và tên', dataIndex: 'fullName', key: 'fn' },
    {
      title: 'Vai trò', dataIndex: 'role', key: 'role', width: 200,
      render: (v: UserRole) => <Tag color={ROLE_COLOR[v]}>{ROLE_LABELS[v]}</Tag>,
    },
    {
      title: 'Đơn vị phụ trách', dataIndex: 'donViId', key: 'dv',
      render: (id: string | null) => id
        ? (donVis.find((d) => d.id === id)?.ten ?? id)
        : <Text type="secondary">Toàn phường</Text>,
    },
    {
      title: 'Trạng thái', dataIndex: 'active', key: 'ac', width: 110,
      render: (v: boolean) => <Badge status={v ? 'success' : 'default'} text={v ? 'Hoạt động' : 'Đã khóa'} />,
    },
    { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'ct', width: 100, render: (v: string) => formatDate(v) },
    {
      title: 'Thao tác', key: 'act', width: 100,
      render: (_: any, r: any) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title={r.active ? 'Khóa tài khoản' : 'Mở lại tài khoản'}>
            <Popconfirm
              title={r.active ? 'Khóa tài khoản này?' : 'Mở lại tài khoản này?'}
              onConfirm={() => toggleActive(r)}
              okText="Xác nhận" cancelText="Hủy"
              okButtonProps={{ danger: r.active }}
            >
              <Button
                size="small"
                icon={r.active ? <LockOutlined /> : <UnlockOutlined />}
                danger={r.active}
                type={r.active ? 'default' : 'primary'}
                ghost={!r.active}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Quản lý tài khoản</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo tài khoản</Button>
      </div>

      {/* Thống kê nhanh */}
      <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
        {stats.byRole.map(({ role, count }) => count > 0 && (
          <Col key={role}>
            <Tag color={ROLE_COLOR[role]} style={{ cursor: 'pointer', padding: '2px 10px' }}
              onClick={() => setFilterRole(filterRole === role ? 'ALL' : role)}>
              {ROLE_LABELS[role]}: <strong>{count}</strong>
            </Tag>
          </Col>
        ))}
        <Col>
          <Text type="secondary" style={{ fontSize: 12 }}>Tổng đang hoạt động: {stats.total}</Text>
        </Col>
      </Row>

      {/* Bộ lọc */}
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          value={filterRole}
          onChange={setFilterRole}
          style={{ width: 200 }}
          options={[
            { value: 'ALL', label: 'Tất cả vai trò' },
            ...Object.entries(ROLE_LABELS).map(([k, v]) => ({ value: k, label: v })),
          ]}
        />
        <Select
          value={filterStatus}
          onChange={setFilterStatus}
          style={{ width: 140 }}
          options={[
            { value: 'ALL', label: 'Tất cả trạng thái' },
            { value: 'active', label: 'Đang hoạt động' },
            { value: 'locked', label: 'Đã khóa' },
          ]}
        />
        <Select
          value={filterDonVi}
          onChange={setFilterDonVi}
          style={{ width: 200 }}
          options={[
            { value: 'ALL', label: 'Tất cả đơn vị' },
            ...donVis.map((d) => ({ value: d.id, label: d.ten })),
          ]}
        />
        {(filterRole !== 'ALL' || filterStatus !== 'ALL' || filterDonVi !== 'ALL') && (
          <Button size="small" onClick={() => { setFilterRole('ALL'); setFilterStatus('ALL'); setFilterDonVi('ALL') }}>
            Xóa bộ lọc
          </Button>
        )}
      </Space>

      <Table
        dataSource={filtered}
        columns={cols}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20 }}
        rowClassName={(r) => !r.active ? 'ant-table-row-disabled' : ''}
      />

      {/* Modal tạo/sửa tài khoản */}
      <Modal
        open={open}
        title={editing ? `Sửa tài khoản — ${editing.username}` : 'Tạo tài khoản mới'}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={onSave}>
          {!editing && (
            <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
              <Input placeholder="vd: htruong.giavien1" />
            </Form.Item>
          )}
          <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? 'Mật khẩu mới (để trống = không đổi)' : 'Mật khẩu'}
            rules={!editing ? [{ required: true, min: 6, message: 'Tối thiểu 6 ký tự' }] : [{ min: 6, message: 'Tối thiểu 6 ký tự' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>

          {/* Đặt mật khẩu là thao tác đặc quyền: admin phải tự xác nhận danh tính */}
          <Form.Item noStyle shouldUpdate={(a, b) => a.password !== b.password}>
            {({ getFieldValue }) =>
              getFieldValue('password') ? (
                <Form.Item
                  name="matKhauAdmin"
                  label="Mật khẩu của bạn (xác nhận)"
                  extra="Cần nhập mật khẩu quản trị viên của chính bạn để đặt mật khẩu cho tài khoản khác."
                  rules={[{ required: true, message: 'Nhập mật khẩu của bạn để xác nhận' }]}
                >
                  <Input.Password autoComplete="current-password" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select
              options={Object.entries(ROLE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              onChange={(v) => setSelectedRole(v as UserRole)}
              placeholder="Chọn vai trò"
            />
          </Form.Item>

          {/* Ma trận quyền theo vai trò được chọn */}
          {selectedRole && <PermMatrix role={selectedRole} />}

          {(selectedRole === 'CB_TRUONG' || selectedRole === 'HIEU_TRUONG') && (
            <Form.Item name="donViId" label="Đơn vị phụ trách" rules={[{ required: true, message: 'Chọn trường' }]} style={{ marginTop: 12 }}>
              <Select options={donVis.map((d) => ({ value: d.id, label: d.ten }))} placeholder="Chọn trường" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </Card>
  )
}
