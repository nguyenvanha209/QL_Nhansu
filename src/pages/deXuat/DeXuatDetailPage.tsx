import { useParams, useNavigate } from 'react-router-dom'
import { Card, Steps, Button, Table, Tag, Descriptions, Modal, Input, Select, Space, Typography, Result, Divider, App } from 'antd'
import dayjs from 'dayjs'
import { useLuongStore } from '@/store/luongStore'
import { heSoDangHuong, kiemTraDong, soSuatToiDa } from '@/utils/nangTruocHan'
import type { ChiTietDeXuat } from '@/types/deXuat'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, SyncOutlined, EditOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useAuth } from '@/hooks/useAuth'
import { ngayDu5Nam } from '@/utils/pctnLanDau'
import { formatDate, vietHoaDauTu } from '@/utils/helpers'
import { TRANG_THAI_LABELS, TRANG_THAI_COLORS, LOAI_DE_XUAT_LABELS, LOAI_CAN_MINH_CHUNG, trangDanhSachCuaLoai, laHoSoNangLuong, coDoiLuong } from '@/types/deXuat'
import { CHUC_VU_LABELS } from '@/types/vienChuc'
import NoiDungDieuChinh from '@/components/NoiDungDieuChinh'
import NutXoaPhieuNhap from '@/components/NutXoaPhieuNhap'
import { lamMoiNgay } from '@/lib/supabase'
import { DanhSachMinhChung } from '@/components/MinhChungField'

const { Title, Text } = Typography
const { TextArea } = Input

export default function DeXuatDetailPage() {
  const { message } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser, isVHXH, isLanhDao, laQuanTri, isHieuTruong, scopeDonViId, hasPermission } = useAuth()
  const getById = useDeXuatStore((s) => s.getById)
  useDeXuatStore((s) => s.deXuats) // vẽ lại khi phiếu đổi (VD thẩm định từng người)
  const { submitDeXuat, duyetHieuTruong, xetDuyetDeXuat, pheDuyetDeXuat, thamDinhNguoi } = useDeXuatStore.getState()
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const donVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const vienChucs = useVienChucStore((s) => s.vienChucs)

  const dx = getById(id!)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalAction, setModalAction] = useState<string>('')
  const [ghiChu, setGhiChu] = useState('')
  const [loading, setLoading] = useState(false)

  if (!dx) return <Result status="404" title="Không tìm thấy đề xuất" extra={<Button onClick={() => navigate(-1)}>Quay lại</Button>} />
  // Hồ sơ nâng lương trước thời hạn có mục riêng
  const laTruocHan = dx.loai === 'NANG_TRUOC_HAN'
  const goc = laTruocHan ? '/nang-truoc-han' : '/de-xuat'
  const veDanhSach = trangDanhSachCuaLoai(dx.loai)

  // Tài khoản trường chỉ xem phiếu của trường mình (trước đây mở được phiếu trường khác bằng đường dẫn)
  if (scopeDonViId && dx.donViId !== scopeDonViId) {
    return <Result status="403" title="Không có quyền xem phiếu này" subTitle="Phiếu thuộc đơn vị khác." extra={<Button onClick={() => navigate(veDanhSach)}>Quay lại</Button>} />
  }

  const donVi = donVis.find((d) => d.id === dx.donViId)

  const laPctn = dx.loai === 'PHU_CAP_THAM_NIEN'
  // Loại theo niên hạn không dùng minh chứng; phiếu cũ đã lỡ đính kèm thì vẫn hiện
  const coMinhChung = LOAI_CAN_MINH_CHUNG.includes(dx.loai) || !!dx.minhChung?.length || dx.chiTiet.some((c) => c.minhChung?.length)

  const ketQuaLabel = (kq?: string) => kq === 'DONG_Y' ? 'Đồng ý' : kq === 'PHE_DUYET' ? 'Phê duyệt' : kq === 'TU_CHOI' ? 'Từ chối' : kq === 'YEU_CAU_BO_SUNG' ? 'Yêu cầu bổ sung' : ''

  const stepItems = [
    { title: 'Đơn vị lập', content: dx.ngayDeXuat ? formatDate(dx.ngayDeXuat) : 'Chờ nộp' },
    { title: 'Thủ trưởng đơn vị duyệt', content: dx.ngayDuyetHT ? `${formatDate(dx.ngayDuyetHT)} - ${ketQuaLabel(dx.ketQuaDuyetHT)}` : 'Chờ duyệt' },
    { title: 'Phòng VHXH thẩm định', content: dx.ngayXetDuyet ? `${formatDate(dx.ngayXetDuyet)} - ${ketQuaLabel(dx.ketQuaXetDuyet)}` : 'Chờ xử lý' },
    { title: 'Lãnh đạo Phòng phê duyệt', content: dx.ngayPheDuyet ? `${formatDate(dx.ngayPheDuyet)} - ${ketQuaLabel(dx.ketQuaPheDuyet)}` : 'Chờ duyệt' },
  ]

  const currentStep = dx.trangThai === 'NHAP' ? 0
    : dx.trangThai === 'CHO_HIEU_TRUONG_DUYET' ? 1
    : dx.trangThai === 'CHO_XET_DUYET' ? 2
    : dx.trangThai === 'CHO_PHE_DUYET' ? 3
    : 4

  const colVienChuc = { title: 'Viên chức', key: 'vc', render: (_: any, r: any) => { const vc = vienChucs.find((v) => v.id === r.vienChucId); return vc ? `${vc.ho} ${vc.ten}` : r.vienChucId } }
  const colLyDo = { title: 'Lý do', dataIndex: 'lyDo', key: 'ld', width: 200 }
  const colMinhChung = { title: 'Minh chứng riêng', key: 'mc', width: 180, render: (_: any, r: any) => <DanhSachMinhChung compact value={r.minhChung} /> }

  const thangVN = (ym?: string) => (ym ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : '-')
  const colsLanDau = [
    colVienChuc,
    {
      title: 'Khai báo', key: 'khai', width: 260,
      render: (_: any, r: any) => {
        const k = r.lanDau
        if (!k) return null
        return (
          <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
            <div>Tuyển dụng: <b>{k.ngayTuyenDung ? formatDate(k.ngayTuyenDung) : '-'}</b> · {k.trinhDo || 'chưa ghi trình độ'}{k.ngayTotNghiep ? ` (TN ${formatDate(k.ngayTotNghiep)})` : ''}</div>
            <div>Đóng BHXH giảng dạy từ: <b>{thangVN(k.batDauBhxh)}</b></div>
            <div>Không tính: tập sự {k.thangTapSu} tháng{k.thangKhongTinhKhac ? `, ${k.lyDoKhongTinh || 'khác'} ${k.thangKhongTinhKhac} tháng` : ''}</div>
            <div>Đủ 5 năm: <b>{ngayDu5Nam(k) ? formatDate(ngayDu5Nam(k)!) : '-'}</b></div>
          </div>
        )
      },
    },
    {
      title: 'Quá trình hưởng', key: 'qt', width: 270,
      render: (_: any, r: any) => (r.lanDau?.quaTrinh ?? []).map((q: any) => (
        <div key={q.mocXet} style={{ fontSize: 13.5 }}><b>{q.tyLe}%</b> · mốc xét {formatDate(q.mocXet)} · hưởng từ {formatDate(q.thoiGianHuong)}</div>
      )),
    },
    { title: 'Ghi chú', dataIndex: 'ghiChu', key: 'gc', width: 170 },
    colMinhChung,
  ]

  // Phòng VHXH thẩm định từng người - dùng chung 4 loại hồ sơ nâng lương - PCTN. Nâng trước thời hạn phải chọn cho
  // từng người; ba loại theo niên hạn chưa chọn coi như Đồng ý, chỉ cần đánh dấu người Không đồng ý.
  const batBuocThamDinh = laTruocHan
  const colThamDinh = {
    title: 'Phòng VHXH thẩm định', key: 'td', width: 230,
    render: (_: any, r: ChiTietDeXuat) => (canXetDuyet
      ? (
        <Space orientation="vertical" size={4} style={{ width: '100%' }}>
          <Select
            size="small" style={{ width: '100%' }} placeholder={batBuocThamDinh ? 'Chọn kết quả' : 'Đồng ý (mặc định)'} value={r.thamDinh} allowClear={!batBuocThamDinh}
            onChange={(v) => thamDinhNguoi(dx.id, r.vienChucId, v, r.yKienThamDinh)}
            options={[{ value: 'DONG_Y', label: 'Đồng ý' }, { value: 'KHONG_DONG_Y', label: 'Không đồng ý' }]}
          />
          <Input size="small" placeholder="Ý kiến (nếu có)" defaultValue={r.yKienThamDinh} onBlur={(e) => thamDinhNguoi(dx.id, r.vienChucId, r.thamDinh, e.target.value || undefined)} />
        </Space>
      )
      : r.thamDinh
        ? <div><Tag color={r.thamDinh === 'DONG_Y' ? 'success' : 'error'} style={{ marginInlineEnd: 0 }}>{r.thamDinh === 'DONG_Y' ? 'Đồng ý' : 'Không đồng ý'}</Tag>{r.yKienThamDinh && <div style={{ fontSize: 13, marginTop: 2 }}>{r.yKienThamDinh}</div>}</div>
        : <Text type="secondary">{batBuocThamDinh || dx.trangThai === 'NHAP' || dx.trangThai === 'CHO_HIEU_TRUONG_DUYET' || dx.trangThai === 'CHO_XET_DUYET' ? 'Chưa thẩm định' : 'Đồng ý'}</Text>),
  }

  // Nâng lương trước thời hạn: thành tích, số tháng, kiểm tra điều kiện, thẩm định từng người của Phòng VHXH
  const ctxKiemTra = (r: ChiTietDeXuat) => {
    const vc = vienChucs.find((v) => v.id === r.vienChucId)
    const bang = bacLuongs.filter((b) => b.chucDanhId === r.chucDanhCuId).sort((a, b) => a.bac - b.bac)
    return { cd: chucDanhs.find((c) => c.id === r.chucDanhCuId), hs: vc ? heSoDangHuong(vc, heSoLuongs) : undefined, bacCuoi: bang.length ? bang[bang.length - 1].bac : undefined, tenNguoi: vc ? `${vc.ho} ${vc.ten}` : r.vienChucId }
  }
  const colsTruocHan = [
    {
      ...colVienChuc, width: 190,
      render: (_: any, r: ChiTietDeXuat, i: number) => {
        const toiDa = soSuatToiDa(dx.hoSoTruocHan?.soNguoiTraLuong ?? 0)
        return (
          <div>
            {colVienChuc.render(_, r)}
            {i >= toiDa && <div><Tag color="orange" style={{ marginInlineEnd: 0 }}>Vượt tỷ lệ - dự phòng {i + 1 - toiDa}</Tag></div>}
            {r.ghiChu && <div><Text type="secondary" style={{ fontSize: 13 }}>{r.ghiChu}</Text></div>}
          </div>
        )
      },
    },
    {
      title: 'Hiện tại', key: 'cu', width: 160,
      render: (_: any, r: ChiTietDeXuat) => {
        const cd = chucDanhs.find((c) => c.id === r.chucDanhCuId)
        return <div style={{ lineHeight: 1.45 }}><Text strong>{cd?.ma}</Text> <Text type="secondary">({cd?.bangLuong})</Text><br />Bậc {r.bacCu} - {Number(r.heSoCu).toFixed(2)}<br /><Text type="secondary" style={{ fontSize: 13 }}>từ {formatDate(r.ngayHieuLucCu ?? '')} · đến hạn {formatDate(r.ngayDenHanCu ?? '')}</Text></div>
      },
    },
    {
      title: 'Thành tích', key: 'tt', width: 260,
      render: (_: any, r: ChiTietDeXuat) => (
        <div style={{ lineHeight: 1.45 }}>
          <b>{r.thanhTich?.hinhThuc}</b>
          <br /><Text type="secondary" style={{ fontSize: 13 }}>QĐ {r.thanhTich?.soQd || '-'} ngày {formatDate(r.thanhTich?.ngayQd ?? '') || '-'}</Text>
          {r.thanhTich?.noiDung && <><br /><Text type="secondary" style={{ fontSize: 13 }}>{r.thanhTich.noiDung}</Text></>}
        </div>
      ),
    },
    { title: 'Nâng trước', key: 'st', width: 80, align: 'center' as const, render: (_: any, r: ChiTietDeXuat) => <b>{r.soThangTruocHan ?? '-'} tháng</b> },
    { title: 'Đề nghị', key: 'moi', width: 140, render: (_: any, r: ChiTietDeXuat) => <div style={{ lineHeight: 1.45 }}><b>Bậc {r.bacMoi} - {Number(r.heSoMoi).toFixed(2)}</b><br /><Text type="secondary" style={{ fontSize: 13 }}>hưởng từ</Text> <b>{formatDate(r.ngayHieuLuc)}</b></div> },
    colMinhChung,
    {
      title: 'Kiểm tra', key: 'kt', width: 220,
      render: (_: any, r: ChiTietDeXuat) => {
        const k = kiemTraDong(r, dx.namXet ?? dayjs(dx.ngayDeXuat).year(), ctxKiemTra(r))
        if (!k.loi.length && !k.canhBao.length) return <Tag color="success" style={{ marginInlineEnd: 0 }}>Đủ điều kiện</Tag>
        return <Space orientation="vertical" size={2}>{[...k.loi.map((l) => <Text key={l} type="danger" style={{ fontSize: 12.5 }}>• {l}</Text>), ...k.canhBao.map((l) => <Text key={l} type="warning" style={{ fontSize: 12.5 }}>• {l}</Text>)]}</Space>
      },
    },
    colThamDinh,
  ]

  const colTT = { title: 'TT', key: 'tt', width: 46, align: 'center' as const, render: (_: unknown, __: unknown, i: number) => i + 1 }
  const colHoTen = {
    title: 'Họ và tên', key: 'vc', width: 200,
    render: (_: unknown, r: ChiTietDeXuat) => {
      const vc = vienChucs.find((v) => v.id === r.vienChucId)
      if (!vc) return r.vienChucId
      const phu = [vc.ngaySinh ? `Sinh ${formatDate(vc.ngaySinh)}` : '', vc.chucVu ? CHUC_VU_LABELS[vc.chucVu] ?? '' : ''].filter(Boolean).join(' · ')
      return (
        <div style={{ lineHeight: 1.45 }}>
          <div style={{ fontWeight: 600 }}>{vietHoaDauTu(`${vc.ho} ${vc.ten}`)}</div>
          {phu && <Text type="secondary" style={{ fontSize: 12.5 }}>{phu}</Text>}
        </div>
      )
    },
  }
  const hs3 = (n: number) => Number(n).toFixed(3).replace('.', ',')
  const coPhuCap = dx.chiTiet.some((c) => c.phuCaps?.length)
  // Cùng một lý do cho cả phiếu (VD nâng lương thường xuyên) thì ghi một lần trên bảng, không lặp từng dòng
  const cacLyDo = [...new Set(dx.chiTiet.map((c) => (c.lyDo ?? '').trim()))]
  const lyDoChung = !laTruocHan && cacLyDo.length === 1 ? cacLyDo[0] : undefined

  const coCotThamDinh = laHoSoNangLuong(dx.loai) && !laTruocHan && (dx.trangThai === 'CHO_XET_DUYET' || dx.chiTiet.some((c) => c.thamDinh))
  const detailColsGoc = laTruocHan ? colsTruocHan : dx.loai === 'PCTN_LAN_DAU' ? colsLanDau : laPctn
    ? [
        colVienChuc,
        { title: 'PCTN cũ', key: 'pctnc', width: 90, render: (_: any, r: any) => `${r.pctnCu ?? 0}%` },
        { title: 'PCTN mới', key: 'pctnm', width: 100, render: (_: any, r: any) => <b>{r.pctnMoi ?? 0}%</b> },
        { title: 'Mốc hưởng PCTN', dataIndex: 'ngayHieuLuc', key: 'nhl', width: 140, render: (v: string) => formatDate(v) },
        colLyDo,
      ]
    : [
        colTT,
        colHoTen,
        {
          title: 'Ngạch (mã CDNN)', key: 'ngach', width: 150,
          render: (_: any, r: ChiTietDeXuat) => {
            const cu = chucDanhs.find((c) => c.id === r.chucDanhCuId)
            const moi = chucDanhs.find((c) => c.id === r.chucDanhMoiId)
            const ten = (c?: typeof cu, id?: string) => <><Text strong title={c?.ten}>{c?.ma ?? id}</Text> <Text type="secondary">({c?.bangLuong})</Text></>
            return r.chucDanhMoiId !== r.chucDanhCuId
              ? <div style={{ lineHeight: 1.5 }}>{ten(cu, r.chucDanhCuId)}<div><Text type="secondary">→</Text> {ten(moi, r.chucDanhMoiId)}</div><Tag color="orange" style={{ marginInlineEnd: 0 }}>Chuyển ngạch</Tag></div>
              : ten(cu, r.chucDanhCuId)
          },
        },
        {
          title: 'Đang hưởng', key: 'cu', width: 150,
          render: (_: any, r: ChiTietDeXuat) => (
            <div style={{ lineHeight: 1.5 }}>
              <div style={{ whiteSpace: 'nowrap' }}>Bậc {r.bacCu} - {hs3(r.heSoCu)}{r.tnvkCu ? ` + VK ${r.tnvkCu}%` : ''}</div>
              {r.ngayHieuLucCu && <Text type="secondary" style={{ fontSize: 13 }}>từ {formatDate(r.ngayHieuLucCu)}</Text>}
            </div>
          ),
        },
        {
          title: 'Đề nghị', key: 'moi', width: 160,
          render: (_: any, r: ChiTietDeXuat) => (coDoiLuong(r)
            ? (
              <div style={{ lineHeight: 1.5 }}>
                <div style={{ fontWeight: 600, color: '#0958d9', whiteSpace: 'nowrap' }}>Bậc {r.bacMoi} - {hs3(r.heSoMoi)}{r.tnvkMoi != null ? ` + VK ${r.tnvkMoi}%` : ''}</div>
                <Text style={{ fontSize: 13 }}>từ <b>{formatDate(r.ngayHieuLuc)}</b></Text>
              </div>
            )
            : <Text type="secondary">Lương giữ nguyên</Text>),
        },
        ...(coPhuCap ? [{
          title: 'Phụ cấp điều chỉnh (cũ → mới)', key: 'pc', width: 280,
          render: (_: any, r: ChiTietDeXuat) => (r.phuCaps?.length ? <NoiDungDieuChinh r={r} chucDanhs={chucDanhs} chiPhuCap /> : <Text type="secondary">-</Text>),
        }] : []),
        ...(lyDoChung ? [] : [colLyDo]),
        ...(coMinhChung ? [colMinhChung] : []),
      ]
  const detailCols = coCotThamDinh ? [...detailColsGoc, colThamDinh] : detailColsGoc

  const canSubmit = dx.trangThai === 'NHAP' && dx.nguoiDeXuatId === currentUser?.id
  // Bản nháp và phiếu bị yêu cầu bổ sung: trường lập phiếu mở lại để sửa, rồi trình lại
  const canSua = (dx.trangThai === 'NHAP' || dx.trangThai === 'YEU_CAU_BO_SUNG')
    && (dx.nguoiDeXuatId === currentUser?.id || laQuanTri || (!!scopeDonViId && dx.donViId === scopeDonViId))
  // Quy trình: Kế toán lập → Hiệu trưởng duyệt → Phòng VH-XH thẩm định → Lãnh đạo Phòng VHXH (hoặc Admin) phê duyệt cuối.
  // Mỗi bước cần đúng vai trò VÀ còn quyền "Duyệt đề xuất" - quyền bị thu hồi riêng thì không duyệt được.
  const coQuyenDuyet = hasPermission('deXuat', 'approve')
  const canDuyetHT = dx.trangThai === 'CHO_HIEU_TRUONG_DUYET'
    && (laQuanTri || (isHieuTruong && coQuyenDuyet && dx.donViId === scopeDonViId))
  const canXetDuyet = dx.trangThai === 'CHO_XET_DUYET' && (laQuanTri || (isVHXH && coQuyenDuyet))
  const canPheDuyet = dx.trangThai === 'CHO_PHE_DUYET' && (laQuanTri || (isLanhDao && coQuyenDuyet))

  const handleAction = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      // Phê duyệt ghi thẳng vào lương, hồ sơ: tải bản mới nhất trước để không đè sửa đổi của người khác
      await lamMoiNgay()
      if (modalAction === 'submit') {
        submitDeXuat(id!, currentUser.id, currentUser.fullName)
        message.success('Đã trình Thủ trưởng đơn vị')
      } else if (modalAction === 'ht_approve') {
        duyetHieuTruong(id!, 'DONG_Y', ghiChu, currentUser.id, currentUser.fullName)
        message.success('Thủ trưởng đơn vị đã duyệt - chuyển Phòng VHXH thẩm định')
      } else if (modalAction === 'ht_reject') {
        duyetHieuTruong(id!, 'TU_CHOI', ghiChu, currentUser.id, currentUser.fullName)
        message.warning('Đã từ chối đề xuất')
      } else if (modalAction === 'ht_supplement') {
        duyetHieuTruong(id!, 'YEU_CAU_BO_SUNG', ghiChu, currentUser.id, currentUser.fullName)
        message.info('Đã yêu cầu bổ sung hồ sơ')
      } else if (modalAction === 'xd_approve') {
        const moi = useDeXuatStore.getState().getById(id!)
        if (laTruocHan) {
          const chua = moi?.chiTiet.filter((c) => !c.thamDinh).length ?? 0
          if (chua) { message.warning(`Còn ${chua} người chưa thẩm định - chọn Đồng ý / Không đồng ý cho từng người`); return }
        }
        if (!moi?.chiTiet.some((c) => c.thamDinh !== 'KHONG_DONG_Y')) { message.warning('Không có người nào được đồng ý - chọn Từ chối hồ sơ thay vì trình Lãnh đạo Phòng đạo'); return }
        xetDuyetDeXuat(id!, 'DONG_Y', ghiChu, currentUser.id, currentUser.fullName)
        message.success('Đã thẩm định - trình Lãnh đạo Phòng phê duyệt')
      } else if (modalAction === 'xd_reject') {
        xetDuyetDeXuat(id!, 'TU_CHOI', ghiChu, currentUser.id, currentUser.fullName)
        message.warning('Đã từ chối đề xuất')
      } else if (modalAction === 'xd_supplement') {
        xetDuyetDeXuat(id!, 'YEU_CAU_BO_SUNG', ghiChu, currentUser.id, currentUser.fullName)
        message.info('Đã yêu cầu bổ sung hồ sơ')
      } else if (modalAction === 'pd_approve') {
        pheDuyetDeXuat(id!, 'PHE_DUYET', ghiChu, currentUser.id, currentUser.fullName)
        message.success(laPctn ? 'Phê duyệt thành công - phụ cấp thâm niên đã cập nhật' : 'Phê duyệt thành công - hồ sơ lương đã cập nhật')
      } else if (modalAction === 'pd_reject') {
        pheDuyetDeXuat(id!, 'TU_CHOI', ghiChu, currentUser.id, currentUser.fullName)
        message.warning('Đã từ chối')
      }
    } finally {
      setLoading(false)
      setModalOpen(false)
      setGhiChu('')
    }
  }

  const openModal = (action: string) => { setModalAction(action); setGhiChu(''); setModalOpen(true) }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(veDanhSach)}>Quay lại</Button>
      </Space>

      <Card title={<><Tag color={TRANG_THAI_COLORS[dx.trangThai]}>{TRANG_THAI_LABELS[dx.trangThai]}</Tag> {dx.ma} - {dx.tieuDe}</>}>
        <Steps current={currentStep} items={stepItems} size="small" style={{ marginBottom: 24 }} />

        <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Đơn vị">{donVi?.ten ?? dx.donViId}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{formatDate(dx.createdAt)}</Descriptions.Item>
          <Descriptions.Item label={laTruocHan ? 'Loại hồ sơ' : 'Loại đề xuất'} span={2}>{laTruocHan ? 'Nâng bậc lương trước thời hạn do lập thành tích xuất sắc trong thực hiện nhiệm vụ' : LOAI_DE_XUAT_LABELS[dx.loai]}</Descriptions.Item>
          {dx.ghiChuDeXuat && <Descriptions.Item label="Ghi chú đề xuất" span={2}>{dx.ghiChuDeXuat}</Descriptions.Item>}
          {dx.ghiChuDuyetHT && <Descriptions.Item label="Ý kiến Thủ trưởng đơn vị" span={2}>{dx.ghiChuDuyetHT}</Descriptions.Item>}
          {dx.ghiChuXetDuyet && <Descriptions.Item label="Ý kiến Phòng VHXH" span={2}>{dx.ghiChuXetDuyet}</Descriptions.Item>}
          {dx.ghiChuPheDuyet && <Descriptions.Item label="Ý kiến Lãnh đạo Phòng" span={2}>{dx.ghiChuPheDuyet}</Descriptions.Item>}
          {laTruocHan && <>
            <Descriptions.Item label="Năm xét">{dx.namXet}</Descriptions.Item>
            <Descriptions.Item label="Tỷ lệ (10%)">
              {(() => {
                const n = dx.hoSoTruocHan?.soNguoiTraLuong ?? 0
                const toiDa = soSuatToiDa(n)
                const dongY = dx.chiTiet.filter((c) => c.thamDinh === 'DONG_Y').length
                return <span>Danh sách trả lương {n} người → tối đa <b>{toiDa}</b> suất; đề nghị <Text strong type={dx.chiTiet.length > toiDa ? 'danger' : undefined}>{dx.chiTiet.length}</Text>{dongY ? <>; VHXH đồng ý <b>{dongY}</b></> : null}</span>
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="Tờ trình"><DanhSachMinhChung value={dx.hoSoTruocHan?.toTrinh} /></Descriptions.Item>
            <Descriptions.Item label="Biên bản họp xét của đơn vị"><DanhSachMinhChung value={dx.hoSoTruocHan?.bienBan} /></Descriptions.Item>
            <Descriptions.Item label="Quy chế của đơn vị"><DanhSachMinhChung value={dx.hoSoTruocHan?.quyChe} /></Descriptions.Item>
          </>}
          {coMinhChung && <Descriptions.Item label={laTruocHan ? 'Tài liệu khác' : 'Minh chứng của phiếu'} span={laTruocHan ? 1 : 2}><DanhSachMinhChung value={dx.minhChung} /></Descriptions.Item>}
        </Descriptions>

        <Title level={5}>
          Chi tiết đề xuất ({dx.chiTiet.length} người)
          {dx.chiTiet.some((c) => c.thamDinh === 'KHONG_DONG_Y') && <Tag color="error" style={{ marginLeft: 8, fontWeight: 400 }}>VHXH không đồng ý {dx.chiTiet.filter((c) => c.thamDinh === 'KHONG_DONG_Y').length} người - không ghi hồ sơ, không đưa vào thông báo</Tag>}
        </Title>
        {canXetDuyet && !laTruocHan && laHoSoNangLuong(dx.loai) && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
            Cột <b>Phòng VHXH thẩm định</b>: mặc định Đồng ý; người không đủ điều kiện chọn <b>Không đồng ý</b> kèm ý kiến.
          </Text>
        )}
        {lyDoChung && <div style={{ marginBottom: 8 }}><Text type="secondary">Lý do: </Text>{lyDoChung}</div>}
        <Table dataSource={dx.chiTiet} columns={detailCols} rowKey="vienChucId" size="small" pagination={false} bordered
          scroll={{ x: 'max-content' }} />

        <Divider style={{ marginBottom: 0 }} />
        <Space wrap className="thanh-thao-tac-phieu">
          {canSua && <Button icon={<EditOutlined />} onClick={() => navigate(`${goc}/${dx.id}/edit`)}>{dx.trangThai === 'YEU_CAU_BO_SUNG' ? 'Sửa & trình lại' : 'Sửa phiếu'}</Button>}
          <NutXoaPhieuNhap dx={dx} sauKhiXoa={() => navigate(veDanhSach, { replace: true })} />
          {canSubmit && <Button type="primary" icon={<CheckOutlined />} onClick={() => openModal('submit')}>Trình Thủ trưởng đơn vị duyệt</Button>}
          {canDuyetHT && <>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => openModal('ht_approve')}>Duyệt - trình Phòng VHXH</Button>
            <Button icon={<SyncOutlined />} onClick={() => openModal('ht_supplement')}>Yêu cầu bổ sung</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => openModal('ht_reject')}>Từ chối</Button>
          </>}
          {canXetDuyet && <>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => openModal('xd_approve')}>Đồng ý - trình Lãnh đạo Phòng</Button>
            <Button icon={<SyncOutlined />} onClick={() => openModal('xd_supplement')}>Yêu cầu bổ sung</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => openModal('xd_reject')}>Từ chối</Button>
          </>}
          {canPheDuyet && <>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => openModal('pd_approve')}>Phê duyệt</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => openModal('pd_reject')}>Từ chối</Button>
          </>}
        </Space>
      </Card>

      <Modal
        open={modalOpen}
        title={modalAction.includes('approve') || modalAction === 'submit' ? 'Xác nhận' : 'Lý do từ chối / yêu cầu'}
        onCancel={() => setModalOpen(false)}
        onOk={handleAction}
        confirmLoading={loading}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <TextArea rows={4} placeholder="Nhập ghi chú / lý do..." value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
      </Modal>
    </div>
  )
}
