import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Table, Space, InputNumber, DatePicker, Typography, Divider, Tag, App, Alert, Tooltip, Result, Modal, Row, Col } from 'antd'
import { DeleteOutlined, ArrowLeftOutlined, SendOutlined, WarningOutlined, EditOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import type { ChiTietDeXuat, LoaiDeXuat, KhaiPctnLanDau, DongQuaTrinhPctn } from '@/types/deXuat'
import { LOAI_DE_XUAT_LABELS, LOAI_CAN_MINH_CHUNG, NGHIEP_VU_LOAI, TEN_CHUC_NANG_DE_XUAT, laDongVuotKhung } from '@/types/deXuat'
import NoiDungDieuChinh from '@/components/NoiDungDieuChinh'
import { isDangCongTac, nhanLuongTheoTien } from '@/types/vienChuc'
import { soSanhVienChuc, formatDate } from '@/utils/helpers'
import { laDienPhuCapThamNien, nhomCoBan } from '@/utils/nhomViTri'
import MinhChungField from '@/components/MinhChungField'
import { lamMoiNgay } from '@/lib/supabase'
import { chonBanDangHuong } from '@/utils/phuCapDangHuong'
import type { MinhChung } from '@/lib/minhChung'
import { goiYQuaTrinh, huongTuMacDinh, ngayDu5Nam, dongCuoi, ghiChuMacDinh } from '@/utils/pctnLanDau'

const { Title, Text } = Typography

// Phiếu nâng bậc (thường xuyên, trước hạn) phải lên bậc cao hơn; điều chỉnh, chuyển ngạch thì không bắt buộc
const LOAI_NANG_BAC: LoaiDeXuat[] = ['NANG_BAC', 'NANG_TRUOC_HAN']

export default function TaoDeXuatPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  // Mở từ hồ sơ viên chức ("Lập phiếu điều chỉnh"): chọn sẵn loại phiếu và người cần điều chỉnh
  const [thamSo] = useSearchParams()
  const loaiTuHoSo = thamSo.get('loai') as LoaiDeXuat | null
  const vcTuHoSo = thamSo.get('vienChucId')
  const daNapTuHoSo = useRef(false)
  const [form] = Form.useForm()
  const { currentUser, scopeDonViId } = useAuth()
  const { addDeXuat, updateDeXuat, submitDeXuat } = useDeXuatStore.getState()
  const dxSua = useDeXuatStore((s) => (editId ? s.deXuats.find((d) => d.id === editId) : undefined))
  const allDonVis = useDanhMucStore((s) => s.donVis)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  const allVienChucs = useVienChucStore((s) => s.vienChucs)
  const donVis = useMemo(() => allDonVis.filter((d) => d.active), [allDonVis])
  // Người nhận lương theo mức tiền không nâng bậc/hệ số → không đưa vào đề xuất
  const vienChucs = useMemo(() => allVienChucs.filter((v) => v.active && isDangCongTac(v) && !nhanLuongTheoTien(v)), [allVienChucs])
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const [chiTiet, setChiTiet] = useState<ChiTietDeXuat[]>([])
  const [minhChung, setMinhChung] = useState<MinhChung[]>([])
  const [selectedDonVi, setSelectedDonVi] = useState<string | undefined>(scopeDonViId ?? undefined)
  const [loaiDeXuat, setLoaiDeXuat] = useState<LoaiDeXuat>('NANG_BAC')
  const laPctn = loaiDeXuat === 'PHU_CAP_THAM_NIEN'
  // Xếp phụ cấp thâm niên lần đầu: kế toán khai thời gian đóng BHXH, thời gian không tính; hệ thống tính mức hưởng
  const laLanDau = loaiDeXuat === 'PCTN_LAN_DAU'
  const [dangKhai, setDangKhai] = useState<number | null>(null)
  const phuCapVienChucs = useLuongStore((s) => s.phuCapVienChucs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const loaiPctn = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN')
  const loaiTnvk = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN_VK')
  const nguoiTaiLen = currentUser?.fullName ?? ''

  // ── Sửa phiếu: chỉ bản nháp hoặc phiếu bị yêu cầu bổ sung ──
  const duocSua = !editId || (!!dxSua && (dxSua.trangThai === 'NHAP' || dxSua.trangThai === 'YEU_CAU_BO_SUNG')
    && (!scopeDonViId || dxSua.donViId === scopeDonViId))
  useEffect(() => {
    if (!dxSua) return
    form.setFieldsValue({ tieuDe: dxSua.tieuDe, donViId: dxSua.donViId, loai: dxSua.loai, ghiChu: dxSua.ghiChuDeXuat })
    setSelectedDonVi(dxSua.donViId)
    setLoaiDeXuat(dxSua.loai)
    setChiTiet(dxSua.chiTiet)
    setMinhChung(dxSua.minhChung ?? [])
  }, [dxSua?.id])

  useEffect(() => {
    if (editId || !loaiTuHoSo || !(loaiTuHoSo in LOAI_DE_XUAT_LABELS)) return
    form.setFieldValue('loai', loaiTuHoSo)
    setLoaiDeXuat(loaiTuHoSo)
    const dv = allVienChucs.find((v) => v.id === vcTuHoSo)?.donViId
    if (dv && !scopeDonViId) { form.setFieldValue('donViId', dv); setSelectedDonVi(dv) }
  }, [])

  // ── Bảng lương theo ngạch ──
  const bangCua = (chucDanhId: string) => bacLuongs.filter((b) => b.chucDanhId === chucDanhId).sort((a, b) => a.bac - b.bac)
  const cdCua = (chucDanhId: string) => chucDanhs.find((c) => c.id === chucDanhId)
  const thoiGianNangBac = (chucDanhId: string, bac: number) => {
    const bang = bangCua(chucDanhId)
    return (bang.find((b) => b.bac === bac) ?? bang[0])?.thoiGianNangLuong ?? (/^[BC]/.test(cdCua(chucDanhId)?.bangLuong ?? '') ? 2 : 3)
  }
  const chucDanhOptions = useMemo(() => chucDanhs.filter((c) => c.active)
    .map((c) => ({ value: c.id, label: `${c.ma} - ${c.ten} (${c.bangLuong})` })), [chucDanhs])

  // Phiếu PCTN chỉ áp dụng cho CBQL và giáo viên (nhân viên không hưởng phụ cấp thâm niên);
  // hồ sơ cũ chưa gán VTVL thì xét theo nhóm ngạch/hạng đang xếp
  const duocHuongPctn = (v: { vtvl?: string; chucVu?: string; chucDanhId: string }) =>
    laDienPhuCapThamNien(v as { vtvl?: string; chucVu?: string }, chucDanhs.find((c) => c.id === v.chucDanhId)?.nhom)

  const vcOptions = vienChucs
    .filter((v) => !selectedDonVi || v.donViId === selectedDonVi)
    .filter((v) => !(laPctn || laLanDau) || duocHuongPctn(v))
    .sort(soSanhVienChuc((v) => chucDanhs.find((c) => c.id === v.chucDanhId)?.nhom))
    .map((v) => ({ value: v.id, label: `${v.ho} ${v.ten}` }))

  const addVC = (vcId: string | undefined, ngayHieuLucOverride?: string) => {
    if (!vcId) return
    if (chiTiet.find((c) => c.vienChucId === vcId)) { message.warning('Viên chức đã có trong danh sách'); return }
    const vc = vienChucs.find((v) => v.id === vcId)
    const hsl = heSoLuongs.find((h) => h.vienChucId === vcId && h.isActive)
    if (!vc) return
    if (!hsl) { message.warning(`${vc.ho} ${vc.ten} chưa có bậc, hệ số lương - khai trong hồ sơ trước`); return }
    if ((laPctn || laLanDau) && !duocHuongPctn(vc)) {
      message.warning('Vị trí việc làm Nhân viên không hưởng phụ cấp thâm niên')
      return
    }
    const bang = bangCua(hsl.chucDanhId)
    const bacCuoi = bang.length ? bang[bang.length - 1].bac : undefined
    // Bậc cuối của bảng: phiếu nâng bậc thường xuyên ghi thành dòng phụ cấp thâm niên vượt khung (giữ bậc);
    // phiếu nâng trước hạn thì không áp dụng
    const laVuotKhung = loaiDeXuat === 'NANG_BAC' && bacCuoi !== undefined && hsl.bac >= bacCuoi
    if (!laPctn && loaiDeXuat === 'NANG_TRUOC_HAN' && bacCuoi !== undefined && hsl.bac >= bacCuoi) {
      message.warning(`${vc.ho} ${vc.ten} đã ở bậc cuối (${hsl.bac}/${bacCuoi}) của bảng ${cdCua(hsl.chucDanhId)?.bangLuong ?? ''} - không nâng bậc, xét phụ cấp thâm niên vượt khung`)
      return
    }
    const nextBac = LOAI_NANG_BAC.includes(loaiDeXuat) && !laVuotKhung ? bang.find((b) => b.bac === hsl.bac + 1) : bang.find((b) => b.bac === hsl.bac)
    const tnvkHienTai = loaiTnvk
      ? chonBanDangHuong(phuCapVienChucs.filter((p) => p.vienChucId === vcId && p.isActive && p.loaiPhuCapId === loaiTnvk.id))?.giaTri ?? 0
      : 0
    // PCTN đang hưởng (nếu có) để cán bộ đối chiếu khi nhập mức mới
    const pctnHienTai = loaiPctn
      ? chonBanDangHuong(phuCapVienChucs.filter((p) => p.vienChucId === vcId && p.isActive && p.loaiPhuCapId === loaiPctn.id))?.giaTri ?? 0
      : 0
    // Nâng PCTN chỉ cho người đã hưởng; chưa hưởng thì phải xếp lần đầu (khai thời gian đóng BHXH, có minh chứng)
    if (laPctn && pctnHienTai <= 0) {
      message.warning(`${vc.ho} ${vc.ten} chưa hưởng phụ cấp thâm niên - lập phiếu "Xếp phụ cấp thâm niên nhà giáo lần đầu"`)
      return
    }
    if (laLanDau && pctnHienTai > 0) {
      message.warning(`${vc.ho} ${vc.ten} đang hưởng phụ cấp thâm niên ${pctnHienTai}% - dùng phiếu "Nâng phụ cấp thâm niên"`)
      return
    }
    if (laLanDau) {
      const khai: KhaiPctnLanDau = {
        ngayTuyenDung: vc.ngayVaoBienChe,
        trinhDo: vc.trinhDoChuyenMon,
        batDauBhxh: vc.ngayVaoNganh ? vc.ngayVaoNganh.slice(0, 7) : undefined,
        thangTapSu: 12,
        thangKhongTinhKhac: 0,
        huongTu: huongTuMacDinh(vc.ngayVaoBienChe),
        quaTrinh: [],
      }
      khai.quaTrinh = goiYQuaTrinh(khai, dotRange.end)
      const cuoi = dongCuoi(khai.quaTrinh)
      setChiTiet((prev) => [...prev, {
        vienChucId: vcId,
        chucDanhCuId: hsl.chucDanhId, chucDanhMoiId: hsl.chucDanhId,
        bacCu: hsl.bac, heSoCu: hsl.heSo, bacMoi: hsl.bac, heSoMoi: hsl.heSo,
        ngayHieuLuc: cuoi?.thoiGianHuong ?? '',
        lyDo: 'Đủ 5 năm giảng dạy có đóng BHXH bắt buộc - xếp phụ cấp thâm niên nhà giáo lần đầu',
        ghiChu: ghiChuMacDinh(khai),
        pctnCu: 0, pctnMoi: cuoi?.tyLe ?? 0,
        lanDau: khai,
      }])
      return
    }
    // Phiếu PCTN: gợi ý mốc mới = mốc hưởng PCTN hiện tại + 1 năm, mức mới = mức cũ + 1%
    const mocPctnMoi = vc.mocHuongPctn ? dayjs(vc.mocHuongPctn).add(1, 'year').format('YYYY-MM-DD') : undefined
    // Mốc hưởng mặc định: nâng thường xuyên = ngày đến hạn nâng bậc; loại khác = hôm nay
    const mocMacDinh = laPctn ? mocPctnMoi : loaiDeXuat === 'NANG_BAC' ? hsl.ngayNangLuongTiepTheo : undefined
    setChiTiet((prev) => [...prev, {
      vienChucId: vcId,
      chucDanhCuId: hsl.chucDanhId,
      bacCu: hsl.bac, heSoCu: hsl.heSo,
      ngayHieuLucCu: hsl.ngayHieuLuc,
      ngayDenHanCu: hsl.ngayNangLuongTiepTheo,
      chucDanhMoiId: hsl.chucDanhId,
      bacMoi: nextBac?.bac ?? hsl.bac,
      heSoMoi: nextBac?.heSo ?? hsl.heSo,
      ngayHieuLuc: ngayHieuLucOverride ?? mocMacDinh ?? dayjs().format('YYYY-MM-DD'),
      lyDo: laPctn ? 'Nâng phụ cấp thâm niên theo niên hạn'
        : loaiDeXuat === 'NANG_TRUOC_HAN' ? 'Nâng bậc trước thời hạn do lập thành tích xuất sắc'
        : loaiDeXuat === 'CHUYEN_NGACH' ? 'Chuyển ngạch / thay đổi hạng chức danh'
        : loaiDeXuat === 'DIEU_CHINH' ? 'Điều chỉnh hệ số lương'
        : laVuotKhung ? (tnvkHienTai > 0 ? 'Nâng phụ cấp thâm niên vượt khung' : 'Hưởng phụ cấp thâm niên vượt khung lần đầu')
        : 'Đủ thời hạn nâng bậc thường xuyên',
      pctnCu: pctnHienTai,
      pctnMoi: laPctn ? (pctnHienTai > 0 ? pctnHienTai + 1 : 5) : pctnHienTai,
      ...(laVuotKhung ? { tnvkCu: tnvkHienTai, tnvkMoi: tnvkHienTai > 0 ? tnvkHienTai + 1 : 5 } : {}),
    }])
  }

  // Thêm sẵn người được mở từ hồ sơ, sau khi loại phiếu đã áp dụng (addVC tính theo loại phiếu)
  useEffect(() => {
    if (editId || !vcTuHoSo || daNapTuHoSo.current || loaiDeXuat !== loaiTuHoSo) return
    if (!heSoLuongs.some((h) => h.vienChucId === vcTuHoSo && h.isActive)) return
    daNapTuHoSo.current = true
    addVC(vcTuHoSo)
  }, [loaiDeXuat, heSoLuongs])

  // ── Gợi ý viên chức đến kỳ nâng lương thường xuyên (2 đợt/năm: 6 tháng đầu / 6 tháng cuối) ──
  const currentYear = dayjs().year()
  const [dotNam, setDotNam] = useState(currentYear)
  const [dotKy, setDotKy] = useState<'H1' | 'H2'>(dayjs().month() < 6 ? 'H1' : 'H2')
  const [selectedGoiY, setSelectedGoiY] = useState<string[]>([])
  const [selectedGoiYPctn, setSelectedGoiYPctn] = useState<string[]>([])

  const dotRange = useMemo(() => (
    dotKy === 'H1'
      ? { start: `${dotNam}-01-01`, end: `${dotNam}-06-30` }
      : { start: `${dotNam}-07-01`, end: `${dotNam}-12-31` }
  ), [dotNam, dotKy])

  const goiYData = useMemo(() => {
    return vienChucs
      .filter((v) => !selectedDonVi || v.donViId === selectedDonVi)
      .filter((v) => !chiTiet.some((c) => c.vienChucId === v.id))
      .map((v) => ({ vc: v, hsl: heSoLuongs.find((h) => h.vienChucId === v.id && h.isActive) }))
      .filter((x): x is { vc: typeof vienChucs[number]; hsl: NonNullable<typeof x.hsl> } => !!x.hsl)
      .filter(({ hsl }) => hsl.ngayNangLuongTiepTheo >= dotRange.start && hsl.ngayNangLuongTiepTheo <= dotRange.end)
      .map(({ vc, hsl }) => {
        const bang = bacLuongs.filter((b) => b.chucDanhId === hsl.chucDanhId)
        const bacCuoi = bang.length ? Math.max(...bang.map((b) => b.bac)) : undefined
        return {
          id: vc.id,
          hoTen: `${vc.ho} ${vc.ten}`,
          bac: hsl.bac,
          heSo: hsl.heSo,
          ngayNangLuongTiepTheo: hsl.ngayNangLuongTiepTheo,
          daBacCuoi: bacCuoi !== undefined && hsl.bac >= bacCuoi,
        }
      })
      .sort((a, b) => a.ngayNangLuongTiepTheo.localeCompare(b.ngayNangLuongTiepTheo))
  }, [vienChucs, selectedDonVi, chiTiet, heSoLuongs, dotRange, bacLuongs])

  const themDaChon = () => {
    selectedGoiY.forEach((vcId) => {
      const item = goiYData.find((g) => g.id === vcId)
      if (item) addVC(item.id, item.ngayNangLuongTiepTheo)
    })
    setSelectedGoiY([])
  }

  // ── Gợi ý viên chức đến kỳ nâng PCTN (mỗi năm +1% vào đúng ngày kỷ niệm mocHuongPctn) ──
  const goiYPctnData = useMemo(() => {
    if (!laPctn) return []
    return vienChucs
      .filter((v) => !selectedDonVi || v.donViId === selectedDonVi)
      .filter((v) => !!v.mocHuongPctn && duocHuongPctn(v))
      .filter((v) => !chiTiet.some((c) => c.vienChucId === v.id))
      .map((v) => {
        const moc = dayjs(v.mocHuongPctn!)
        // Ngày kỷ niệm trong năm được chọn (cùng tháng/ngày, khác năm)
        const anniversaryStr = `${dotNam}-${moc.format('MM-DD')}`
        const pctnHienTai = loaiPctn
          ? chonBanDangHuong(phuCapVienChucs.filter((p) => p.vienChucId === v.id && p.isActive && p.loaiPhuCapId === loaiPctn.id))?.giaTri ?? 0
          : 0
        return {
          id: v.id,
          hoTen: `${v.ho} ${v.ten}`,
          mocHuongPctn: v.mocHuongPctn!,
          anniversaryStr,
          pctnHienTai,
          pctnMoi: pctnHienTai > 0 ? pctnHienTai + 1 : 5,
        }
      })
      .filter(({ anniversaryStr }) => anniversaryStr >= dotRange.start && anniversaryStr <= dotRange.end)
      .sort((a, b) => a.anniversaryStr.localeCompare(b.anniversaryStr))
  }, [laPctn, vienChucs, selectedDonVi, chiTiet, dotNam, dotRange, loaiPctn, phuCapVienChucs, chucDanhs])

  const [selectedGoiYLanDau, setSelectedGoiYLanDau] = useState<string[]>([])
  const goiYLanDauData = useMemo(() => {
    if (!laLanDau || !loaiPctn) return []
    return vienChucs
      .filter((v) => !selectedDonVi || v.donViId === selectedDonVi)
      .filter((v) => duocHuongPctn(v) && !chiTiet.some((c) => c.vienChucId === v.id))
      .filter((v) => !phuCapVienChucs.some((p) => p.vienChucId === v.id && p.isActive && p.loaiPhuCapId === loaiPctn.id && p.giaTri > 0))
      .map((v) => {
        const duKien = ngayDu5Nam({ batDauBhxh: v.ngayVaoNganh?.slice(0, 7), thangTapSu: 12, thangKhongTinhKhac: 0 })
        const laCbql = nhomCoBan(v, chucDanhs.find((c) => c.id === v.chucDanhId)?.nhom) === 'CBQL'
        return { id: v.id, hoTen: `${v.ho} ${v.ten}`, viTri: laCbql ? 'Cán bộ quản lý' : 'Giáo viên', ngayVaoNganh: v.ngayVaoNganh, ngayTuyenDung: v.ngayVaoBienChe, duKien }
      })
      // Liệt kê mọi người chưa hưởng (hồ sơ có thể chưa ghi thời gian dạy ngoài công lập); người dự kiến đủ trong kỳ lên đầu
      .map((x) => ({ ...x, duTrongKy: !!x.duKien && x.duKien <= dotRange.end }))
      .sort((a, b) => Number(b.duTrongKy) - Number(a.duTrongKy) || (a.duKien ?? '9').localeCompare(b.duKien ?? '9'))
  }, [laLanDau, vienChucs, selectedDonVi, chiTiet, phuCapVienChucs, loaiPctn, dotRange])
  const themDaChonLanDau = () => {
    selectedGoiYLanDau.forEach((vcId) => addVC(vcId))
    setSelectedGoiYLanDau([])
  }

  const themDaChonPctn = () => {
    selectedGoiYPctn.forEach((vcId) => {
      const item = goiYPctnData.find((g) => g.id === vcId)
      if (item) addVC(item.id, item.anniversaryStr)
    })
    setSelectedGoiYPctn([])
  }

  const updateChiTiet = (idx: number, patch: Partial<ChiTietDeXuat>) => {
    setChiTiet((prev) => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }

  // Chuyển ngạch: xếp vào bậc có hệ số bằng hoặc cao hơn gần nhất so với hệ số đang hưởng
  const doiNgachMoi = (idx: number, chucDanhMoiId: string) => {
    const r = chiTiet[idx]
    const bang = bangCua(chucDanhMoiId)
    const bac = bang.find((b) => b.heSo >= r.heSoCu) ?? bang[bang.length - 1]
    updateChiTiet(idx, { chucDanhMoiId, bacMoi: bac?.bac ?? r.bacMoi, heSoMoi: bac?.heSo ?? r.heSoMoi })
  }

  const doiLoai = (v: LoaiDeXuat) => {
    const ap = () => { setLoaiDeXuat(v); setChiTiet([]) }
    if (!chiTiet.length) return ap()
    modal.confirm({
      title: 'Đổi loại đề xuất?',
      content: `Danh sách ${chiTiet.length} viên chức hiện có sẽ bị xoá để lập lại theo loại mới.`,
      okText: 'Đổi loại', cancelText: 'Giữ nguyên',
      onOk: ap,
      onCancel: () => form.setFieldValue('loai', loaiDeXuat),
    })
  }

  // ── Kiểm tra trước khi lưu / trình ──
  const kiemTra = (loai: LoaiDeXuat, trinh: boolean): string[] => {
    const loi: string[] = []
    if (chiTiet.length === 0) loi.push('Thêm ít nhất một viên chức')
    chiTiet.forEach((r) => {
      const vc = vienChucs.find((v) => v.id === r.vienChucId) ?? allVienChucs.find((v) => v.id === r.vienChucId)
      const ten = vc ? `${vc.ho} ${vc.ten}` : r.vienChucId
      if (loai === 'PCTN_LAN_DAU') {
        const k = r.lanDau
        if (!k?.batDauBhxh) loi.push(`${ten}: chưa khai tháng bắt đầu giảng dạy có đóng BHXH`)
        else if (!k.quaTrinh.length) loi.push(`${ten}: chưa đủ 5 năm (60 tháng) tính hưởng đến hết kỳ - kiểm tra lại khai báo`)
        k?.quaTrinh.forEach((q) => {
          if (q.tyLe < 5 || !q.mocXet || !q.thoiGianHuong) loi.push(`${ten}: dòng quá trình hưởng chưa đủ tỷ lệ, mốc xét, thời gian hưởng`)
        })
        if (trinh && !r.minhChung?.length) loi.push(`${ten}: đính kèm minh chứng riêng (bằng cấp, QĐ tuyển dụng, QĐ lương, quá trình BHXH)`)
        return
      }
      if (!r.ngayHieuLuc) loi.push(`${ten}: chưa có mốc hưởng`)
      if (loai === 'PHU_CAP_THAM_NIEN') return
      if (LOAI_NANG_BAC.includes(loai) && !laDongVuotKhung(r) && r.bacMoi <= r.bacCu && r.chucDanhMoiId === r.chucDanhCuId) loi.push(`${ten}: bậc mới phải cao hơn bậc ${r.bacCu}`)
      if (!bangCua(r.chucDanhMoiId).some((b) => b.bac === r.bacMoi)) loi.push(`${ten}: bậc ${r.bacMoi} không có trong bảng lương của ngạch mới`)
      // Nâng trước hạn: mốc hưởng mới phải sớm hơn ngày đến hạn, nhưng không quá 12 tháng
      if (loai === 'NANG_TRUOC_HAN' && r.ngayDenHanCu && r.ngayHieuLuc) {
        if (r.ngayHieuLuc >= r.ngayDenHanCu) loi.push(`${ten}: mốc hưởng mới phải trước ngày đến hạn ${formatDate(r.ngayDenHanCu)}`)
        else if (dayjs(r.ngayHieuLuc).isBefore(dayjs(r.ngayDenHanCu).subtract(12, 'month'))) loi.push(`${ten}: chỉ được nâng trước hạn tối đa 12 tháng (sớm nhất ${formatDate(dayjs(r.ngayDenHanCu).subtract(12, 'month').format('YYYY-MM-DD'))})`)
      }
    })
    if (trinh && LOAI_CAN_MINH_CHUNG.includes(loai)
      && !minhChung.length && !chiTiet.some((r) => r.minhChung?.length)) {
      loi.push(`Loại "${LOAI_DE_XUAT_LABELS[loai]}" cần đính kèm ít nhất một minh chứng`)
    }
    return loi
  }

  const onFinish = async (values: any, submitNow = false) => {
    if (!currentUser) return
    await lamMoiNgay()
    const loi = kiemTra(values.loai, submitNow)
    if (loi.length) {
      modal.warning({ title: 'Chưa lưu được phiếu', content: <ul style={{ paddingLeft: 18, margin: 0 }}>{loi.slice(0, 8).map((l) => <li key={l}>{l}</li>)}</ul> })
      return
    }

    // Loại theo niên hạn không dùng minh chứng → không lưu kèm
    const canMc = LOAI_CAN_MINH_CHUNG.includes(values.loai)
    const minhChungLuu = canMc ? minhChung : []
    const chiTietLuu = canMc ? chiTiet : chiTiet.map(({ minhChung: _mc, ...r }) => r)

    let id = editId
    if (editId && dxSua) {
      updateDeXuat(editId, {
        tieuDe: values.tieuDe, donViId: values.donViId, loai: values.loai,
        chiTiet: chiTietLuu, ghiChuDeXuat: values.ghiChu, minhChung: minhChungLuu,
      })
    } else {
      id = addDeXuat({
        tieuDe: values.tieuDe,
        donViId: values.donViId,
        loai: values.loai,
        chiTiet: chiTietLuu,
        minhChung: minhChungLuu,
        trangThai: 'NHAP',
        buocHienTai: 1,
        nguoiDeXuatId: currentUser.id,
        ngayDeXuat: dayjs().format('YYYY-MM-DD'),
        ghiChuDeXuat: values.ghiChu,
      }).id
    }

    if (submitNow) {
      submitDeXuat(id!, currentUser.id, currentUser.fullName)
      message.success(dxSua?.trangThai === 'YEU_CAU_BO_SUNG' ? 'Đã sửa và trình lại đề xuất' : 'Đã lưu và nộp đề xuất')
    } else {
      message.success('Đã lưu bản nháp')
    }
    navigate(`/de-xuat/${id}`)
  }

  if (editId && !dxSua) return <Result status="404" title="Không tìm thấy đề xuất" extra={<Button onClick={() => navigate('/de-xuat')}>Quay lại</Button>} />
  if (!duocSua) return <Result status="warning" title="Phiếu này không sửa được" subTitle="Chỉ sửa được phiếu Bản nháp hoặc phiếu bị Yêu cầu bổ sung của trường mình." extra={<Button onClick={() => navigate(`/de-xuat/${editId}`)}>Xem phiếu</Button>} />

  const colVienChuc = {
    title: 'Viên chức', key: 'vc', width: 170, fixed: 'left' as const,
    render: (_: any, r: ChiTietDeXuat) => {
      const vc = allVienChucs.find((v) => v.id === r.vienChucId)
      return vc ? `${vc.ho} ${vc.ten}` : r.vienChucId
    },
  }
  const colLyDo = {
    title: 'Lý do', key: 'lyDo', width: 200,
    render: (_: any, r: ChiTietDeXuat, idx: number) => <Input.TextArea size="small" autoSize={{ minRows: 1, maxRows: 3 }} value={r.lyDo} onChange={(e) => updateChiTiet(idx, { lyDo: e.target.value })} />,
  }
  const colMinhChung = {
    title: 'Minh chứng riêng', key: 'mc', width: 190,
    render: (_: any, r: ChiTietDeXuat, idx: number) => (
      <MinhChungField compact taiLenBoi={nguoiTaiLen} value={r.minhChung} onChange={(v) => updateChiTiet(idx, { minhChung: v })} />
    ),
  }
  const colXoa = { title: '', key: 'del', width: 44, render: (_: any, __: any, idx: number) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setChiTiet((p) => p.filter((_, i) => i !== idx))} /> }

  const canMinhChung = LOAI_CAN_MINH_CHUNG.includes(loaiDeXuat)
  const thangVN = (ym?: string) => (ym ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : '')
  const colsLanDau = [
    colVienChuc,
    {
      title: 'Khai báo', key: 'khai', width: 250,
      render: (_: any, r: ChiTietDeXuat) => {
        const k = r.lanDau
        if (!k) return null
        return (
          <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
            <div>Tuyển dụng: <b>{k.ngayTuyenDung ? formatDate(k.ngayTuyenDung) : <Text type="danger">chưa có</Text>}</b></div>
            <div>Đóng BHXH giảng dạy từ: <b>{k.batDauBhxh ? thangVN(k.batDauBhxh) : <Text type="danger">chưa khai</Text>}</b></div>
            <div>Không tính: tập sự {k.thangTapSu} tháng{k.thangKhongTinhKhac ? `, khác ${k.thangKhongTinhKhac} tháng` : ''}</div>
          </div>
        )
      },
    },
    {
      title: 'Đủ 5 năm', key: 'du5', width: 105,
      render: (_: any, r: ChiTietDeXuat) => { const d = r.lanDau && ngayDu5Nam(r.lanDau); return d ? formatDate(d) : '-' },
    },
    {
      title: 'Quá trình hưởng (đến hết kỳ)', key: 'qt', width: 270,
      render: (_: any, r: ChiTietDeXuat) => (r.lanDau?.quaTrinh.length
        ? r.lanDau.quaTrinh.map((q) => (
            <div key={q.mocXet} style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
              <b>{q.tyLe}%</b> · mốc xét {formatDate(q.mocXet)} · hưởng từ {formatDate(q.thoiGianHuong)}
            </div>
          ))
        : <Text type="danger" style={{ fontSize: 12 }}>Chưa đủ 60 tháng đến hết {formatDate(dotRange.end)}</Text>),
    },
    { title: 'Ghi chú', key: 'gc', width: 170, render: (_: any, r: ChiTietDeXuat, idx: number) => <Input.TextArea size="small" autoSize={{ minRows: 1, maxRows: 3 }} value={r.ghiChu} onChange={(e) => updateChiTiet(idx, { ghiChu: e.target.value })} /> },
    colMinhChung,
    { title: '', key: 'sua', width: 90, render: (_: any, __: any, idx: number) => <Button size="small" icon={<EditOutlined />} onClick={() => setDangKhai(idx)}>Khai báo</Button> },
    colXoa,
  ]
  const detailCols = laLanDau ? colsLanDau : laPctn
    ? [
        colVienChuc,
        {
          title: 'Mốc PCTN hiện tại', key: 'moc_cu', width: 130,
          render: (_: any, r: ChiTietDeXuat) => {
            const moc = allVienChucs.find((v) => v.id === r.vienChucId)?.mocHuongPctn
            return moc ? formatDate(moc) : <Text type="secondary">Chưa khai báo</Text>
          },
        },
        { title: 'PCTN hiện tại', key: 'pctn_cu', width: 100, render: (_: any, r: ChiTietDeXuat) => `${r.pctnCu ?? 0}%` },
        {
          title: 'PCTN đề nghị', key: 'pctn_moi', width: 110,
          render: (_: any, r: ChiTietDeXuat, idx: number) => (
            <InputNumber size="small" value={r.pctnMoi} min={0} max={100} suffix="%" onChange={(v) => updateChiTiet(idx, { pctnMoi: v ?? 0 })} />
          ),
        },
        {
          title: 'Mốc hưởng PCTN', key: 'nhl', width: 140,
          render: (_: any, r: ChiTietDeXuat, idx: number) => <DatePicker size="small" value={r.ngayHieuLuc ? dayjs(r.ngayHieuLuc) : null} format="DD/MM/YYYY" onChange={(d) => updateChiTiet(idx, { ngayHieuLuc: d?.format('YYYY-MM-DD') ?? '' })} />,
        },
        colLyDo,
        colXoa,
      ]
    : [
        colVienChuc,
        {
          title: 'Ngạch mới', key: 'ngach_moi', width: 230,
          render: (_: any, r: ChiTietDeXuat, idx: number) => (
            <Select
              size="small"
              style={{ width: '100%' }}
              value={r.chucDanhMoiId}
              options={chucDanhOptions}
              disabled={loaiDeXuat !== 'CHUYEN_NGACH' && loaiDeXuat !== 'DIEU_CHINH'}
              showSearch
              optionFilterProp="label"
              popupMatchSelectWidth={380}
              onChange={(v: string) => doiNgachMoi(idx, v)}
            />
          ),
        },
        {
          title: 'Bậc mới', key: 'bac_moi', width: 150,
          render: (_: any, r: ChiTietDeXuat, idx: number) => laDongVuotKhung(r) ? <Text type="secondary">Giữ bậc {r.bacCu} (bậc cuối)</Text> : (
            <Select
              size="small"
              style={{ width: '100%' }}
              value={r.bacMoi}
              options={bangCua(r.chucDanhMoiId).map((b) => ({ value: b.bac, label: `Bậc ${b.bac} - ${b.heSo.toFixed(2)}` }))}
              onChange={(v: number) => updateChiTiet(idx, { bacMoi: v, heSoMoi: bangCua(r.chucDanhMoiId).find((b) => b.bac === v)?.heSo ?? r.heSoMoi })}
            />
          ),
        },
        {
          title: 'Hệ số mới', key: 'hs_moi', width: 110,
          render: (_: any, r: ChiTietDeXuat, idx: number) => {
            const theoBang = bangCua(r.chucDanhMoiId).find((b) => b.bac === r.bacMoi)?.heSo
            // Chỉ phiếu Điều chỉnh lương được sửa tay hệ số; lệch bảng thì cảnh báo
            if (loaiDeXuat !== 'DIEU_CHINH') return <Text strong>{r.heSoMoi.toFixed(2)}</Text>
            return (
              <Space size={4}>
                <InputNumber size="small" value={r.heSoMoi} min={1} step={0.01} style={{ width: 72 }} onChange={(v) => updateChiTiet(idx, { heSoMoi: v ?? r.heSoMoi })} />
                {theoBang !== undefined && Math.abs(theoBang - r.heSoMoi) > 0.001 && (
                  <Tooltip title={`Bảng lương bậc ${r.bacMoi} là ${theoBang.toFixed(2)}`}><WarningOutlined style={{ color: '#d97706' }} /></Tooltip>
                )}
              </Space>
            )
          },
        },
        ...(loaiDeXuat === 'NANG_BAC' ? [{
          title: <Tooltip title="Người ở bậc cuối: 5% lần đầu, mỗi năm sau +1% (TT 08/2013, TT 03/2021)">PC vượt khung</Tooltip>, key: 'tnvk', width: 130,
          render: (_: any, r: ChiTietDeXuat, idx: number) => laDongVuotKhung(r) ? (
            <Space size={4}>
              <Text type="secondary">{r.tnvkCu ?? 0}% →</Text>
              <InputNumber size="small" value={r.tnvkMoi} min={5} max={100} suffix="%" style={{ width: 72 }} onChange={(v) => updateChiTiet(idx, { tnvkMoi: v ?? 5 })} />
            </Space>
          ) : <Text type="secondary">-</Text>,
        }] : []),
        {
          title: 'Mốc hưởng mới', key: 'nhl', width: 140,
          render: (_: any, r: ChiTietDeXuat, idx: number) => <DatePicker size="small" value={r.ngayHieuLuc ? dayjs(r.ngayHieuLuc) : null} format="DD/MM/YYYY" onChange={(d) => updateChiTiet(idx, { ngayHieuLuc: d?.format('YYYY-MM-DD') ?? '' })} />,
        },
        {
          title: 'Nâng bậc kế tiếp (dự kiến)', key: 'ke_tiep', width: 150,
          render: (_: any, r: ChiTietDeXuat) => {
            if (!r.ngayHieuLuc) return ''
            if (laDongVuotKhung(r)) {
              return <Tag color="purple">Vượt khung {(r.tnvkMoi ?? 5) + 1}% từ {formatDate(dayjs(r.ngayHieuLuc).add(1, 'year').format('YYYY-MM-DD'))}</Tag>
            }
            const bang = bangCua(r.chucDanhMoiId)
            const tg = thoiGianNangBac(r.chucDanhMoiId, r.bacMoi)
            const ngay = formatDate(dayjs(r.ngayHieuLuc).add(tg, 'year').format('YYYY-MM-DD'))
            const bacCuoi = bang.length && r.bacMoi >= bang[bang.length - 1].bac
            return bacCuoi
              ? <Tooltip title={`Bậc cuối - sau ${tg * 12} tháng được xét PC thâm niên vượt khung`}><Tag color="purple">Xét vượt khung {ngay}</Tag></Tooltip>
              : <Text type="secondary">{ngay} <span style={{ fontSize: 11 }}>(+{tg} năm)</span></Text>
          },
        },
        {
          title: 'Nội dung điều chỉnh (cũ → mới)', key: 'noi_dung', width: 300,
          render: (_: any, r: ChiTietDeXuat) => <NoiDungDieuChinh r={r} chucDanhs={chucDanhs} />,
        },
        colLyDo,
        ...(canMinhChung ? [colMinhChung] : []),
        colXoa,
      ]


  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(editId ? `/de-xuat/${editId}` : '/de-xuat')}>Quay lại</Button>
      </Space>
      <Title level={4}>{editId ? `Sửa đề xuất ${dxSua?.ma ?? ''}` : `Tạo ${TEN_CHUC_NANG_DE_XUAT.charAt(0).toLowerCase()}${TEN_CHUC_NANG_DE_XUAT.slice(1)}`}</Title>
      {dxSua?.trangThai === 'YEU_CAU_BO_SUNG' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="Phiếu được yêu cầu bổ sung"
          description={dxSua.ghiChuXetDuyet || dxSua.ghiChuDuyetHT || 'Xem ý kiến trong lịch sử duyệt, sửa lại rồi bấm Lưu & Trình lại.'}
        />
      )}

      <Form form={form} layout="vertical" onFinish={(v) => onFinish(v, false)} initialValues={{ loai: 'NANG_BAC', donViId: scopeDonViId ?? undefined }}>
        <Form.Item name="tieuDe" label="Tiêu đề" rules={[{ required: true }]}>
          <Input placeholder="VD: Nâng bậc lương 6 tháng đầu năm 2026 - TH Gia Viên 1" />
        </Form.Item>
        <Space wrap>
          <Form.Item name="donViId" label="Đơn vị" rules={[{ required: true }]} style={{ minWidth: 220 }}>
            <Select options={(scopeDonViId ? donVis.filter((d) => d.id === scopeDonViId) : donVis).map((d) => ({ value: d.id, label: d.ten }))} onChange={setSelectedDonVi} placeholder="Chọn đơn vị" />
          </Form.Item>
          <Form.Item name="loai" label="Loại đề xuất" rules={[{ required: true }]} style={{ minWidth: 220 }}>
            <Select
              options={Object.entries(LOAI_DE_XUAT_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              onChange={doiLoai}
            />
          </Form.Item>
        </Space>
        <Alert
          type={canMinhChung ? 'warning' : 'info'}
          showIcon
          style={{ marginBottom: 16 }}
          title={<b>{LOAI_DE_XUAT_LABELS[loaiDeXuat]}</b>}
          description={
            <ul style={{ margin: '2px 0 0', paddingLeft: 18, lineHeight: 1.65 }}>
              <li><b>Chọn người:</b> {NGHIEP_VU_LOAI[loaiDeXuat].chonNguoi}</li>
              <li><b>Nội dung điều chỉnh:</b> {NGHIEP_VU_LOAI[loaiDeXuat].dieuChinh}</li>
              <li>
                <b>Minh chứng:</b>{' '}
                {NGHIEP_VU_LOAI[loaiDeXuat].minhChung
                  ? <><Text type="danger">bắt buộc</Text> - {NGHIEP_VU_LOAI[loaiDeXuat].minhChung} (PDF/JPG/PNG, tối đa 3 MB mỗi file)</>
                  : 'không cần (xét theo niên hạn).'}
              </li>
            </ul>
          }
        />
        <Form.Item name="ghiChu" label="Ghi chú, căn cứ">
          <Input.TextArea rows={2} placeholder="Căn cứ pháp lý, số văn bản, giải trình trường hợp đặc biệt…" />
        </Form.Item>

        {canMinhChung && (
          <Form.Item
            label={<>Minh chứng của phiếu <Text type="danger" style={{ marginLeft: 4 }}>* bắt buộc khi trình</Text></>}
            tooltip="Quyết định, biên bản xét… Minh chứng riêng từng người (VD giấy khen) đính kèm ở cột Minh chứng riêng."
          >
            <MinhChungField taiLenBoi={nguoiTaiLen} value={minhChung} onChange={setMinhChung} />
          </Form.Item>
        )}

        {!laPctn && loaiDeXuat === 'NANG_BAC' && <>
        <Divider plain>Gợi ý viên chức đến kỳ nâng lương thường xuyên</Divider>
        <Space wrap style={{ marginBottom: 12 }}>
          <InputNumber value={dotNam} onChange={(v) => setDotNam(v ?? currentYear)} style={{ width: 100 }} />
          <Select
            value={dotKy}
            onChange={setDotKy}
            style={{ width: 180 }}
            options={[
              { value: 'H1', label: '6 tháng đầu năm' },
              { value: 'H2', label: '6 tháng cuối năm' },
            ]}
          />
          <Button type="primary" ghost disabled={selectedGoiY.length === 0} onClick={themDaChon}>
            Thêm {selectedGoiY.length > 0 ? selectedGoiY.length : ''} đã chọn vào đề xuất
          </Button>
        </Space>
        <Table
          dataSource={goiYData}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 500, y: 240 }}
          style={{ marginBottom: 16 }}
          rowSelection={{
            selectedRowKeys: selectedGoiY,
            onChange: (keys) => setSelectedGoiY(keys as string[]),
            // Người ở bậc cuối vẫn chọn được: thêm thành dòng phụ cấp thâm niên vượt khung
          }}
          locale={{ emptyText: 'Không có viên chức nào đến kỳ nâng lương trong đợt này' }}
          columns={[
            { title: 'Viên chức', dataIndex: 'hoTen', key: 'ht' },
            {
              title: 'Bậc/Hệ số hiện tại', key: 'bh', width: 200,
              render: (_: any, r: any) => <>Bậc {r.bac} - {r.heSo}{r.daBacCuoi && <Tag color="purple" style={{ marginLeft: 6 }}>Bậc cuối - phụ cấp vượt khung</Tag>}</>,
            },
            { title: 'Ngày nâng lương tiếp theo', dataIndex: 'ngayNangLuongTiepTheo', key: 'nnt', width: 160, render: (v: string) => <Tag color="blue">{formatDate(v)}</Tag> },
          ]}
        />
        </>}

        {laLanDau && <>
        <Divider plain>Cán bộ quản lý, giáo viên chưa hưởng phụ cấp thâm niên (dự kiến đủ 5 năm trong kỳ tô xanh) - nhân viên không thuộc diện</Divider>
        <Space wrap style={{ marginBottom: 12 }}>
          <InputNumber value={dotNam} onChange={(v) => setDotNam(v ?? currentYear)} style={{ width: 100 }} />
          <Select value={dotKy} onChange={setDotKy} style={{ width: 180 }} options={[{ value: 'H1', label: '6 tháng đầu năm' }, { value: 'H2', label: '6 tháng cuối năm' }]} />
          <Button type="primary" ghost disabled={selectedGoiYLanDau.length === 0} onClick={themDaChonLanDau}>
            Thêm {selectedGoiYLanDau.length > 0 ? selectedGoiYLanDau.length : ''} đã chọn vào đề xuất
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>Dự kiến tạm tính từ ngày vào ngành + 60 tháng + 12 tháng tập sự; khai đúng theo hồ sơ BHXH ở nút "Khai báo".</Text>
        </Space>
        <Table
          dataSource={goiYLanDauData}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 600, y: 240 }}
          style={{ marginBottom: 16 }}
          rowSelection={{ selectedRowKeys: selectedGoiYLanDau, onChange: (keys) => setSelectedGoiYLanDau(keys as string[]) }}
          locale={{ emptyText: 'Mọi CBQL, giáo viên đều đã hưởng phụ cấp thâm niên' }}
          columns={[
            { title: 'Họ và tên', dataIndex: 'hoTen', key: 'ht' },
            { title: 'Vị trí', dataIndex: 'viTri', key: 'vt', width: 130 },
            { title: 'Ngày vào ngành', key: 'vn', width: 130, render: (_: any, r: any) => (r.ngayVaoNganh ? formatDate(r.ngayVaoNganh) : <Text type="warning">Chưa có</Text>) },
            { title: 'Ngày tuyển dụng', key: 'td', width: 130, render: (_: any, r: any) => (r.ngayTuyenDung ? formatDate(r.ngayTuyenDung) : '-') },
            { title: 'Dự kiến đủ 5 năm', key: 'dk', width: 170, render: (_: any, r: any) => (r.duKien ? <Tag color={r.duTrongKy ? 'green' : 'default'}>{formatDate(r.duKien)}{r.duTrongKy ? ' - trong kỳ' : ''}</Tag> : <Text type="secondary">Khai để tính</Text>) },
          ]}
        />
        </>}

        {laPctn && <>
        <Divider plain>Gợi ý CBQL/Giáo viên đến kỳ nâng phụ cấp thâm niên (+1%/năm)</Divider>
        <Space wrap style={{ marginBottom: 12 }}>
          <InputNumber value={dotNam} onChange={(v) => setDotNam(v ?? currentYear)} style={{ width: 100 }} />
          <Select
            value={dotKy}
            onChange={setDotKy}
            style={{ width: 180 }}
            options={[
              { value: 'H1', label: '6 tháng đầu năm' },
              { value: 'H2', label: '6 tháng cuối năm' },
            ]}
          />
          <Button type="primary" ghost disabled={selectedGoiYPctn.length === 0} onClick={themDaChonPctn}>
            Thêm {selectedGoiYPctn.length > 0 ? selectedGoiYPctn.length : ''} đã chọn vào đề xuất
          </Button>
        </Space>
        <Table
          dataSource={goiYPctnData}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 600, y: 240 }}
          style={{ marginBottom: 16 }}
          rowSelection={{ selectedRowKeys: selectedGoiYPctn, onChange: (keys) => setSelectedGoiYPctn(keys as string[]) }}
          locale={{ emptyText: 'Không có giáo viên/CBQL nào đến kỳ nâng PCTN trong đợt này' }}
          columns={[
            { title: 'Họ và tên', dataIndex: 'hoTen', key: 'ht' },
            { title: 'Mốc hưởng PCTN', key: 'moc', width: 130, render: (_: any, r: any) => formatDate(r.mocHuongPctn) },
            { title: 'PCTN hiện tại', key: 'pc_cu', width: 110, render: (_: any, r: any) => `${r.pctnHienTai}%` },
            { title: 'PCTN đề nghị', key: 'pc_moi', width: 120, render: (_: any, r: any) => <Tag color="green">+1% → {r.pctnMoi}%</Tag> },
            { title: 'Ngày tăng PCTN', key: 'ngay', width: 140, render: (_: any, r: any) => <Tag color="blue">{formatDate(r.anniversaryStr)}</Tag> },
          ]}
        />
        </>}

        <Divider plain>Danh sách viên chức trong đề xuất</Divider>
        <Space style={{ marginBottom: 12 }} wrap>
          <Select showSearch style={{ width: 260 }} placeholder="Chọn viên chức để thêm..." options={vcOptions} onSelect={(v: string | undefined) => addVC(v)} filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())} value={undefined} />
          <span>{chiTiet.length} viên chức đã thêm</span>
          {(laPctn || laLanDau) && <Text type="secondary">Chỉ CBQL và giáo viên (nhân viên không hưởng PCTN)</Text>}

        </Space>

        <Table dataSource={chiTiet} columns={detailCols} rowKey="vienChucId" size="small" pagination={false} scroll={{ x: laLanDau ? 1400 : laPctn ? 900 : (canMinhChung ? 1780 : 1590) }} style={{ marginBottom: 16 }} />

        <Space>
          <Button htmlType="submit">Lưu bản nháp</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => form.validateFields().then((v) => onFinish(v, true))}>
            {dxSua?.trangThai === 'YEU_CAU_BO_SUNG' ? 'Lưu & Trình lại' : 'Lưu & Nộp ngay'}
          </Button>
        </Space>
      </Form>
      {dangKhai !== null && chiTiet[dangKhai]?.lanDau && (
        <KhaiLanDauModal
          ten={(() => { const v = allVienChucs.find((x) => x.id === chiTiet[dangKhai].vienChucId); return v ? `${v.ho} ${v.ten}` : '' })()}
          khai={chiTiet[dangKhai].lanDau!}
          denNgay={dotRange.end}
          onHuy={() => setDangKhai(null)}
          onLuu={(k) => {
            const cuoi = dongCuoi(k.quaTrinh)
            const cu = chiTiet[dangKhai]
            updateChiTiet(dangKhai, {
              lanDau: k, pctnMoi: cuoi?.tyLe ?? 0, ngayHieuLuc: cuoi?.thoiGianHuong ?? '',
              // Ghi chú tự sinh thì cập nhật theo khai báo mới; ghi chú đã sửa tay thì giữ
              ghiChu: !cu.ghiChu || cu.ghiChu === ghiChuMacDinh(cu.lanDau!) ? ghiChuMacDinh(k) : cu.ghiChu,
            })
            setDangKhai(null)
          }}
        />
      )}
    </Card>
  )
}

/** Kế toán khai báo xếp phụ cấp thâm niên lần đầu cho một người; hệ thống gợi ý quá trình hưởng, sửa được từng dòng */
function KhaiLanDauModal({ ten, khai, denNgay, onHuy, onLuu }: {
  ten: string; khai: KhaiPctnLanDau; denNgay: string; onHuy: () => void; onLuu: (k: KhaiPctnLanDau) => void
}) {
  const [k, setK] = useState<KhaiPctnLanDau>(khai)
  const doi = (patch: Partial<KhaiPctnLanDau>) => setK((x) => ({ ...x, ...patch }))
  const du = ngayDu5Nam(k)
  const goiY = goiYQuaTrinh(k, denNgay)
  const lechGoiY = JSON.stringify(goiY) !== JSON.stringify(k.quaTrinh)
  const doiDong = (i: number, patch: Partial<DongQuaTrinhPctn>) => doi({ quaTrinh: k.quaTrinh.map((q, j) => (j === i ? { ...q, ...patch } : q)) })
  const d = (v?: string) => (v ? dayjs(v) : null)

  return (
    <Modal open width={860} title={`Khai báo xếp phụ cấp thâm niên lần đầu - ${ten}`} onCancel={onHuy} onOk={() => onLuu(k)} okText="Cập nhật vào phiếu" destroyOnHidden>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Đủ 5 năm (60 tháng) giảng dạy, giáo dục có đóng BHXH bắt buộc thì hưởng 5%, từ năm thứ sáu mỗi năm (đủ 12 tháng) +1% (NĐ 77/2021/NĐ-CP)."
        description="Không tính: thời gian tập sự; nghỉ việc riêng không lương liên tục từ 01 tháng; ốm đau, thai sản vượt quy định; đi học, công tác quá hạn; bị tạm đình chỉ, tạm giữ, tạm giam. Khai theo quá trình đóng BHXH và quyết định tuyển dụng."
      />
      <Row gutter={[12, 8]}>
        <Col xs={24} sm={8}><Text type="secondary" style={{ fontSize: 12 }}>Ngày tuyển dụng viên chức</Text><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} value={d(k.ngayTuyenDung)} onChange={(v) => doi({ ngayTuyenDung: v?.format('YYYY-MM-DD'), huongTu: huongTuMacDinh(v?.format('YYYY-MM-DD')) })} /></Col>
        <Col xs={24} sm={8}><Text type="secondary" style={{ fontSize: 12 }}>Trình độ chuyên môn</Text><Input value={k.trinhDo} onChange={(e) => doi({ trinhDo: e.target.value })} placeholder="VD Đại học SPMN" /></Col>
        <Col xs={24} sm={8}><Text type="secondary" style={{ fontSize: 12 }}>Ngày tốt nghiệp</Text><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} value={d(k.ngayTotNghiep)} onChange={(v) => doi({ ngayTotNghiep: v?.format('YYYY-MM-DD') })} /></Col>
        <Col xs={24} sm={8}><Text type="secondary" style={{ fontSize: 12 }}>Bắt đầu giảng dạy có đóng BHXH bắt buộc</Text><DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} value={k.batDauBhxh ? dayjs(`${k.batDauBhxh}-01`) : null} onChange={(v) => doi({ batDauBhxh: v?.format('YYYY-MM') })} /></Col>
        <Col xs={12} sm={4}><Text type="secondary" style={{ fontSize: 12 }}>Tập sự (tháng)</Text><InputNumber min={0} max={24} style={{ width: '100%' }} value={k.thangTapSu} onChange={(v) => doi({ thangTapSu: v ?? 0 })} /></Col>
        <Col xs={12} sm={4}><Text type="secondary" style={{ fontSize: 12 }}>Không tính khác (tháng)</Text><InputNumber min={0} max={240} style={{ width: '100%' }} value={k.thangKhongTinhKhac} onChange={(v) => doi({ thangKhongTinhKhac: v ?? 0 })} /></Col>
        <Col xs={24} sm={8}><Text type="secondary" style={{ fontSize: 12 }}>Lý do không tính khác</Text><Input value={k.lyDoKhongTinh} onChange={(e) => doi({ lyDoKhongTinh: e.target.value })} placeholder="VD Nghỉ không lương 03/2021-08/2021" disabled={!k.thangKhongTinhKhac} /></Col>
        <Col xs={24} sm={8}><Text type="secondary" style={{ fontSize: 12 }}>Được hưởng từ ngày</Text><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} value={d(k.huongTu)} onChange={(v) => doi({ huongTu: v?.format('YYYY-MM-DD') })} /></Col>
        <Col xs={24} sm={16} style={{ display: 'flex', alignItems: 'flex-end' }}>
          <Text>Đủ 5 năm tính hưởng: <b>{du ? formatDate(du) : '-'}</b>{du && du > denNgay && <Text type="danger"> - sau kỳ xét (hết {formatDate(denNgay)})</Text>}</Text>
        </Col>
      </Row>
      <Divider plain style={{ margin: '12px 0' }}>Quá trình hưởng đến hết {formatDate(denNgay)}</Divider>
      {lechGoiY && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          title={`Khác với gợi ý theo khai báo (${goiY.length ? goiY.map((q) => `${q.tyLe}% từ ${formatDate(q.thoiGianHuong)}`).join('; ') : 'chưa đủ 5 năm'})`}
          action={<Button size="small" icon={<SyncOutlined />} onClick={() => doi({ quaTrinh: goiY })}>Dùng gợi ý</Button>}
        />
      )}
      <Table<DongQuaTrinhPctn>
        size="small"
        bordered
        pagination={false}
        rowKey={(_, i) => String(i)}
        dataSource={k.quaTrinh}
        locale={{ emptyText: 'Chưa có - khai đủ thông tin hoặc bấm Thêm dòng' }}
        columns={[
          { title: 'Tỷ lệ (%)', key: 'tl', width: 110, render: (_, q, i) => <InputNumber size="small" min={5} max={100} value={q.tyLe} onChange={(v) => doiDong(i, { tyLe: v ?? 5 })} /> },
          { title: 'Mốc xét nâng thâm niên', key: 'mx', render: (_, q, i) => <DatePicker size="small" format="DD/MM/YYYY" value={d(q.mocXet)} onChange={(v) => doiDong(i, { mocXet: v?.format('YYYY-MM-DD') ?? '' })} /> },
          { title: 'Thời gian hưởng', key: 'th', render: (_, q, i) => <DatePicker size="small" format="DD/MM/YYYY" value={d(q.thoiGianHuong)} onChange={(v) => doiDong(i, { thoiGianHuong: v?.format('YYYY-MM-DD') ?? '' })} /> },
          { title: '', key: 'x', width: 44, render: (_, __, i) => <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => doi({ quaTrinh: k.quaTrinh.filter((_, j) => j !== i) })} /> },
        ]}
      />
      <Button size="small" icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={() => {
        const c = dongCuoi(k.quaTrinh)
        const moc = c ? dayjs(c.mocXet).add(1, 'year').format('YYYY-MM-DD') : du ?? dayjs().format('YYYY-MM-DD')
        doi({ quaTrinh: [...k.quaTrinh, { tyLe: c ? c.tyLe + 1 : 5, mocXet: moc, thoiGianHuong: moc }] })
      }}>Thêm dòng</Button>
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        Dòng cuối là mức đang hưởng: khi phê duyệt, hệ thống ghi phụ cấp thâm niên mức này và lấy mốc xét của dòng cuối làm mốc nâng thâm niên lần sau.
        Các dòng trước là thời gian truy lĩnh, ghi vào lịch sử và thông báo.
      </Text>
    </Modal>
  )
}
