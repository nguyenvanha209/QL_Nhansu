import { useState, useMemo } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm,
  Typography, App, Row, Col, Alert, Badge, Tooltip, Checkbox, Switch,
} from 'antd'
import {
  PlusOutlined, EditOutlined, LockOutlined, UnlockOutlined, CheckOutlined, CloseOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { ROLE_LABELS } from '@/types/auth'
import type { User, UserRole } from '@/types/auth'
import {
  RESOURCES, ACTIONS, ROLE_DESC, khoaQuyen, quyenTheoVaiTro, tinhQuyenRieng, demQuyenRieng, can,
} from '@/utils/rbac'
import { formatDate } from '@/utils/helpers'
import { useAuth } from '@/hooks/useAuth'
import { adminDatMatKhau, adminXoaMatKhau } from '@/lib/auth'
import { logAction } from '@/utils/auditLogger'

const { Title, Text } = Typography

const ROLE_COLOR: Record<UserRole, string> = {
  ADMIN: 'red', CB_VH_XH: 'blue', LANH_DAO: 'purple', HIEU_TRUONG: 'gold', CB_TRUONG: 'green',
}

// Bảng quyền: chỉ xem khi theo mặc định vai trò, tích chọn được khi bật tùy chỉnh.
// Ô nào khác mặc định của vai trò được tô màu để thấy ngay đã sửa tay chỗ nào.
function BangQuyen({
  role, chon, onDoi, choSua,
}: {
  role: UserRole
  chon: Record<string, boolean>
  onDoi: (k: string, v: boolean) => void
  choSua: boolean
}) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <Alert title={ROLE_DESC[role]} type="info" showIcon style={{ marginBottom: 8, fontSize: 13 }} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #f0f0f0' }}>Chức năng</th>
            {ACTIONS.map((a) => (
              <th key={a.key} style={{ textAlign: 'center', padding: '4px 8px', borderBottom: '1px solid #f0f0f0', width: 62 }}>{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((r) => (
            <tr key={r.key} style={{ borderBottom: '1px solid #f5f5f5' }}>
              <td style={{ padding: '3px 8px' }}>{r.label}</td>
              {ACTIONS.map((a) => {
                const k = khoaQuyen(r.key, a.key)
                const macDinh = quyenTheoVaiTro(role, r.key, a.key)
                const co = chon[k] ?? macDinh
                const khac = co !== macDinh
                return (
                  <td
                    key={a.key}
                    style={{
                      textAlign: 'center', padding: '3px 8px',
                      background: khac ? (co ? '#f6ffed' : '#fff2f0') : undefined,
                    }}
                  >
                    {choSua ? (
                      <Tooltip title={khac ? (co ? 'Cấp thêm ngoài vai trò' : 'Đã thu hồi so với vai trò') : undefined}>
                        <Checkbox checked={co} onChange={(e: { target: { checked: boolean } }) => onDoi(k, e.target.checked)} />
                      </Tooltip>
                    ) : co ? (
                      <CheckOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <CloseOutlined style={{ color: '#d9d9d9' }} />
                    )}
                  </td>
                )
              })}
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
  const { users, addUser, updateUser, softDelete, xoaTaiKhoan } = useUserStore()
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  // Bảng tích chọn quyền; rỗng nghĩa là đang theo đúng mặc định của vai trò
  const [tuyChinhQuyen, setTuyChinhQuyen] = useState(false)
  const [chonQuyen, setChonQuyen] = useState<Record<string, boolean>>({})
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

  // Trải quyền riêng đã lưu thành bảng tích chọn để hiển thị
  const trai = (role: UserRole | undefined, q: User['quyenRieng']) => {
    const out: Record<string, boolean> = {}
    if (!role) return out
    for (const r of RESOURCES) {
      for (const a of ACTIONS) {
        const k = khoaQuyen(r.key, a.key)
        out[k] = quyenTheoVaiTro(role, r.key, a.key)
      }
    }
    q?.them?.forEach((k: string) => { out[k] = true })
    q?.bot?.forEach((k: string) => { out[k] = false })
    return out
  }

  const openCreate = () => {
    setEditing(null); setSelectedRole(undefined); form.resetFields()
    setTuyChinhQuyen(false); setChonQuyen({}); setOpen(true)
  }
  const openEdit = (r: any) => {
    setEditing(r); setSelectedRole(r.role)
    form.setFieldsValue({ ...r, password: '', matKhauAdmin: '' })
    setTuyChinhQuyen(demQuyenRieng(r.quyenRieng) > 0)
    setChonQuyen(trai(r.role, r.quyenRieng))
    setOpen(true)
  }
  const closeModal = () => {
    setOpen(false); setEditing(null); form.resetFields(); setSelectedRole(undefined)
    setTuyChinhQuyen(false); setChonQuyen({})
  }

  // Đổi vai trò thì bảng quyền phải vẽ lại theo mặc định của vai trò mới
  const doiVaiTro = (v: UserRole) => {
    setSelectedRole(v)
    setChonQuyen(trai(v, undefined))
  }

  const onSave = async (values: any) => {
    if (!currentUser) return
    const username = editing ? editing.username : values.username

    // Không bật tùy chỉnh thì xóa hẳn quyền riêng, trả tài khoản về đúng vai trò
    const quyenRieng = tuyChinhQuyen ? tinhQuyenRieng(values.role, chonQuyen) : undefined
    const soRieng = demQuyenRieng(quyenRieng)

    // Quyền đặt mật khẩu cho người khác đi theo quyền quản trị THỰC TẾ, không
    // chỉ theo vai trò. Nếu chỉ xét vai trò thì người được cấp riêng quyền quản
    // trị vào được trang này nhưng bấm lưu mật khẩu lại bị máy chủ từ chối.
    const dichLaQuanTri = can({ role: values.role, quyenRieng }, 'admin', 'admin')

    // Mật khẩu nằm trên máy chủ, không nằm trong hồ sơ tài khoản.
    // Đặt mật khẩu là thao tác đặc quyền nên admin phải xác nhận danh tính.
    if (values.password) {
      setSaving(true)
      const kq = await adminDatMatKhau(
        currentUser.username, values.matKhauAdmin,
        username, values.password, dichLaQuanTri,
      )
      setSaving(false)
      if (!kq.ok) {
        if (kq.lyDo === 'SAI_MK_ADMIN') message.error('Mật khẩu quản trị viên không đúng, hoặc tài khoản của bạn không có quyền đặt mật khẩu.')
        else if (kq.lyDo === 'CHUA_CAU_HINH') message.error('Chưa cấu hình máy chủ. Liên hệ quản trị viên.')
        else message.error('CHƯA đặt được mật khẩu - không kết nối được máy chủ. Vui lòng thử lại.')
        return
      }
      // Đặt lại mật khẩu cho người khác là thao tác đặc quyền, phải có vết
      logAction(currentUser.id, currentUser.fullName, 'PASSWORD', 'User', {
        entityId: editing?.id,
        donViId: values.donViId ?? undefined,
        moTa: editing
          ? `Đặt lại mật khẩu cho tài khoản ${username}`
          : `Cấp mật khẩu cho tài khoản mới ${username}`,
      })
    }

    if (editing) {
      updateUser(editing.id, {
        role: values.role, donViId: values.donViId ?? null, fullName: values.fullName, quyenRieng,
      })
      message.success(
        (values.password ? 'Đã cập nhật tài khoản và đặt lại mật khẩu' : 'Đã cập nhật tài khoản')
        + (soRieng ? ` - ${soRieng} quyền tùy chỉnh` : ''),
      )
    } else {
      addUser({
        username, fullName: values.fullName, role: values.role,
        donViId: values.donViId ?? null, active: true, quyenRieng,
      })
      message.success('Đã tạo tài khoản' + (soRieng ? ` - ${soRieng} quyền tùy chỉnh` : ''))
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

  // ── Xoá hẳn tài khoản: xác nhận bằng mật khẩu quản trị; xoá mật khẩu trên máy chủ (chặn đăng nhập) rồi xoá khỏi danh sách ──
  const [dangXoa, setDangXoa] = useState<User | null>(null)
  const [mkXoa, setMkXoa] = useState('')
  const [xacNhanTen, setXacNhanTen] = useState('')
  const [dangXuLyXoa, setDangXuLyXoa] = useState(false)
  const soAdminConLai = users.filter((u) => u.active && can(u, 'admin', 'admin')).length
  const lyDoKhongXoa = (r: User): string | null => {
    if (r.id === currentUser?.id) return 'Không xoá tài khoản đang đăng nhập'
    if (r.active && can(r, 'admin', 'admin') && soAdminConLai <= 1) return 'Không xoá quản trị viên cuối cùng'
    return null
  }
  const moXoa = (r: User) => { setDangXoa(r); setMkXoa(''); setXacNhanTen('') }
  const thucHienXoa = async () => {
    if (!currentUser || !dangXoa) return
    setDangXuLyXoa(true)
    const ok = await adminXoaMatKhau(currentUser.username, mkXoa, dangXoa.username)
    setDangXuLyXoa(false)
    if (!ok) {
      message.error('Mật khẩu quản trị viên không đúng hoặc không kết nối được máy chủ - CHƯA xoá tài khoản')
      return
    }
    xoaTaiKhoan(dangXoa.id)
    message.success(`Đã xoá tài khoản ${dangXoa.username}`)
    setDangXoa(null)
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
    { title: 'Tên đăng nhập', dataIndex: 'username', key: 'un', width: 160 },
    { title: 'Họ và tên', dataIndex: 'fullName', key: 'fn', width: 280 },
    {
      title: 'Vai trò', dataIndex: 'role', key: 'role', width: 240,
      render: (v: UserRole, r: any) => {
        const so = demQuyenRieng(r.quyenRieng)
        return (
          <Space size={4} wrap>
            <Tag color={ROLE_COLOR[v]}>{ROLE_LABELS[v]}</Tag>
            {so > 0 && (
              <Tooltip
                title={[
                  r.quyenRieng?.them?.length ? `Cấp thêm: ${r.quyenRieng.them.join(', ')}` : '',
                  r.quyenRieng?.bot?.length ? `Thu hồi: ${r.quyenRieng.bot.join(', ')}` : '',
                ].filter(Boolean).join(' - ')}
              >
                <Tag color="orange">Quyền riêng ({so})</Tag>
              </Tooltip>
            )}
          </Space>
        )
      },
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
    { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'ct', width: 120, render: (v: string) => formatDate(v) },
    {
      title: 'Thao tác', key: 'act', width: 130,
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
          <Tooltip title={lyDoKhongXoa(r) ?? 'Xoá hẳn tài khoản'}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={!!lyDoKhongXoa(r)} onClick={() => moXoa(r)} />
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
          <Text type="secondary" style={{ fontSize: 13 }}>Tổng đang hoạt động: {stats.total}</Text>
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

      <Table scroll={{ x: 'max-content' }}
        dataSource={filtered}
        columns={cols}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 20 }}
        rowClassName={(r) => !r.active ? 'ant-table-row-disabled' : ''}
      />

      <Modal
        open={!!dangXoa}
        title={`Xoá hẳn tài khoản ${dangXoa?.username ?? ''}`}
        onCancel={() => setDangXoa(null)}
        onOk={thucHienXoa}
        okText="Xoá tài khoản"
        okButtonProps={{ danger: true, loading: dangXuLyXoa, disabled: !mkXoa || xacNhanTen.trim() !== dangXoa?.username }}
        cancelText="Hủy"
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="Không hoàn tác được"
          description={(
            <span>
              Tài khoản <b>{dangXoa?.fullName}</b> sẽ bị xoá khỏi danh sách và không đăng nhập được nữa (mật khẩu trên máy chủ bị xoá).
              Nhật ký, phiếu đề xuất do tài khoản này lập vẫn giữ nguyên tên người thực hiện.
              Nếu chỉ tạm ngừng sử dụng, hãy dùng nút <b>Khoá</b> thay vì xoá.
            </span>
          )}
        />
        <Form layout="vertical">
          <Form.Item label={<>Gõ lại tên đăng nhập <Text code>{dangXoa?.username}</Text> để xác nhận</>}>
            <Input value={xacNhanTen} onChange={(e) => setXacNhanTen(e.target.value)} autoComplete="off" />
          </Form.Item>
          <Form.Item label="Mật khẩu quản trị viên của bạn" style={{ marginBottom: 0 }}>
            <Input.Password value={mkXoa} onChange={(e) => setMkXoa(e.target.value)} autoComplete="current-password" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal tạo/sửa tài khoản */}
      <Modal
        open={open}
        title={editing ? `Sửa tài khoản - ${editing.username}` : 'Tạo tài khoản mới'}
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
              onChange={(v) => doiVaiTro(v as UserRole)}
              placeholder="Chọn vai trò"
            />
          </Form.Item>

          {/* Quyền của tài khoản: mặc định theo vai trò, có thể sửa tay khi cần */}
          {selectedRole && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <Text strong>Quyền của tài khoản</Text>
                <Space size={6}>
                  <Text type="secondary" style={{ fontSize: 13 }}>Tùy chỉnh riêng</Text>
                  <Switch
                    size="small"
                    checked={tuyChinhQuyen}
                    onChange={(v) => {
                      setTuyChinhQuyen(v)
                      if (!v) setChonQuyen(trai(selectedRole, undefined))
                    }}
                  />
                </Space>
              </div>
              <BangQuyen
                role={selectedRole}
                chon={chonQuyen}
                choSua={tuyChinhQuyen}
                onDoi={(k, v) => setChonQuyen((s) => ({ ...s, [k]: v }))}
              />
              {tuyChinhQuyen && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 8, fontSize: 13 }}
                  title="Tài khoản này không còn theo đúng mặc định của vai trò"
                  description="Ô nền xanh là quyền cấp thêm, nền đỏ là quyền đã thu hồi. Tắt công tắc để trả về đúng vai trò."
                />
              )}
            </>
          )}

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
