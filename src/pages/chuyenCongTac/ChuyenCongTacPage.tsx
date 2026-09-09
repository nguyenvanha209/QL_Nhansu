import { useMemo, useState } from 'react'
import {
  Card, Table, Button, Tag, Space, Typography, Modal, Form, Select, DatePicker,
  Input, App, Descriptions, Alert, Empty, Segmented,
} from 'antd'
import { SwapOutlined, PlusOutlined, CheckOutlined, CloseOutlined, LoginOutlined, SendOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useChuyenCongTacStore } from '@/store/chuyenCongTacStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useUserStore } from '@/store/userStore'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, soSanhVienChuc } from '@/utils/helpers'
import { isDangCongTac, VTVL_LABELS, CHUC_VU_LABELS } from '@/types/vienChuc'
import type { DeXuatChuyenCongTac } from '@/types/chuyenCongTac'
import { TRANG_THAI_CCT_LABELS, TRANG_THAI_CCT_COLORS } from '@/types/chuyenCongTac'

const { Title, Text } = Typography

export default function ChuyenCongTacPage() {
  const { message, modal } = App.useApp()
  const { currentUser, scopeDonViId, isAdmin } = useAuth()
  const [formTao] = Form.useForm()
  const [formNhan] = Form.useForm()

  const deXuats = useChuyenCongTacStore((s) => s.deXuats)
  const store = useChuyenCongTacStore.getState()
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const viTriViecLams = useDanhMucStore((s) => s.viTriViecLams)
  const vtvls = useDanhMucStore((s) => s.vtvls)
  const chucVus = useDanhMucStore((s) => s.chucVus)
  const users = useUserStore((s) => s.users)

  const [openTao, setOpenTao] = useState(false)
  const [nhanItem, setNhanItem] = useState<DeXuatChuyenCongTac | null>(null)
  const [xemItem, setXemItem] = useState<DeXuatChuyenCongTac | null>(null)
  const [loc, setLoc] = useState<'DANG_XU_LY' | 'TAT_CA'>('DANG_XU_LY')

  const donVis = useMemo(
    () => allDonVis.filter((d) => d.active).sort((a, b) => a.ten.localeCompare(b.ten, 'vi')),
    [allDonVis],
  )
  const dvMap = useMemo(() => new Map(donVis.map((d) => [d.id, d.ten])), [donVis])
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.fullName])), [users])

  // Viên chức của trường mình, đang công tác, chưa có phiếu chuyển nào đang mở
  const vcCoTheChuyen = useMemo(() => {
    const nguon = scopeDonViId ?? undefined
    return allVienChucs
      .filter((v) => v.active && isDangCongTac(v) && (!nguon || v.donViId === nguon))
      .filter((v) => !store.dangCoPhieuMo(v.id))
      .sort(soSanhVienChuc())
  }, [allVienChucs, scopeDonViId, deXuats, store])

  const data = useMemo(() => {
    let list = [...store.getAll(scopeDonViId)]
    if (loc === 'DANG_XU_LY') {
      list = list.filter((d) => d.trangThai !== 'HOAN_TAT' && d.trangThai !== 'TU_CHOI')
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [deXuats, scopeDonViId, loc, store])

  const soChoDuyet = useMemo(
    () => store.getAll(scopeDonViId).filter((d) => d.trangThai === 'CHO_DUYET').length,
    [deXuats, scopeDonViId, store],
  )
  const soChoTiepNhan = useMemo(
    () => store.getAll(scopeDonViId).filter((d) => d.trangThai === 'DA_DUYET'
      && (!scopeDonViId || d.donViDenId === scopeDonViId)).length,
    [deXuats, scopeDonViId, store],
  )

  // Trường đến không được trùng trường hiện tại của viên chức đang chọn
  const vienChucDangChon = Form.useWatch('vienChucId', formTao)
  const donViHienTai = useMemo(
    () => allVienChucs.find((v) => v.id === vienChucDangChon)?.donViId,
    [allVienChucs, vienChucDangChon],
  )

  // ── Hành động ──
  const onTao = async (trinhNgay: boolean) => {
    let v: any
    try {
      v = await formTao.validateFields()
    } catch {
      return // antd đã hiện lỗi ngay trên từng ô
    }
    if (!currentUser) return
    const vc = allVienChucs.find((x) => x.id === v.vienChucId)
    if (!vc) return
    if (v.donViDenId === vc.donViId) { message.error('Trường đến phải khác trường hiện tại'); return }

    store.taoDeXuat({
      vienChucId: vc.id,
      hoTenSnapshot: `${vc.ho} ${vc.ten}`.trim(),
      donViDiId: vc.donViId,
      donViDenId: v.donViDenId,
      ngayChuyen: v.ngayChuyen.format('YYYY-MM-DD'),
      lyDo: v.lyDo,
      ghiChu: v.ghiChu,
      nguoiDeXuatId: currentUser.id,
      ngayDeXuat: dayjs().format('YYYY-MM-DD'),
    }, trinhNgay)

    message.success(trinhNgay ? 'Đã tạo và trình đề nghị lên Quản trị' : 'Đã lưu bản nháp')
    setOpenTao(false)
    formTao.resetFields()
  }

  const onDuyet = (r: DeXuatChuyenCongTac) => {
    let ghiChu = ''
    modal.confirm({
      title: `Duyệt chuyển công tác — ${r.hoTenSnapshot}`,
      width: 560,
      content: (
        <div>
          <p style={{ margin: '8px 0' }}>
            Chuyển từ <b>{dvMap.get(r.donViDiId)}</b> sang <b>{dvMap.get(r.donViDenId)}</b>,
            hiệu lực {formatDate(r.ngayChuyen)}.
          </p>
          <Alert
            type="info" showIcon style={{ margin: '10px 0' }}
            title="Hồ sơ giữ nguyên ngạch, bậc, hệ số lương và các khoản phụ cấp"
            description="Sau khi duyệt, hồ sơ chuyển sang trường đến ở trạng thái “Chuyển đến”. Trường đến sẽ phân công vị trí việc làm và ghi nhận ngày về đơn vị."
          />
          <Input.TextArea rows={2} placeholder="Ý kiến của Quản trị (không bắt buộc)" onChange={(e) => { ghiChu = e.target.value }} />
        </div>
      ),
      okText: 'Duyệt chuyển',
      cancelText: 'Hủy',
      onOk: () => {
        store.duyet(r.id, ghiChu, currentUser!.id, currentUser!.fullName)
        message.success(`Đã duyệt. Hồ sơ ${r.hoTenSnapshot} đã chuyển sang ${dvMap.get(r.donViDenId)}`)
      },
    })
  }

  const onTuChoi = (r: DeXuatChuyenCongTac) => {
    let ghiChu = ''
    modal.confirm({
      title: `Từ chối đề nghị — ${r.hoTenSnapshot}`,
      content: <Input.TextArea rows={3} placeholder="Lý do từ chối" onChange={(e) => { ghiChu = e.target.value }} style={{ marginTop: 10 }} />,
      okText: 'Từ chối', okButtonProps: { danger: true }, cancelText: 'Hủy',
      onOk: () => {
        if (!ghiChu.trim()) { message.error('Nhập lý do từ chối'); return Promise.reject() }
        store.tuChoi(r.id, ghiChu, currentUser!.id, currentUser!.fullName)
        message.success('Đã từ chối đề nghị')
      },
    })
  }

  const moTiepNhan = (r: DeXuatChuyenCongTac) => {
    const vc = allVienChucs.find((x) => x.id === r.vienChucId)
    formNhan.setFieldsValue({
      vtvl: vc?.vtvl,
      chucVu: vc?.chucVu,
      viTriViecLamId: undefined,
      ngayVaoDonVi: dayjs(r.ngayChuyen),
    })
    setNhanItem(r)
  }

  const onTiepNhan = async () => {
    const v = await formNhan.validateFields()
    if (!nhanItem || !currentUser) return
    store.tiepNhan(nhanItem.id, {
      vtvl: v.vtvl,
      chucVu: v.chucVu || undefined,
      viTriViecLamId: v.viTriViecLamId || undefined,
      ngayVaoDonVi: v.ngayVaoDonVi.format('YYYY-MM-DD'),
    }, currentUser.id, currentUser.fullName)
    message.success(`Đã tiếp nhận ${nhanItem.hoTenSnapshot} về đơn vị`)
    setNhanItem(null)
    formNhan.resetFields()
  }

  // Vị trí việc làm của trường đến
  const vtvlOptionsCuaTruongDen = useMemo(() => {
    if (!nhanItem) return []
    return viTriViecLams
      .filter((v) => v.active && v.donViId === nhanItem.donViDenId)
      .map((v) => ({ value: v.id, label: v.ten }))
  }, [nhanItem, viTriViecLams])

  const columns = [
    { title: 'Mã phiếu', dataIndex: 'ma', key: 'ma', width: 130,
      render: (v: string) => <Text code>{v}</Text>,
      sorter: (a: DeXuatChuyenCongTac, b: DeXuatChuyenCongTac) => a.ma.localeCompare(b.ma) },
    { title: 'Viên chức', dataIndex: 'hoTenSnapshot', key: 'ht', minWidth: 160,
      sorter: (a: DeXuatChuyenCongTac, b: DeXuatChuyenCongTac) => a.hoTenSnapshot.localeCompare(b.hoTenSnapshot, 'vi') },
    { title: 'Trường đi', dataIndex: 'donViDiId', key: 'di', minWidth: 150,
      render: (v: string) => dvMap.get(v) ?? v,
      sorter: (a: DeXuatChuyenCongTac, b: DeXuatChuyenCongTac) => (dvMap.get(a.donViDiId) ?? '').localeCompare(dvMap.get(b.donViDiId) ?? '', 'vi') },
    { title: '', key: 'arrow', width: 34, align: 'center' as const, render: () => <SwapOutlined style={{ color: '#1677ff' }} /> },
    { title: 'Trường đến', dataIndex: 'donViDenId', key: 'den', minWidth: 150,
      render: (v: string) => dvMap.get(v) ?? v,
      sorter: (a: DeXuatChuyenCongTac, b: DeXuatChuyenCongTac) => (dvMap.get(a.donViDenId) ?? '').localeCompare(dvMap.get(b.donViDenId) ?? '', 'vi') },
    { title: 'Ngày chuyển', dataIndex: 'ngayChuyen', key: 'nc', width: 115,
      render: (v: string) => formatDate(v),
      sorter: (a: DeXuatChuyenCongTac, b: DeXuatChuyenCongTac) => a.ngayChuyen.localeCompare(b.ngayChuyen) },
    { title: 'Trạng thái', dataIndex: 'trangThai', key: 'tt', width: 190,
      render: (v: DeXuatChuyenCongTac['trangThai']) => (
        <Tag color={TRANG_THAI_CCT_COLORS[v]}>{TRANG_THAI_CCT_LABELS[v]}</Tag>
      ) },
    {
      title: 'Thao tác', key: 'act', width: 230, fixed: 'right' as const,
      render: (_: any, r: DeXuatChuyenCongTac) => {
        const laTruongDi = !scopeDonViId || r.donViDiId === scopeDonViId
        const laTruongDen = !scopeDonViId || r.donViDenId === scopeDonViId
        return (
          <Space size="small" wrap>
            <Button size="small" onClick={() => setXemItem(r)}>Xem</Button>

            {r.trangThai === 'NHAP' && laTruongDi && (
              <>
                <Button size="small" type="primary" icon={<SendOutlined />}
                  onClick={() => { store.trinhDuyet(r.id, currentUser!.id, currentUser!.fullName); message.success('Đã trình lên Quản trị') }}>
                  Trình duyệt
                </Button>
                <Button size="small" danger icon={<DeleteOutlined />}
                  onClick={() => modal.confirm({
                    title: 'Xóa bản nháp này?', okText: 'Xóa', cancelText: 'Hủy', okButtonProps: { danger: true },
                    onOk: () => { store.xoa(r.id); message.success('Đã xóa') },
                  })} />
              </>
            )}

            {r.trangThai === 'CHO_DUYET' && isAdmin && (
              <>
                <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => onDuyet(r)}>Duyệt</Button>
                <Button size="small" danger icon={<CloseOutlined />} onClick={() => onTuChoi(r)}>Từ chối</Button>
              </>
            )}

            {r.trangThai === 'DA_DUYET' && laTruongDen && (
              <Button size="small" type="primary" icon={<LoginOutlined />} onClick={() => moTiepNhan(r)}>
                Tiếp nhận
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <Title level={4} style={{ margin: 0 }}>
          Chuyển công tác viên chức
          {soChoDuyet > 0 && isAdmin && <Tag color="processing" style={{ marginLeft: 8 }}>{soChoDuyet} chờ duyệt</Tag>}
          {soChoTiepNhan > 0 && <Tag color="warning" style={{ marginLeft: 4 }}>{soChoTiepNhan} chờ tiếp nhận</Tag>}
        </Title>
        <Space>
          <Segmented
            value={loc}
            onChange={(v) => setLoc(v as any)}
            options={[{ label: 'Đang xử lý', value: 'DANG_XU_LY' }, { label: 'Tất cả', value: 'TAT_CA' }]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenTao(true)}>
            Đề nghị chuyển đi
          </Button>
        </Space>
      </div>

      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        title="Quy trình: Trường đi lập đề nghị → Quản trị duyệt → Hồ sơ tự chuyển sang trường đến → Trường đến phân công vị trí và ghi ngày về đơn vị"
        description="Ngạch, bậc, hệ số lương và các khoản phụ cấp được giữ nguyên trong suốt quá trình chuyển."
      />

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        scroll={{ x: 1200, y: 'calc(100vh - 380px)' }}
        pagination={{ pageSize: 20, showTotal: (t) => `Tổng ${t} phiếu` }}
        locale={{ emptyText: <Empty description="Chưa có phiếu chuyển công tác nào" /> }}
      />

      {/* ── Tạo đề nghị ── */}
      <Modal
        title="Đề nghị chuyển công tác viên chức"
        open={openTao}
        onCancel={() => { setOpenTao(false); formTao.resetFields() }}
        width={620}
        footer={[
          <Button key="c" onClick={() => { setOpenTao(false); formTao.resetFields() }}>Hủy</Button>,
          <Button key="d" onClick={() => onTao(false)}>Lưu bản nháp</Button>,
          <Button key="s" type="primary" icon={<SendOutlined />} onClick={() => onTao(true)}>Lưu &amp; Trình duyệt</Button>,
        ]}
      >
        <Form form={formTao} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="vienChucId" label="Viên chức chuyển đi" rules={[{ required: true, message: 'Chọn viên chức' }]}>
            <Select
              showSearch
              placeholder="Tìm theo họ tên..."
              optionFilterProp="label"
              options={vcCoTheChuyen.map((v) => ({
                value: v.id,
                label: `${v.ho} ${v.ten}${scopeDonViId ? '' : ` — ${dvMap.get(v.donViId) ?? ''}`}`,
              }))}
              notFoundContent={<Empty description="Không còn viên chức nào có thể lập phiếu" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            />
          </Form.Item>
          <Form.Item name="donViDenId" label="Trường đến" rules={[{ required: true, message: 'Chọn trường đến' }]}>
            <Select showSearch optionFilterProp="label" placeholder="Chọn đơn vị tiếp nhận"
              options={donVis
                .filter((d) => d.id !== scopeDonViId && d.id !== donViHienTai)
                .map((d) => ({ value: d.id, label: d.ten }))} />
          </Form.Item>
          <Form.Item name="ngayChuyen" label="Ngày chuyển (hiệu lực)" rules={[{ required: true, message: 'Chọn ngày chuyển' }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="lyDo" label="Lý do chuyển" rules={[{ required: true, message: 'Nhập lý do' }]}>
            <Input placeholder="VD: Điều động theo Quyết định số 45/QĐ-UBND ngày 01/8/2026" />
          </Form.Item>
          <Form.Item name="ghiChu" label="Ghi chú">
            <Input.TextArea rows={2} placeholder="Thông tin thêm (không bắt buộc)" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Tiếp nhận ── */}
      <Modal
        title={`Tiếp nhận về đơn vị — ${nhanItem?.hoTenSnapshot ?? ''}`}
        open={!!nhanItem}
        onCancel={() => { setNhanItem(null); formNhan.resetFields() }}
        onOk={onTiepNhan}
        okText="Xác nhận tiếp nhận"
        cancelText="Hủy"
        width={600}
      >
        <Alert
          type="success" showIcon style={{ margin: '12px 0 16px' }}
          title="Ngạch, bậc, hệ số lương và phụ cấp đã được giữ nguyên"
          description="Chỉ cần phân công vị trí công tác tại trường và xác nhận thời điểm về đơn vị."
        />
        <Form form={formNhan} layout="vertical">
          <Form.Item name="vtvl" label="Vị trí việc làm" rules={[{ required: true, message: 'Chọn vị trí việc làm' }]}>
            <Select
              placeholder="Cán bộ quản lý / Giáo viên / Nhân viên"
              options={(vtvls.length ? vtvls.filter((v) => v.active).map((v) => ({ value: v.ma, label: v.ten }))
                : Object.entries(VTVL_LABELS).map(([k, v]) => ({ value: k, label: v })))}
            />
          </Form.Item>
          <Form.Item name="chucVu" label="Chức vụ" extra="Để trống nếu không giữ chức vụ quản lý">
            <Select
              allowClear
              placeholder="Không giữ chức vụ"
              options={(chucVus.length ? chucVus.filter((c) => c.active).map((c) => ({ value: c.ma, label: c.ten }))
                : Object.entries(CHUC_VU_LABELS).map(([k, v]) => ({ value: k, label: v })))}
            />
          </Form.Item>
          <Form.Item name="viTriViecLamId" label="Phân công vị trí cụ thể tại trường"
            extra={vtvlOptionsCuaTruongDen.length === 0 ? 'Trường chưa khai báo danh mục vị trí việc làm — có thể bỏ qua' : undefined}>
            <Select allowClear placeholder="Chọn vị trí" options={vtvlOptionsCuaTruongDen} />
          </Form.Item>
          <Form.Item name="ngayVaoDonVi" label="Thời điểm về đơn vị" rules={[{ required: true, message: 'Chọn ngày về đơn vị' }]}
            extra="Ngày này được ghi vào hồ sơ viên chức làm mốc công tác tại trường">
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Xem chi tiết ── */}
      <Modal
        title={`Phiếu ${xemItem?.ma ?? ''}`}
        open={!!xemItem}
        onCancel={() => setXemItem(null)}
        footer={<Button onClick={() => setXemItem(null)}>Đóng</Button>}
        width={680}
      >
        {xemItem && (
          <Descriptions bordered size="small" column={1} style={{ marginTop: 12 }}>
            <Descriptions.Item label="Viên chức">{xemItem.hoTenSnapshot}</Descriptions.Item>
            <Descriptions.Item label="Chuyển từ">{dvMap.get(xemItem.donViDiId)}</Descriptions.Item>
            <Descriptions.Item label="Chuyển đến">{dvMap.get(xemItem.donViDenId)}</Descriptions.Item>
            <Descriptions.Item label="Ngày chuyển">{formatDate(xemItem.ngayChuyen)}</Descriptions.Item>
            <Descriptions.Item label="Lý do">{xemItem.lyDo}</Descriptions.Item>
            {xemItem.ghiChu && <Descriptions.Item label="Ghi chú">{xemItem.ghiChu}</Descriptions.Item>}
            <Descriptions.Item label="Trạng thái">
              <Tag color={TRANG_THAI_CCT_COLORS[xemItem.trangThai]}>{TRANG_THAI_CCT_LABELS[xemItem.trangThai]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Người đề nghị">
              {userMap.get(xemItem.nguoiDeXuatId) ?? '—'} · {formatDate(xemItem.ngayDeXuat)}
            </Descriptions.Item>
            {xemItem.nguoiDuyetId && (
              <Descriptions.Item label="Quản trị duyệt">
                {userMap.get(xemItem.nguoiDuyetId) ?? '—'} · {formatDate(xemItem.ngayDuyet!)}
                {xemItem.ghiChuDuyet && <div><Text type="secondary">{xemItem.ghiChuDuyet}</Text></div>}
              </Descriptions.Item>
            )}
            {xemItem.nguoiTiepNhanId && (
              <Descriptions.Item label="Trường đến tiếp nhận">
                {userMap.get(xemItem.nguoiTiepNhanId) ?? '—'} · {formatDate(xemItem.ngayTiepNhan!)}
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">
                    Vị trí: {VTVL_LABELS[xemItem.vtvlMoi ?? ''] ?? xemItem.vtvlMoi ?? '—'}
                    {xemItem.chucVuMoi ? ` · Chức vụ: ${CHUC_VU_LABELS[xemItem.chucVuMoi] ?? xemItem.chucVuMoi}` : ''}
                    {' · Về đơn vị từ '}{formatDate(xemItem.ngayVaoDonViMoi!)}
                  </Text>
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </Card>
  )
}
