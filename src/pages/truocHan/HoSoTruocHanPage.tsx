import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert, App, AutoComplete, Button, Card, Col, DatePicker, Empty, Input, InputNumber, Result, Row, Select, Space, Table, Tag, Tooltip, Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ArrowDownOutlined, ArrowLeftOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined, FileExcelOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '@/hooks/useAuth'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { lamMoiNgay } from '@/lib/supabase'
import MinhChungField from '@/components/MinhChungField'
import type { MinhChung } from '@/lib/minhChung'
import type { ChiTietDeXuat, HoSoTruocHan } from '@/types/deXuat'
import type { VienChuc } from '@/types/vienChuc'
import { duocTinhSoLieu } from '@/types/vienChuc'
import { formatDate } from '@/utils/helpers'
import { ghiChuVuotTyLe, xuatExcelDanhSachTruong } from '@/utils/danhSachTruocHan'
import { cotSTT, BANG_CHUAN } from '@/utils/cotBang'
import {
  SO_THANG_TOI_DA, bacKeTiep, danhSachTraLuong, heSoDangHuong, khoangDenHan, kiemTraDong, mocMoiTruocHan, soSuatToiDa, trongDienXet,
} from '@/utils/nangTruocHan'

const { Title, Text } = Typography

const LY_DO = 'Nâng bậc lương trước thời hạn do lập thành tích xuất sắc trong thực hiện nhiệm vụ'

/** Kế toán trường lập hồ sơ nâng bậc lương trước thời hạn của một năm (một hồ sơ / trường / năm) */
export default function HoSoTruocHanPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const { currentUser, scopeDonViId, laQuanTri } = useAuth()
  const { addDeXuat, updateDeXuat, submitDeXuat } = useDeXuatStore.getState()
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const dxSua = useMemo(() => (editId ? deXuats.find((d) => d.id === editId) : undefined), [deXuats, editId])
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const mucs = useDanhMucStore((s) => s.mucNangTruocHans)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)

  const namMacDinh = Number(params.get('nam')) || dayjs().year()
  const [nam, setNam] = useState<number>(dxSua?.namXet ?? namMacDinh)
  const [donViId, setDonViId] = useState<string | undefined>(scopeDonViId ?? dxSua?.donViId ?? undefined)
  const [chiTiet, setChiTiet] = useState<ChiTietDeXuat[]>(dxSua?.chiTiet ?? [])
  const [hoSo, setHoSo] = useState<HoSoTruocHan>(dxSua?.hoSoTruocHan ?? {})
  const [khac, setKhac] = useState<MinhChung[]>(dxSua?.minhChung ?? [])
  const [ghiChu, setGhiChu] = useState(dxSua?.ghiChuDeXuat ?? '')
  const [dangLuu, setDangLuu] = useState(false)

  useEffect(() => {
    if (!dxSua) return
    setNam(dxSua.namXet ?? namMacDinh); setDonViId(dxSua.donViId); setChiTiet(dxSua.chiTiet)
    setHoSo(dxSua.hoSoTruocHan ?? {}); setKhac(dxSua.minhChung ?? []); setGhiChu(dxSua.ghiChuDeXuat ?? '')
  }, [dxSua?.id])

  const nguoiTaiLen = currentUser?.fullName ?? ''
  const duocSua = !editId || (!!dxSua && dxSua.loai === 'NANG_TRUOC_HAN' && (dxSua.trangThai === 'NHAP' || dxSua.trangThai === 'YEU_CAU_BO_SUNG')
    && (!scopeDonViId || dxSua.donViId === scopeDonViId))
  const truongs = useMemo(() => donVis.filter((d) => d.active && d.loai !== 'OTHER'), [donVis])
  const donVi = donVis.find((d) => d.id === donViId)

  const cdTheoId = useMemo(() => new Map(chucDanhs.map((c) => [c.id, c])), [chucDanhs])
  const bangCua = (cdId: string) => bacLuongs.filter((b) => b.chucDanhId === cdId).sort((a, b) => a.bac - b.bac)
  const vcTheoId = useMemo(() => new Map(vienChucs.map((v) => [v.id, v])), [vienChucs])

  // Danh sách trả lương (căn cứ tỷ lệ 10%) và gợi ý người đủ điều kiện
  const dsTraLuong = useMemo(() => (donViId ? danhSachTraLuong(vienChucs, heSoLuongs, donViId) : []), [vienChucs, heSoLuongs, donViId])
  const toiDa = soSuatToiDa(dsTraLuong.length)
  const daChon = new Set(chiTiet.map((c) => c.vienChucId))
  const goiY = useMemo(() => dsTraLuong
    .map((vc) => ({ vc, hs: heSoDangHuong(vc, heSoLuongs) }))
    .filter(({ vc, hs }) => hs && !daChon.has(vc.id) && trongDienXet(hs.ngayNangLuongTiepTheo, nam) && bacKeTiep(bangCua(hs.chucDanhId), hs.bac))
    .sort((a, b) => (a.hs!.ngayNangLuongTiepTheo ?? '').localeCompare(b.hs!.ngayNangLuongTiepTheo ?? '')),
  [dsTraLuong, heSoLuongs, nam, chiTiet, bacLuongs])

  const them = (vc: VienChuc) => {
    if (daChon.has(vc.id)) { message.warning('Người này đã có trong hồ sơ'); return }
    const hs = heSoDangHuong(vc, heSoLuongs)
    if (!hs) { message.warning(`${vc.ho} ${vc.ten} chưa có bậc, hệ số lương - khai trong hồ sơ trước`); return }
    const ke = bacKeTiep(bangCua(hs.chucDanhId), hs.bac)
    if (!ke) { message.warning(`${vc.ho} ${vc.ten} đã ở bậc cuối - không nâng bậc trước thời hạn`); return }
    setChiTiet((ds) => [...ds, {
      vienChucId: vc.id, chucDanhCuId: hs.chucDanhId, bacCu: hs.bac, heSoCu: hs.heSo,
      chucDanhMoiId: hs.chucDanhId, bacMoi: ke.bac, heSoMoi: ke.heSo,
      ngayHieuLucCu: hs.ngayHieuLuc, ngayDenHanCu: hs.ngayNangLuongTiepTheo,
      ngayHieuLuc: '', lyDo: LY_DO, thanhTich: { hinhThuc: '' },
    }])
  }
  const sua = (vcId: string, patch: Partial<ChiTietDeXuat>) => setChiTiet((ds) => ds.map((c) => {
    if (c.vienChucId !== vcId) return c
    const moi = { ...c, ...patch }
    // Số tháng đổi → tính lại mốc hưởng mới từ ngày đến hạn
    if (moi.ngayDenHanCu && moi.soThangTruocHan) moi.ngayHieuLuc = mocMoiTruocHan(moi.ngayDenHanCu, moi.soThangTruocHan)
    return moi
  }))
  const suaThanhTich = (vcId: string, patch: Partial<NonNullable<ChiTietDeXuat['thanhTich']>>) => {
    const c = chiTiet.find((x) => x.vienChucId === vcId)
    sua(vcId, { thanhTich: { hinhThuc: '', ...c?.thanhTich, ...patch } })
  }
  const chonMuc = (vcId: string, ten: string) => {
    const m = mucs.find((x) => x.ten === ten)
    const c = chiTiet.find((x) => x.vienChucId === vcId)
    sua(vcId, { thanhTich: { hinhThuc: ten, ...c?.thanhTich, mucId: m?.id, ...(m ? { hinhThuc: m.ten } : {}) }, ...(m ? { soThangTruocHan: m.soThang } : {}) })
  }

  const kiemTra = (c: ChiTietDeXuat) => {
    const vc = vcTheoId.get(c.vienChucId)
    const hs = vc ? heSoDangHuong(vc, heSoLuongs) : undefined
    const bang = bangCua(c.chucDanhCuId)
    return kiemTraDong(c, nam, {
      cd: cdTheoId.get(c.chucDanhCuId), hs, bacCuoi: bang.length ? bang[bang.length - 1].bac : undefined,
      tenNguoi: vc ? `${vc.ho} ${vc.ten}` : c.vienChucId,
    })
  }

  const doiCho = (i: number, huong: -1 | 1) => setChiTiet((ds) => {
    const j = i + huong
    if (j < 0 || j >= ds.length) return ds
    const moi = [...ds]; [moi[i], moi[j]] = [moi[j], moi[i]]
    return moi
  })
  const hieuTruong = useMemo(() => {
    const v = vienChucs.find((x) => x.donViId === donViId && x.chucVu === 'HT' && duocTinhSoLieu(x))
    return v ? `${v.ho} ${v.ten}` : undefined
  }, [vienChucs, donViId])
  const inDanhSach = () => {
    if (!chiTiet.length) { message.warning('Chưa có người trong danh sách'); return }
    const thieu = chiTiet.filter((c) => !c.thanhTich?.hinhThuc?.trim() || !c.soThangTruocHan)
    if (thieu.length) message.warning(`${thieu.length} người chưa ghi thành tích / số tháng - cột tương ứng trên bản in sẽ để trống`)
    xuatExcelDanhSachTruong({ tenTruong: donVi?.ten ?? '', nam, chiTiet, toiDa, soNguoiTraLuong: dsTraLuong.length, vienChucs: vcTheoId, chucDanhs: cdTheoId, hieuTruong })
  }
  const tenNguoi = (c: ChiTietDeXuat) => { const vc = vcTheoId.get(c.vienChucId); return vc ? `${vc.ho} ${vc.ten}` : c.vienChucId }
  const columns: ColumnsType<ChiTietDeXuat> = [
    cotSTT<ChiTietDeXuat>(),
    {
      title: <Tooltip title="Thứ tự ưu tiên: các dòng đầu trong số suất được duyệt, dòng sau số suất là vượt tỷ lệ (dự phòng)">Thứ tự</Tooltip>, key: 'tt0', width: 92, fixed: 'left', align: 'center',
      render: (_, c, i) => (
        <Space size={2}>
          <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => doiCho(i, -1)} />
          <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === chiTiet.length - 1} onClick={() => doiCho(i, 1)} />
        </Space>
      ),
    },
    {
      title: 'Họ và tên', key: 'ten', width: 190, fixed: 'left',
      render: (_, c, i) => (
        <div>
          <b>{tenNguoi(c)}</b>
          {i >= toiDa && <div><Tooltip title={ghiChuVuotTyLe(i + 1, toiDa)}><Tag color="orange" style={{ marginInlineEnd: 0 }}>Vượt tỷ lệ - dự phòng {i + 1 - toiDa}</Tag></Tooltip></div>}
        </div>
      ),
    },
    {
      title: 'Hiện tại', key: 'cu', width: 170,
      render: (_, c) => {
        const cd = cdTheoId.get(c.chucDanhCuId)
        return <div style={{ lineHeight: 1.45 }}><Text strong>{cd?.ma}</Text> <Text type="secondary">({cd?.bangLuong})</Text><br />Bậc {c.bacCu} - {Number(c.heSoCu).toFixed(2)}<br /><Text type="secondary" style={{ fontSize: 13 }}>từ {formatDate(c.ngayHieuLucCu ?? '')}</Text></div>
      },
    },
    { title: 'Đến hạn nâng bậc', key: 'dh', width: 110, align: 'center', render: (_, c) => formatDate(c.ngayDenHanCu ?? '') || <Text type="warning">Chưa có</Text> },
    {
      title: 'Thành tích (hình thức khen, danh hiệu)', key: 'tt', width: 280,
      render: (_, c) => (
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          <AutoComplete
            style={{ width: '100%' }}
            value={c.thanhTich?.hinhThuc}
            options={mucs.filter((m) => m.active).sort((a, b) => a.thuTu - b.thuTu).map((m) => ({ value: m.ten, label: <span>{m.ten} <Text type="secondary">({m.soThang} tháng)</Text></span> }))}
            onSelect={(v: string) => chonMuc(c.vienChucId, v)}
            onChange={(v: string) => suaThanhTich(c.vienChucId, { hinhThuc: v, mucId: undefined })}
            placeholder="Chọn từ bảng hoặc ghi theo quyết định"
          />
          <Input size="small" value={c.thanhTich?.noiDung} onChange={(e) => suaThanhTich(c.vienChucId, { noiDung: e.target.value })} placeholder="Nội dung (VD năm học 2025-2026, cơ quan khen)" />
        </Space>
      ),
    },
    {
      title: 'Quyết định công nhận', key: 'qd', width: 170,
      render: (_, c) => (
        <Space orientation="vertical" size={4}>
          <Input size="small" value={c.thanhTich?.soQd} onChange={(e) => suaThanhTich(c.vienChucId, { soQd: e.target.value })} placeholder="Số QĐ" />
          <DatePicker size="small" format="DD/MM/YYYY" value={c.thanhTich?.ngayQd ? dayjs(c.thanhTich.ngayQd) : null} onChange={(d) => suaThanhTich(c.vienChucId, { ngayQd: d ? d.format('YYYY-MM-DD') : undefined })} placeholder="Ngày QĐ" style={{ width: '100%' }} />
        </Space>
      ),
    },
    {
      title: <Tooltip title={`Theo Quy chế của trường, tối đa ${SO_THANG_TOI_DA} tháng`}>Nâng trước (tháng)</Tooltip>, key: 'st', width: 95, align: 'center',
      render: (_, c) => <InputNumber size="small" min={1} max={SO_THANG_TOI_DA} precision={0} value={c.soThangTruocHan} onChange={(v) => sua(c.vienChucId, { soThangTruocHan: v ?? undefined })} style={{ width: 70 }} />,
    },
    {
      title: 'Đề nghị', key: 'moi', width: 140,
      render: (_, c) => <div style={{ lineHeight: 1.45 }}><b>Bậc {c.bacMoi} - {Number(c.heSoMoi).toFixed(2)}</b><br /><Text type="secondary" style={{ fontSize: 13 }}>hưởng từ</Text> <b>{c.ngayHieuLuc ? formatDate(c.ngayHieuLuc) : '-'}</b></div>,
    },
    { title: 'Minh chứng thành tích', key: 'mc', width: 190, render: (_, c) => <MinhChungField compact taiLenBoi={nguoiTaiLen} value={c.minhChung} onChange={(v) => sua(c.vienChucId, { minhChung: v })} /> },
    {
      title: 'Kiểm tra', key: 'kt', width: 230,
      render: (_, c) => {
        const k = kiemTra(c)
        if (!k.loi.length && !k.canhBao.length) return <Tag color="success" style={{ marginInlineEnd: 0 }}>Đủ điều kiện trình</Tag>
        return (
          <Space orientation="vertical" size={2}>
            {k.loi.map((l) => <Text key={l} type="danger" style={{ fontSize: 12.5 }}>• {l}</Text>)}
            {k.canhBao.map((l) => <Text key={l} type="warning" style={{ fontSize: 12.5 }}>• {l}</Text>)}
          </Space>
        )
      },
    },
    { title: 'Ghi chú (in trong danh sách)', key: 'gc', width: 180, render: (_, c) => <Input.TextArea size="small" autoSize={{ minRows: 1, maxRows: 3 }} value={c.ghiChu} onChange={(e) => sua(c.vienChucId, { ghiChu: e.target.value || undefined })} placeholder="VD: GV giỏi cấp trường 2 năm" /> },
    { title: '', key: 'xoa', width: 50, align: 'center', render: (_, c) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setChiTiet((ds) => ds.filter((x) => x.vienChucId !== c.vienChucId))} /> },
  ]

  const trungHoSo = useMemo(() => deXuats.find((d) => d.loai === 'NANG_TRUOC_HAN' && d.id !== editId && d.donViId === donViId && d.namXet === nam && d.trangThai !== 'TU_CHOI'), [deXuats, editId, donViId, nam])

  const luu = async (trinh: boolean) => {
    if (!currentUser || !donViId) { message.error('Chọn trường'); return }
    await lamMoiNgay()
    const loi: string[] = []
    if (trungHoSo) loi.push(`Trường đã có hồ sơ nâng lương trước thời hạn năm ${nam} (${trungHoSo.ma}) - mỗi trường một hồ sơ mỗi năm`)
    if (!chiTiet.length) loi.push('Chưa có người đề nghị')
    if (trinh) {
      if (!hoSo.toTrinh?.length) loi.push('Chưa đính kèm Tờ trình của trường')
      if (!hoSo.bienBan?.length) loi.push('Chưa đính kèm Biên bản họp Hội đồng xét nâng lương trước thời hạn')
      for (const c of chiTiet) for (const l of kiemTra(c).loi) loi.push(`${tenNguoi(c)}: ${l}`)
    }
    if (loi.length) {
      modal.warning({ title: trinh ? 'Chưa trình được hồ sơ' : 'Chưa lưu được hồ sơ', content: <ul style={{ paddingLeft: 18, margin: 0 }}>{loi.slice(0, 12).map((l) => <li key={l}>{l}</li>)}{loi.length > 12 && <li>và {loi.length - 12} lỗi khác</li>}</ul> })
      return
    }
    const thucHien = () => {
      setDangLuu(true)
      try {
        const noiDung = {
          tieuDe: `Nâng bậc lương trước thời hạn năm ${nam} - ${donVi?.ten ?? ''}`,
          donViId, loai: 'NANG_TRUOC_HAN' as const, chiTiet, minhChung: khac, namXet: nam,
          hoSoTruocHan: { ...hoSo, soNguoiTraLuong: dsTraLuong.length }, ghiChuDeXuat: ghiChu || undefined,
        }
        let id = editId
        if (editId && dxSua) updateDeXuat(editId, noiDung)
        else id = addDeXuat({ ...noiDung, trangThai: 'NHAP', buocHienTai: 1, nguoiDeXuatId: currentUser.id, ngayDeXuat: dayjs().format('YYYY-MM-DD') }).id
        if (trinh) {
          submitDeXuat(id!, currentUser.id, currentUser.fullName)
          message.success('Đã trình hồ sơ lên Hiệu trưởng')
        } else message.success('Đã lưu bản nháp')
        navigate(`/nang-truoc-han/${id}`)
      } finally { setDangLuu(false) }
    }
    // Vượt tỷ lệ: chỉ cảnh báo, vẫn cho trình (Phòng VHXH xem xét)
    if (trinh && chiTiet.length > toiDa) {
      modal.confirm({
        title: `Số người đề nghị (${chiTiet.length}) vượt tỷ lệ tối đa ${toiDa} suất`,
        content: `Danh sách trả lương ${dsTraLuong.length} người - cứ 10 người 1 suất (TT 08/2013). Vẫn trình để Phòng VHXH xem xét?`,
        okText: 'Vẫn trình', cancelText: 'Xem lại', onOk: thucHien,
      })
    } else thucHien()
  }

  if (editId && !dxSua) return <Result status="404" title="Không tìm thấy hồ sơ" extra={<Button onClick={() => navigate('/ho-so-nang-luong?loai=NANG_TRUOC_HAN')}>Quay lại</Button>} />
  if (!duocSua) return <Result status="warning" title="Hồ sơ này không sửa được" subTitle="Chỉ sửa được hồ sơ Bản nháp hoặc bị Yêu cầu bổ sung của trường mình." extra={<Button onClick={() => navigate(`/nang-truoc-han/${editId}`)}>Xem hồ sơ</Button>} />

  const { tu, den } = khoangDenHan(nam)
  return (
    <Card>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(editId ? `/nang-truoc-han/${editId}` : '/ho-so-nang-luong?loai=NANG_TRUOC_HAN')}>Quay lại</Button>
      </Space>
      <Title level={4} style={{ marginBottom: 0 }}>{editId ? 'Sửa hồ sơ' : 'Lập hồ sơ'} nâng bậc lương trước thời hạn</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Do lập thành tích xuất sắc trong thực hiện nhiệm vụ - khoản 1 Điều 3 Thông tư 08/2013/TT-BNV (sửa đổi bởi Thông tư 03/2021/TT-BNV).
      </Text>

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <Card size="small" title="Thông tin hồ sơ" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Space wrap>
                <Text>Năm xét:</Text>
                <Select value={nam} onChange={setNam} style={{ width: 110 }} options={[-1, 0, 1].map((x) => dayjs().year() + x).map((n) => ({ value: n, label: n }))} />
                {!scopeDonViId && (
                  <Select placeholder="Chọn trường" value={donViId} onChange={(v) => { setDonViId(v); setChiTiet([]) }} style={{ width: 240 }} showSearch optionFilterProp="label" options={truongs.map((d) => ({ value: d.id, label: d.ten }))} />
                )}
                {scopeDonViId && <Text strong>{donVi?.ten}</Text>}
              </Space>
              {trungHoSo && <Alert type="error" showIcon title={`Trường đã có hồ sơ năm ${nam}: ${trungHoSo.ma}`} />}
              <Alert
                type={chiTiet.length > toiDa ? 'warning' : 'info'}
                showIcon
                title={`Danh sách trả lương: ${dsTraLuong.length} người → tối đa ${toiDa} suất; đang đề nghị ${chiTiet.length} người`}
                description="Tỷ lệ không quá 10% số người trong danh sách trả lương (người xếp lương theo hệ số); cứ 10 người 1 suất, phần dư dưới 10 người không tính."
              />
              <Input.TextArea rows={2} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Ghi chú hồ sơ (nếu có)" />
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card size="small" title="Hồ sơ chung" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 12]}>
              <Col xs={24} md={12}><Text strong>Tờ trình của trường <Text type="danger">*</Text></Text><MinhChungField taiLenBoi={nguoiTaiLen} value={hoSo.toTrinh} onChange={(v) => setHoSo({ ...hoSo, toTrinh: v })} /></Col>
              <Col xs={24} md={12}><Text strong>Biên bản họp Hội đồng trường <Text type="danger">*</Text></Text><MinhChungField taiLenBoi={nguoiTaiLen} value={hoSo.bienBan} onChange={(v) => setHoSo({ ...hoSo, bienBan: v })} /></Col>
              <Col xs={24} md={12}><Text strong>Quy chế nâng lương trước thời hạn của trường</Text><MinhChungField taiLenBoi={nguoiTaiLen} value={hoSo.quyChe} onChange={(v) => setHoSo({ ...hoSo, quyChe: v })} /></Col>
              <Col xs={24} md={12}><Text strong>Tài liệu khác</Text><MinhChungField taiLenBoi={nguoiTaiLen} value={khac} onChange={setKhac} /></Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {donViId && (
        <Card size="small" title={`Gợi ý người đủ điều kiện (${goiY.length})`} style={{ marginBottom: 16 }}
          extra={(
            <Select
              showSearch optionFilterProp="label" placeholder="Thêm người khác trong danh sách trả lương" style={{ width: 300 }} value={null}
              onChange={(id: string) => { const vc = vcTheoId.get(id); if (vc) them(vc) }}
              options={dsTraLuong.filter((v) => !daChon.has(v.id)).map((v) => ({ value: v.id, label: `${v.ho} ${v.ten}` }))}
            />
          )}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
            Chưa ở bậc cuối, đến hạn nâng bậc thường xuyên sau {formatDate(tu)} đến hết {formatDate(den)} (tính đến 31/12/{nam} còn thiếu từ 12 tháng trở xuống).
          </Text>
          {goiY.length ? (
            <Space wrap>
              {goiY.map(({ vc, hs }) => (
                <Button key={vc.id} size="small" icon={<PlusOutlined />} onClick={() => them(vc)}>
                  {vc.ho} {vc.ten} <Text type="secondary" style={{ fontSize: 12 }}>· đến hạn {formatDate(hs!.ngayNangLuongTiepTheo)}</Text>
                </Button>
              ))}
            </Space>
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có người trong diện xét" />}
        </Card>
      )}

      <Table<ChiTietDeXuat>
        {...BANG_CHUAN}
        rowKey="vienChucId"
        dataSource={chiTiet}
        columns={columns}
        pagination={false}
        locale={{ emptyText: 'Chọn người từ danh sách gợi ý phía trên' }}
      />

      {chiTiet.length > toiDa && (
        <Alert style={{ marginTop: 12 }} type="warning" showIcon
          title={`${chiTiet.length - toiDa} người vượt tỷ lệ (tối đa ${toiDa} suất)`}
          description={<>Dùng nút mũi tên cột <b>Thứ tự</b> xếp người ưu tiên lên trước: <b>{toiDa}</b> người đầu nằm trong tỷ lệ, những người sau được ghi "Vượt tỷ lệ - dự phòng 1, 2…" trên danh sách xuất Excel (dự phòng khi có người rút hoặc Phòng VHXH không đồng ý).</>} />
      )}

      <Space style={{ marginTop: 16 }} wrap>
        <Button icon={<FileExcelOutlined />} onClick={inDanhSach}>Xuất danh sách duyệt tại trường (Excel)</Button>
        <Button icon={<SaveOutlined />} loading={dangLuu} onClick={() => luu(false)}>Lưu bản nháp</Button>
        <Button type="primary" icon={<SendOutlined />} loading={dangLuu} onClick={() => luu(true)}>
          {dxSua?.trangThai === 'YEU_CAU_BO_SUNG' ? 'Lưu và trình lại' : 'Lưu và trình Hiệu trưởng'}
        </Button>
      </Space>
    </Card>
  )
}
