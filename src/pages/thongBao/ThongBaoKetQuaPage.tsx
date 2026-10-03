import { useEffect, useMemo, useState } from 'react'
import {
  Card, Typography, Select, Segmented, Tabs, Button, Space, Table, Tag, Alert, Input, DatePicker, App, Empty, Row, Col,
  Statistic, Badge, Tooltip, Descriptions,
} from 'antd'
import {
  SyncOutlined, SaveOutlined, SendOutlined, DownloadOutlined, FileWordOutlined, DeleteOutlined, RollbackOutlined,
  NotificationOutlined, CheckCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/hooks/useAuth'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { useThongBaoStore } from '@/store/thongBaoStore'
import {
  type CapHocTB, type DongThongBao, type KyXet, type LoaiThongBaoKQ, type ThongBaoKetQua,
  LOAI_THONG_BAO_KQ, TEN_CAP_TB, idThongBao, khoangKy, tenKy,
} from '@/types/thongBao'
import { demTheoNhom, noiDungThongBao, sapXepDong, taiWordThongBao, tongHopDanhSach, xuatExcelThongBao } from '@/utils/thongBaoKetQua'
import { formatDate, formatDatetime } from '@/utils/helpers'
import { danhDauDaXem, daXemThongBao } from '@/utils/thongBaoDaXem'

const { Title, Text, Paragraph } = Typography

const CAC_LOAI: LoaiThongBaoKQ[] = ['NANG_LUONG_TX', 'PCTN_LAN_DAU', 'PCTN_NANG']
const CAC_CAP: CapHocTB[] = ['MAM_NON', 'TIEU_HOC', 'THCS']
const kyHienHanh = (): { nam: number; ky: KyXet } => {
  const d = dayjs()
  // Kỳ 6 tháng đầu xét vào tháng 6, công bố đầu tháng 7; kỳ 6 tháng cuối xét tháng 12
  return { nam: d.year(), ky: d.month() < 6 ? 'H1' : 'H2' }
}

export default function ThongBaoKetQuaPage() {
  const { isVHXH, laQuanTri, hasPermission, scopeDonViId } = useAuth()
  // Phòng VH-XH (còn quyền duyệt đề xuất) và Admin lập, ban hành; các tài khoản khác chỉ xem bản đã ban hành
  const coTheLap = laQuanTri || (isVHXH && hasPermission('deXuat', 'approve') && !scopeDonViId)
  return coTheLap ? <QuanLyThongBao /> : <XemThongBao />
}

// ───────────────────────────── Phòng VH-XH: lập và ban hành ─────────────────────────────

function QuanLyThongBao() {
  const [{ nam, ky }, setKy] = useState(kyHienHanh)
  const [loai, setLoai] = useState<LoaiThongBaoKQ>('NANG_LUONG_TX')
  const thongBaos = useThongBaoStore((s) => s.thongBaos)
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const donVis = useDanhMucStore((s) => s.donVis)

  // Phiếu trong kỳ còn đang ở các bước trước - nhắc để không bỏ sót người khi tổng hợp
  const conDangXuLy = useMemo(() => {
    const { tu, den } = khoangKy(ky, nam)
    return deXuats.filter((d) => (d.loai === 'NANG_BAC' || d.loai === 'PHU_CAP_THAM_NIEN' || d.loai === 'PCTN_LAN_DAU')
      && ['NHAP', 'CHO_HIEU_TRUONG_DUYET', 'CHO_XET_DUYET', 'CHO_PHE_DUYET', 'YEU_CAU_BO_SUNG'].includes(d.trangThai)
      && d.chiTiet.some((c) => c.ngayHieuLuc >= tu && c.ngayHieuLuc <= den))
  }, [deXuats, nam, ky])

  const namOptions = [nam - 1, nam, nam + 1].map((n) => ({ value: n, label: `Năm ${n}` }))

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Thông báo kết quả nâng lương, phụ cấp thâm niên</Title>
          <Text type="secondary">
            Tổng hợp từ các phiếu đề xuất đã được phê duyệt (hồ sơ viên chức đã cập nhật), theo mẫu thông báo của UBND phường; ban hành xong các trường nhận theo cấp học.
          </Text>
        </div>
        <Space wrap>
          <Select value={nam} options={namOptions} onChange={(v) => setKy({ nam: v, ky })} style={{ width: 120 }} />
          <Segmented<KyXet>
            value={ky}
            onChange={(v) => setKy({ nam, ky: v })}
            options={[{ value: 'H1', label: '6 tháng đầu năm' }, { value: 'H2', label: '6 tháng cuối năm' }]}
          />
        </Space>
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title={`Kỳ ${tenKy(ky, nam)}: xét đến hết ${formatDate(khoangKy(ky, nam).den)}; Phòng VH-XH thẩm định và trình UBND phường ra thông báo vào tháng ${ky === 'H1' ? 6 : 12}.`}
        description={conDangXuLy.length > 0
          ? `Còn ${conDangXuLy.length} phiếu nâng lương / phụ cấp thâm niên trong kỳ chưa được phê duyệt (${[...new Set(conDangXuLy.map((d) => donVis.find((v) => v.id === d.donViId)?.ten ?? ''))].join(', ')}) - chưa được đưa vào thông báo.`
          : 'Thông báo đưa vào các phiếu đã được lãnh đạo phê duyệt, tức hồ sơ lương, phụ cấp của viên chức đã cập nhật. Người đã có trong thông báo kỳ trước không bị đưa trùng.'}
      />
      <Tabs
        activeKey={loai}
        onChange={(k) => setLoai(k as LoaiThongBaoKQ)}
        items={CAC_LOAI.map((l) => {
          const tb = thongBaos.find((t) => t.id === idThongBao(l, nam, ky))
          return {
            key: l,
            label: (
              <Space size={6}>
                {LOAI_THONG_BAO_KQ[l].tenNgan}
                {tb?.trangThai === 'DA_BAN_HANH'
                  ? <Tag color="success" style={{ marginInlineEnd: 0 }}>Đã ban hành</Tag>
                  : tb ? <Tag color="gold" style={{ marginInlineEnd: 0 }}>Nháp</Tag> : null}
              </Space>
            ),
            children: <LapThongBao key={`${l}-${nam}-${ky}`} loai={l} nam={nam} ky={ky} />,
          }
        })}
      />
    </Card>
  )
}

function LapThongBao({ loai, nam, ky }: { loai: LoaiThongBaoKQ; nam: number; ky: KyXet }) {
  const { message, modal } = App.useApp()
  const { currentUser } = useAuth()
  const id = idThongBao(loai, nam, ky)
  const thongBaos = useThongBaoStore((s) => s.thongBaos)
  const luuThongBao = useThongBaoStore((s) => s.luuThongBao)
  const xoaThongBao = useThongBaoStore((s) => s.xoaThongBao)
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)

  const daLuu = thongBaos.find((t) => t.id === id)
  const nguoiKyTruoc = [...thongBaos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).find((t) => t.nguoiKy)?.nguoiKy ?? ''
  const [ban, setBan] = useState<ThongBaoKetQua | undefined>(daLuu)
  useEffect(() => { setBan(daLuu) }, [daLuu?.updatedAt])
  const daBanHanh = ban?.trangThai === 'DA_BAN_HANH'

  const tongHop = (): DongThongBao[] => tongHopDanhSach(loai, nam, ky, {
    deXuats, vienChucs, donVis, chucDanhs, heSoLuongs,
    thongBaoKhac: thongBaos.filter((t) => t.id !== id),
  })
  const ungVien = useMemo(tongHop, [deXuats, vienChucs, donVis, chucDanhs, heSoLuongs, thongBaos, loai, nam, ky])

  const taoBan = () => setBan({
    id, loai, nam, ky, soThongBao: '', ngayThongBao: '', nguoiKy: nguoiKyTruoc, trangThai: 'NHAP',
    dong: ungVien, nguoiLapId: currentUser?.id, nguoiLap: currentUser?.fullName, createdAt: '', updatedAt: '',
  })

  // Tổng hợp lại: thêm người mới đủ điều kiện, giữ ghi chú đã sửa, bỏ người không còn trong phiếu
  const tongHopLai = () => {
    if (!ban) return
    const moi = tongHop()
    const cu = new Map(ban.dong.map((d) => [d.key, d]))
    const ds = moi.map((d) => {
      const c = cu.get(d.key)
      return c ? { ...d, ghiChu: c.ghiChu, ngayTotNghiep: c.ngayTotNghiep } : d
    })
    const them = moi.filter((d) => !cu.has(d.key)).length
    const bo = ban.dong.filter((d) => !moi.some((m) => m.key === d.key)).length
    setBan({ ...ban, dong: ds })
    message.info(`Đã tổng hợp lại: ${ds.length} người${them ? `, thêm ${them}` : ''}${bo ? `, bỏ ${bo} (phiếu không còn đủ điều kiện)` : ''}`)
  }

  const luu = (trangThai: ThongBaoKetQua['trangThai'] = 'NHAP', them?: Partial<ThongBaoKetQua>) => {
    if (!ban) return
    const { createdAt: _c, updatedAt: _u, ...du } = { ...ban, ...them, trangThai }
    luuThongBao(du)
  }

  const banHanh = () => {
    if (!ban) return
    const thieu = [!ban.soThongBao.trim() && 'số thông báo', !ban.ngayThongBao && 'ngày thông báo', !ban.nguoiKy.trim() && 'người ký'].filter(Boolean)
    if (thieu.length) { message.error(`Nhập ${thieu.join(', ')} trước khi ban hành`); return }
    if (!ban.dong.length) { message.error('Danh sách chưa có ai'); return }
    const choPheDuyet = ban.dong.filter((d) => !d.daPheDuyet).length
    modal.confirm({
      title: `Ban hành Thông báo số ${ban.soThongBao}/TB-UBND?`,
      content: (
        <div>
          <p>{ban.dong.length} người, gửi tới kế toán, hiệu trưởng các trường theo cấp học.</p>
          {choPheDuyet > 0 && <Alert type="warning" showIcon title={`${choPheDuyet} người thuộc phiếu chưa được lãnh đạo phê duyệt trên phần mềm`} description="Hồ sơ lương của những người này chỉ tự cập nhật khi phiếu được phê duyệt." />}
        </div>
      ),
      okText: 'Ban hành',
      onOk: () => {
        luu('DA_BAN_HANH', { banHanhLuc: new Date().toISOString(), nguoiBanHanh: currentUser?.fullName })
        message.success('Đã ban hành - các trường sẽ thấy thông báo theo cấp học')
      },
    })
  }

  if (!ban) {
    return (
      <div style={{ padding: '8px 0' }}>
        <Empty
          description={(
            <span>
              Chưa lập thông báo <b>{LOAI_THONG_BAO_KQ[loai].ten}</b> kỳ {tenKy(ky, nam)}.<br />
              Có <b>{ungVien.length}</b> người từ các phiếu đã phê duyệt đủ điều kiện đưa vào
              {ungVien.length > 0 && ` (${CAC_CAP.map((c) => `${TEN_CAP_TB[c].danhSach.replace('Các trường ', '')}: ${ungVien.filter((d) => d.cap === c).length}`).join('; ')})`}.
            </span>
          )}
        >
          <Button type="primary" icon={<SyncOutlined />} onClick={taoBan} disabled={!ungVien.length}>Lập thông báo từ phiếu đã phê duyệt</Button>
        </Empty>
      </div>
    )
  }

  const dem = demTheoNhom(ban.dong)
  const nd = noiDungThongBao(ban)
  const doiDong = (key: string, patch: Partial<DongThongBao>) => setBan({ ...ban, dong: ban.dong.map((d) => (d.key === key ? { ...d, ...patch } : d)) })
  const xoaDong = (key: string) => setBan({ ...ban, dong: ban.dong.filter((d) => d.key !== key) })
  const coThayDoi = !daLuu || JSON.stringify(daLuu) !== JSON.stringify(ban)

  return (
    <>
      <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} lg={14}>
          <Space wrap align="end">
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>Số thông báo</Text>
              <Input addonAfter="/TB-UBND" value={ban.soThongBao} disabled={daBanHanh} onChange={(e) => setBan({ ...ban, soThongBao: e.target.value })} style={{ width: 190 }} placeholder="VD 422" />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>Ngày thông báo</Text>
              <DatePicker format="DD/MM/YYYY" value={ban.ngayThongBao ? dayjs(ban.ngayThongBao) : null} disabled={daBanHanh} onChange={(d) => setBan({ ...ban, ngayThongBao: d ? d.format('YYYY-MM-DD') : '' })} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>Người ký (TM. UBND - Chủ tịch)</Text>
              <Input value={ban.nguoiKy} disabled={daBanHanh} onChange={(e) => setBan({ ...ban, nguoiKy: e.target.value })} style={{ width: 200 }} placeholder="Họ tên người ký" />
            </div>
          </Space>
        </Col>
        <Col xs={24} lg={10}>
          <Row gutter={8}>
            <Col span={6}><Statistic title="Tổng số" value={dem.tong} /></Col>
            <Col span={6}><Statistic title="CBQL" value={dem.cbql} /></Col>
            <Col span={6}><Statistic title="Giáo viên" value={dem.gv} /></Col>
            {loai === 'NANG_LUONG_TX' && <Col span={6}><Statistic title="Nhân viên" value={dem.nv} /></Col>}
          </Row>
        </Col>
      </Row>

      <Space wrap style={{ marginBottom: 12 }}>
        {daBanHanh ? (
          <>
            <Tag color="success" icon={<CheckCircleOutlined />} style={{ padding: '4px 10px' }}>
              Đã ban hành {ban.banHanhLuc ? formatDatetime(ban.banHanhLuc) : ''}{ban.nguoiBanHanh ? ` - ${ban.nguoiBanHanh}` : ''}
            </Tag>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => modal.confirm({
                title: 'Chuyển thông báo về bản nháp?',
                content: 'Các trường sẽ không còn thấy thông báo này cho tới khi ban hành lại. Dùng khi cần sửa sai sót.',
                okText: 'Chuyển về nháp', okButtonProps: { danger: true },
                onOk: () => luu('NHAP', { banHanhLuc: undefined, nguoiBanHanh: undefined }),
              })}
            >
              Chuyển về nháp
            </Button>
          </>
        ) : (
          <>
            <Button icon={<SyncOutlined />} onClick={tongHopLai}>Tổng hợp lại</Button>
            <Button icon={<SaveOutlined />} disabled={!coThayDoi} onClick={() => { luu('NHAP'); message.success('Đã lưu nháp') }}>Lưu nháp</Button>
            <Button type="primary" icon={<SendOutlined />} onClick={banHanh}>Ban hành</Button>
            {daLuu && (
              <Button danger icon={<DeleteOutlined />} onClick={() => modal.confirm({ title: 'Xoá bản nháp thông báo này?', okText: 'Xoá', okButtonProps: { danger: true }, onOk: () => { xoaThongBao(id); setBan(undefined) } })}>
                Xoá nháp
              </Button>
            )}
          </>
        )}
        <Button icon={<DownloadOutlined />} onClick={() => xuatExcelThongBao(ban)}>Danh sách (Excel)</Button>
        <Button icon={<FileWordOutlined />} onClick={() => taiWordThongBao(ban)}>Thông báo (Word)</Button>
      </Space>
      {!daBanHanh && ungVien.some((u) => !ban.dong.some((d) => d.key === u.key)) && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={`Có ${ungVien.filter((u) => !ban.dong.some((d) => d.key === u.key)).length} người mới đủ điều kiện chưa có trong danh sách - bấm "Tổng hợp lại" để đưa vào`} />
      )}

      <Card size="small" title="Nội dung thông báo (xem trước)" style={{ marginBottom: 12 }}>
        <Paragraph strong style={{ textAlign: 'center', marginBottom: 4 }}>THÔNG BÁO<br />{nd.tieuDe}</Paragraph>
        {nd.doan.slice(0, 2).map((t) => <Paragraph key={t} style={{ marginBottom: 6, textIndent: 24 }}>{t}</Paragraph>)}
        <Text type="secondary" style={{ fontSize: 13 }}>Phần căn cứ và nơi nhận có đầy đủ trong file Word.</Text>
      </Card>

      <BangDanhSach tb={ban} sua={!daBanHanh} onDoi={doiDong} onXoa={xoaDong} />
    </>
  )
}

// ───────────────────────────── Bảng danh sách (dùng chung) ─────────────────────────────

type DongBang = (DongThongBao & { loaiDong: 'dong'; stt: number }) | { key: string; loaiDong: 'nhom'; ten: string; so: number }

function BangDanhSach({ tb, sua, onDoi, onXoa, chiCap, truongMinh }: {
  tb: ThongBaoKetQua; sua?: boolean; onDoi?: (key: string, patch: Partial<DongThongBao>) => void; onXoa?: (key: string) => void
  chiCap?: CapHocTB; truongMinh?: string
}) {
  const data: DongBang[] = []
  for (const cap of CAC_CAP) {
    if (chiCap && cap !== chiCap) continue
    const ds = sapXepDong(tb.dong.filter((d) => d.cap === cap))
    if (!ds.length) continue
    data.push({ key: `nhom-${cap}`, loaiDong: 'nhom', ten: TEN_CAP_TB[cap].danhSach, so: ds.length })
    ds.forEach((d, i) => data.push({ ...d, loaiDong: 'dong', stt: i + 1 }))
  }
  if (!data.length) return <Empty description="Danh sách trống" />

  const la = (r: DongBang): r is Extract<DongBang, { loaiDong: 'dong' }> => r.loaiDong === 'dong'
  const pct = (n?: number) => (n ? `${n}%` : '')
  const hs = (n?: number) => (n == null ? '' : n.toFixed(2))
  const truongCot = { title: 'Trường', dataIndex: 'donViNgan', key: 'dv', width: 130 }

  const cotRieng = tb.loai === 'NANG_LUONG_TX'
    ? [
        { title: 'Chức vụ', dataIndex: 'chucVu', key: 'cv', width: 110 },
        truongCot,
        { title: 'Mã CDNN', dataIndex: 'maChucDanh', key: 'ma', width: 95 },
        {
          title: 'Đang hưởng', key: 'cu', width: 190,
          render: (_: unknown, r: DongBang) => la(r) && (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              Bậc {r.bacCu} - {hs(r.heSoCu)}{r.tnvkCuPct ? ` + VK ${r.tnvkCuPct}%` : ''}
              <div style={{ fontSize: 13, color: '#64748b' }}>từ {formatDate(r.mocCu ?? '')}{r.baoLuu ? ` · BL ${hs(r.baoLuu)}` : ''}</div>
            </span>
          ),
        },
        {
          title: 'Nâng năm ' + tb.nam, key: 'moi', width: 200,
          render: (_: unknown, r: DongBang) => la(r) && (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              <b>Bậc {r.bacMoi} - {hs(r.heSoMoi)}{r.tnvkMoiPct ? ` + VK ${r.tnvkMoiPct}%` : ''}</b>
              {r.laVuotKhung && <Tag color="purple" style={{ marginInlineStart: 6, fontSize: 11 }}>Vượt khung</Tag>}
              <div style={{ fontSize: 13, color: '#64748b' }}>từ {formatDate(r.mocMoi ?? '')}</div>
            </span>
          ),
        },
      ]
    : tb.loai === 'PCTN_LAN_DAU'
      ? [
          { title: 'Chức danh, trường', key: 'cd', width: 190, render: (_: unknown, r: DongBang) => la(r) && `${r.chucVu} - ${r.donViNgan}` },
          { title: 'Ngày tuyển dụng', key: 'td', width: 105, render: (_: unknown, r: DongBang) => la(r) && formatDate(r.ngayTuyenDung ?? '') },
          { title: 'Trình độ', dataIndex: 'trinhDo', key: 'trd', width: 150, ellipsis: true },
          {
            title: 'Ngày tốt nghiệp', key: 'tn', width: 130,
            render: (_: unknown, r: DongBang) => la(r) && (sua
              ? <DatePicker size="small" format="DD/MM/YYYY" value={r.ngayTotNghiep ? dayjs(r.ngayTotNghiep) : null} onChange={(d) => onDoi?.(r.key, { ngayTotNghiep: d?.format('YYYY-MM-DD') })} />
              : formatDate(r.ngayTotNghiep ?? '')),
          },
          { title: 'Bắt đầu đóng BHXH', dataIndex: 'thangBatDauBhxh', key: 'bh', width: 95 },
          { title: 'Mã CDNN', dataIndex: 'maChucDanh', key: 'ma', width: 95 },
          {
            title: 'Tỷ lệ - mốc xét - thời gian hưởng', key: 'qt', width: 250,
            render: (_: unknown, r: DongBang) => la(r) && (r.quaTrinh?.length
              ? r.quaTrinh.map((q) => <div key={q.mocXet} style={{ fontVariantNumeric: 'tabular-nums' }}><b>{q.tyLe}%</b> · {formatDate(q.mocXet)} · hưởng {formatDate(q.thoiGianHuong)}</div>)
              : <span><b>{pct(r.pctnMoi)}</b> · hưởng {formatDate(r.mocMoi ?? '')}</span>),
          },
        ]
      : [
          { title: 'Chức vụ', dataIndex: 'chucVu', key: 'cv', width: 110 },
          truongCot,
          { title: 'Mã CDNN', dataIndex: 'maChucDanh', key: 'ma', width: 95 },
          { title: 'Đang hưởng', key: 'cu', width: 130, render: (_: unknown, r: DongBang) => la(r) && <span>{pct(r.pctnCu)} <Text type="secondary" style={{ fontSize: 13 }}>từ {formatDate(r.mocCu ?? '')}</Text></span> },
          { title: 'Nâng (mới)', key: 'moi', width: 130, render: (_: unknown, r: DongBang) => la(r) && <span><b>{pct(r.pctnMoi)}</b> <Text type="secondary" style={{ fontSize: 13 }}>từ {formatDate(r.mocMoi ?? '')}</Text></span> },
        ]

  const soCot = 4 + cotRieng.length + (sua ? 1 : 0)
  return (
    <Table<DongBang>
      size="small"
      bordered
      pagination={false}
      dataSource={data}
      rowKey="key"
      scroll={{ x: 1100 }}
      rowClassName={(r) => (r.loaiDong === 'nhom' ? 'tb-nhom' : la(r) && truongMinh && r.donViId === truongMinh ? 'tb-truong-minh' : '')}
      columns={[
        {
          title: 'TT', key: 'stt', width: 50, align: 'center',
          onCell: (r) => (r.loaiDong === 'nhom' ? { colSpan: soCot, style: { textAlign: 'left' } } : {}),
          render: (_, r) => (r.loaiDong === 'nhom' ? <Text strong style={{ color: '#1e3a8a' }}>- {r.ten} - <Text type="secondary" style={{ fontWeight: 400 }}>({r.so} người)</Text></Text> : r.stt),
        },
        {
          title: 'Họ và tên', key: 'ten', width: 190, onCell: (r) => (r.loaiDong === 'nhom' ? { colSpan: 0 } : {}),
          render: (_, r) => la(r) && (
            <span>
              {r.hoTen}
              {!r.daPheDuyet && <Tooltip title={`Phiếu ${r.deXuatMa} đã thẩm định, chờ lãnh đạo phê duyệt`}><ClockCircleOutlined style={{ color: '#d97706', marginInlineStart: 6 }} /></Tooltip>}
            </span>
          ),
        },
        { title: 'Ngày sinh', key: 'ns', width: 100, onCell: (r) => (r.loaiDong === 'nhom' ? { colSpan: 0 } : {}), render: (_, r) => la(r) && formatDate(r.ngaySinh ?? '') },
        ...cotRieng.map((c) => ({ ...c, onCell: (r: DongBang) => (r.loaiDong === 'nhom' ? { colSpan: 0 } : {}) })),
        {
          title: 'Ghi chú', key: 'gc', width: 180, onCell: (r) => (r.loaiDong === 'nhom' ? { colSpan: 0 } : {}),
          render: (_, r) => la(r) && (sua
            ? <Input size="small" value={r.ghiChu} onChange={(e) => onDoi?.(r.key, { ghiChu: e.target.value })} placeholder={tb.loai === 'PCTN_LAN_DAU' ? 'VD Thời gian tập sự 9 tháng' : ''} />
            : <Text style={{ fontSize: 13 }}>{r.ghiChu}</Text>),
        },
        ...(sua ? [{
          title: '', key: 'xoa', width: 44, onCell: (r: DongBang) => (r.loaiDong === 'nhom' ? { colSpan: 0 } : {}),
          render: (_: unknown, r: DongBang) => la(r) && <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onXoa?.(r.key)} />,
        }] : []),
      ]}
      footer={() => <style>{'.tb-nhom > td { background: #eff6ff !important; } .tb-truong-minh > td { background: #fefce8 !important; }'}</style>}
    />
  )
}

// ───────────────────────────── Trường, lãnh đạo: xem thông báo đã ban hành ─────────────────────────────

function XemThongBao() {
  const { currentUser, scopeDonViId } = useAuth()
  const thongBaos = useThongBaoStore((s) => s.thongBaos)
  const donVis = useDanhMucStore((s) => s.donVis)
  const truong = donVis.find((d) => d.id === scopeDonViId)
  const capTruong = (truong?.loai === 'MAM_NON' || truong?.loai === 'TIEU_HOC' || truong?.loai === 'THCS') ? truong.loai as CapHocTB : undefined

  const dsBanHanh = useMemo(
    () => thongBaos
      .filter((t) => t.trangThai === 'DA_BAN_HANH')
      .filter((t) => !scopeDonViId || (capTruong && t.dong.some((d) => d.cap === capTruong)))
      .sort((a, b) => (b.ngayThongBao || b.updatedAt).localeCompare(a.ngayThongBao || a.updatedAt)),
    [thongBaos, scopeDonViId, capTruong],
  )
  const [chon, setChon] = useState<string | undefined>()
  const tb = dsBanHanh.find((t) => t.id === chon) ?? dsBanHanh[0]
  const [daXem, setDaXem] = useState(() => daXemThongBao(currentUser?.id))

  useEffect(() => {
    if (!tb || !currentUser) return
    danhDauDaXem(currentUser.id, tb)
    setDaXem(daXemThongBao(currentUser.id))
  }, [tb?.id, tb?.banHanhLuc])

  if (scopeDonViId && !capTruong) return <Card><Empty description="Đơn vị của tài khoản không phải trường mầm non, tiểu học hoặc THCS" /></Card>

  return (
    <Card>
      <Title level={4} style={{ marginTop: 0 }}>Thông báo kết quả nâng lương, phụ cấp thâm niên</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {capTruong
          ? <>Thông báo của UBND phường, phần <b>{TEN_CAP_TB[capTruong].danhSach.toLowerCase()}</b>. Dòng của {truong?.ten} được tô vàng. Căn cứ thông báo, Hiệu trưởng ban hành quyết định theo thẩm quyền và gửi 01 bản về Phòng VH-XH; dòng ghi "UBND phường ra QĐ" (Hiệu trưởng, Phó hiệu trưởng, giáo viên hạng I) do UBND phường ra quyết định.</>
          : 'Các thông báo đã ban hành của UBND phường.'}
      </Text>
      {!dsBanHanh.length ? (
        <Empty description="Chưa có thông báo nào được ban hành" />
      ) : (
        <Row gutter={16}>
          <Col xs={24} lg={7}>
            {dsBanHanh.map((t) => {
              const moi = !daXem.has(`${t.id}@${t.banHanhLuc}`)
              const soCuaTruong = scopeDonViId ? t.dong.filter((d) => d.donViId === scopeDonViId).length : t.dong.length
              return (
                <Card
                  key={t.id}
                  size="small"
                  hoverable
                  onClick={() => setChon(t.id)}
                  style={{ marginBottom: 8, borderColor: tb?.id === t.id ? '#2563eb' : undefined }}
                >
                  <Space orientation="vertical" size={2} style={{ width: '100%' }}>
                    <Space size={6} wrap>
                      <NotificationOutlined style={{ color: '#2563eb' }} />
                      <Text strong>TB số {t.soThongBao}/TB-UBND</Text>
                      {moi && <Badge status="error" text={<Text type="danger" style={{ fontSize: 13 }}>Mới</Text>} />}
                    </Space>
                    <Text style={{ fontSize: 14 }}>{LOAI_THONG_BAO_KQ[t.loai].tenNgan} - {tenKy(t.ky, t.nam)}</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Ngày {formatDate(t.ngayThongBao)} · {scopeDonViId ? `trường mình ${soCuaTruong} người` : `${t.dong.length} người`}
                    </Text>
                  </Space>
                </Card>
              )
            })}
          </Col>
          <Col xs={24} lg={17}>
            {tb && (
              <>
                <Descriptions size="small" bordered column={{ xs: 1, md: 2 }} style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="Thông báo">Số {tb.soThongBao}/TB-UBND ngày {formatDate(tb.ngayThongBao)}</Descriptions.Item>
                  <Descriptions.Item label="Người ký">TM. UBND - Chủ tịch {tb.nguoiKy}</Descriptions.Item>
                  <Descriptions.Item label="Nội dung" span={2}>{noiDungThongBao(tb).tieuDe}</Descriptions.Item>
                  {capTruong && (
                    <Descriptions.Item label={TEN_CAP_TB[capTruong].danhSach} span={2}>
                      {tb.dong.filter((d) => d.cap === capTruong).length} người, trong đó {truong?.ten}: <b>{tb.dong.filter((d) => d.donViId === scopeDonViId).length}</b> người
                    </Descriptions.Item>
                  )}
                </Descriptions>
                <Space style={{ marginBottom: 12 }} wrap>
                  <Button icon={<DownloadOutlined />} onClick={() => xuatExcelThongBao(tb, capTruong)}>Danh sách (Excel)</Button>
                  <Button icon={<FileWordOutlined />} onClick={() => taiWordThongBao(tb)}>Thông báo (Word)</Button>
                </Space>
                <BangDanhSach tb={tb} chiCap={capTruong} truongMinh={scopeDonViId ?? undefined} />
              </>
            )}
          </Col>
        </Row>
      )}
    </Card>
  )
}
