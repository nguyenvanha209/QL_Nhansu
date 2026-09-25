import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Form, Input, Select, Button, Table, Space, InputNumber, DatePicker, Typography, Divider, Tag, App, Alert, Tooltip, Result } from 'antd'
import { DeleteOutlined, ArrowLeftOutlined, SendOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import type { ChiTietDeXuat, LoaiDeXuat } from '@/types/deXuat'
import { LOAI_DE_XUAT_LABELS, LOAI_CAN_MINH_CHUNG, NGHIEP_VU_LOAI, TEN_CHUC_NANG_DE_XUAT } from '@/types/deXuat'
import NoiDungDieuChinh from '@/components/NoiDungDieuChinh'
import { isDangCongTac, coPhuCapThamNien, nhanLuongTheoTien } from '@/types/vienChuc'
import { soSanhVienChuc, formatDate } from '@/utils/helpers'
import MinhChungField from '@/components/MinhChungField'
import type { MinhChung } from '@/lib/minhChung'

const { Title, Text } = Typography

// Phiếu nâng bậc (thường xuyên, trước hạn) phải lên bậc cao hơn; điều chỉnh, chuyển ngạch thì không bắt buộc
const LOAI_NANG_BAC: LoaiDeXuat[] = ['NANG_BAC', 'NANG_TRUOC_HAN']

export default function TaoDeXuatPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
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
  const phuCapVienChucs = useLuongStore((s) => s.phuCapVienChucs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const loaiPctn = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN')
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

  // ── Bảng lương theo ngạch ──
  const bangCua = (chucDanhId: string) => bacLuongs.filter((b) => b.chucDanhId === chucDanhId).sort((a, b) => a.bac - b.bac)
  const cdCua = (chucDanhId: string) => chucDanhs.find((c) => c.id === chucDanhId)
  const thoiGianNangBac = (chucDanhId: string, bac: number) => {
    const bang = bangCua(chucDanhId)
    return (bang.find((b) => b.bac === bac) ?? bang[0])?.thoiGianNangLuong ?? (/^[BC]/.test(cdCua(chucDanhId)?.bangLuong ?? '') ? 2 : 3)
  }
  const chucDanhOptions = useMemo(() => chucDanhs.filter((c) => c.active)
    .map((c) => ({ value: c.id, label: `${c.ma} — ${c.ten} (${c.bangLuong})` })), [chucDanhs])

  // Phiếu PCTN chỉ áp dụng cho CBQL và giáo viên (nhân viên không hưởng phụ cấp thâm niên);
  // hồ sơ cũ chưa gán VTVL thì xét theo nhóm ngạch/hạng đang xếp
  const duocHuongPctn = (v: { vtvl?: string; chucDanhId: string }) =>
    coPhuCapThamNien(v.vtvl, chucDanhs.find((c) => c.id === v.chucDanhId)?.nhom)

  const vcOptions = vienChucs
    .filter((v) => !selectedDonVi || v.donViId === selectedDonVi)
    .filter((v) => !laPctn || duocHuongPctn(v))
    .sort(soSanhVienChuc((v) => chucDanhs.find((c) => c.id === v.chucDanhId)?.nhom))
    .map((v) => ({ value: v.id, label: `${v.ho} ${v.ten}` }))

  const addVC = (vcId: string | undefined, ngayHieuLucOverride?: string) => {
    if (!vcId) return
    if (chiTiet.find((c) => c.vienChucId === vcId)) { message.warning('Viên chức đã có trong danh sách'); return }
    const vc = vienChucs.find((v) => v.id === vcId)
    const hsl = heSoLuongs.find((h) => h.vienChucId === vcId && h.isActive)
    if (!vc) return
    if (!hsl) { message.warning(`${vc.ho} ${vc.ten} chưa có bậc, hệ số lương — khai trong hồ sơ trước`); return }
    if (laPctn && !duocHuongPctn(vc)) {
      message.warning('Vị trí việc làm Nhân viên không hưởng phụ cấp thâm niên')
      return
    }
    const bang = bangCua(hsl.chucDanhId)
    const bacCuoi = bang.length ? bang[bang.length - 1].bac : undefined
    // Bậc cuối của bảng: không còn nâng bậc, chuyển sang xét PC thâm niên vượt khung
    if (!laPctn && LOAI_NANG_BAC.includes(loaiDeXuat) && bacCuoi !== undefined && hsl.bac >= bacCuoi) {
      message.warning(`${vc.ho} ${vc.ten} đã ở bậc cuối (${hsl.bac}/${bacCuoi}) của bảng ${cdCua(hsl.chucDanhId)?.bangLuong ?? ''} — không nâng bậc, xét phụ cấp thâm niên vượt khung`)
      return
    }
    const nextBac = LOAI_NANG_BAC.includes(loaiDeXuat) ? bang.find((b) => b.bac === hsl.bac + 1) : bang.find((b) => b.bac === hsl.bac)
    // PCTN đang hưởng (nếu có) để cán bộ đối chiếu khi nhập mức mới
    const pctnHienTai = loaiPctn
      ? phuCapVienChucs.find((p) => p.vienChucId === vcId && p.isActive && p.loaiPhuCapId === loaiPctn.id)?.giaTri ?? 0
      : 0
    // Phiếu PCTN: gợi ý mốc mới = mốc hưởng PCTN hiện tại + 1 năm, mức mới = mức cũ + 1% (chưa có thì 5%)
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
        : 'Đủ thời hạn nâng bậc thường xuyên',
      pctnCu: pctnHienTai,
      pctnMoi: laPctn ? (pctnHienTai > 0 ? pctnHienTai + 1 : 5) : pctnHienTai,
    }])
  }

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
      .filter((v) => !!v.mocHuongPctn && coPhuCapThamNien(v.vtvl, chucDanhs.find((c) => c.id === v.chucDanhId)?.nhom))
      .filter((v) => !chiTiet.some((c) => c.vienChucId === v.id))
      .map((v) => {
        const moc = dayjs(v.mocHuongPctn!)
        // Ngày kỷ niệm trong năm được chọn (cùng tháng/ngày, khác năm)
        const anniversaryStr = `${dotNam}-${moc.format('MM-DD')}`
        const pctnHienTai = loaiPctn
          ? phuCapVienChucs.find((p) => p.vienChucId === v.id && p.isActive && p.loaiPhuCapId === loaiPctn.id)?.giaTri ?? 0
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
      if (!r.ngayHieuLuc) loi.push(`${ten}: chưa có mốc hưởng`)
      if (loai === 'PHU_CAP_THAM_NIEN') return
      if (LOAI_NANG_BAC.includes(loai) && r.bacMoi <= r.bacCu && r.chucDanhMoiId === r.chucDanhCuId) loi.push(`${ten}: bậc mới phải cao hơn bậc ${r.bacCu}`)
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
  const detailCols = laPctn
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
          render: (_: any, r: ChiTietDeXuat, idx: number) => (
            <Select
              size="small"
              style={{ width: '100%' }}
              value={r.bacMoi}
              options={bangCua(r.chucDanhMoiId).map((b) => ({ value: b.bac, label: `Bậc ${b.bac} — ${b.heSo.toFixed(2)}` }))}
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
        {
          title: 'Mốc hưởng mới', key: 'nhl', width: 140,
          render: (_: any, r: ChiTietDeXuat, idx: number) => <DatePicker size="small" value={r.ngayHieuLuc ? dayjs(r.ngayHieuLuc) : null} format="DD/MM/YYYY" onChange={(d) => updateChiTiet(idx, { ngayHieuLuc: d?.format('YYYY-MM-DD') ?? '' })} />,
        },
        {
          title: 'Nâng bậc kế tiếp (dự kiến)', key: 'ke_tiep', width: 150,
          render: (_: any, r: ChiTietDeXuat) => {
            if (!r.ngayHieuLuc) return ''
            const bang = bangCua(r.chucDanhMoiId)
            const tg = thoiGianNangBac(r.chucDanhMoiId, r.bacMoi)
            const ngay = formatDate(dayjs(r.ngayHieuLuc).add(tg, 'year').format('YYYY-MM-DD'))
            const bacCuoi = bang.length && r.bacMoi >= bang[bang.length - 1].bac
            return bacCuoi
              ? <Tooltip title={`Bậc cuối — sau ${tg * 12} tháng được xét PC thâm niên vượt khung`}><Tag color="purple">Xét vượt khung {ngay}</Tag></Tooltip>
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
                  ? <><Text type="danger">bắt buộc</Text> — {NGHIEP_VU_LOAI[loaiDeXuat].minhChung} (PDF/JPG/PNG, tối đa 3 MB mỗi file)</>
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
            getCheckboxProps: (r) => ({ disabled: r.daBacCuoi }),
          }}
          locale={{ emptyText: 'Không có viên chức nào đến kỳ nâng lương trong đợt này' }}
          columns={[
            { title: 'Viên chức', dataIndex: 'hoTen', key: 'ht' },
            {
              title: 'Bậc/Hệ số hiện tại', key: 'bh', width: 200,
              render: (_: any, r: any) => <>Bậc {r.bac} — {r.heSo}{r.daBacCuoi && <Tag color="purple" style={{ marginLeft: 6 }}>Bậc cuối — xét vượt khung</Tag>}</>,
            },
            { title: 'Ngày nâng lương tiếp theo', dataIndex: 'ngayNangLuongTiepTheo', key: 'nnt', width: 160, render: (v: string) => <Tag color="blue">{formatDate(v)}</Tag> },
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
          {laPctn && <Text type="secondary">Chỉ CBQL và giáo viên (nhân viên không hưởng PCTN)</Text>}

        </Space>

        <Table dataSource={chiTiet} columns={detailCols} rowKey="vienChucId" size="small" pagination={false} scroll={{ x: laPctn ? 900 : (canMinhChung ? 1780 : 1590) }} style={{ marginBottom: 16 }} />

        <Space>
          <Button htmlType="submit">Lưu bản nháp</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => form.validateFields().then((v) => onFinish(v, true))}>
            {dxSua?.trangThai === 'YEU_CAU_BO_SUNG' ? 'Lưu & Trình lại' : 'Lưu & Nộp ngay'}
          </Button>
        </Space>
      </Form>
    </Card>
  )
}
