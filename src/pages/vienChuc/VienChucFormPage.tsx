import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Form, Input, Select, DatePicker, Button, Row, Col,
  Space, Typography, Divider, InputNumber, Alert, App, Tag, Switch,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import { LOAI_LAO_DONG_LABELS, LOAI_LAO_DONG_DANG_DUNG, LOAI_LAO_DONG_OPTIONS, TRANG_THAI_CONG_TAC_LABELS, NGUON_KINH_PHI_LABELS, HINH_THUC_LUONG_LABELS, coPhuCapThamNien, laVienChucBienChe, nhanLuongTheoTien } from '@/types/vienChuc'
import { chucDanhHopLeVoiVtvl } from '@/utils/vtvlRules'
import type { ChucVu, LoaiLaoDong, HinhThucLuong } from '@/types/vienChuc'
import { getHangTruong, getPhuCapChucVuHeSo, HANG_TRUONG_LABELS } from '@/utils/hangTruong'
import type { LoaiDonVi } from '@/types/donVi'
import { splitHoTen, toUpperName } from '@/utils/helpers'
import { sapXepLoaiPhuCap } from '@/utils/phuCapThuTu'
import { CONG_VIEC, NHOM_VI_TRI } from '@/utils/nhomViTri'
import { MON_GIANG_DAY, laCapHoc } from '@/utils/dinhMuc'
import { chonBanDangHuong, hoPhuCap, nhomTheoLoai } from '@/utils/phuCapDangHuong'
import { ngayHopLe, tinhNgayNangTiep } from '@/utils/nangLuong'
import type { PhuCapVienChuc } from '@/types/luong'
import { tinhNgayHetBaoLuu, tenHienThiLoaiPhuCap, TEN_PCCV_BAO_LUU, TEN_HS_CHENH_LECH_BAO_LUU } from '@/utils/baoLuuPccv'
import { lamMoiNgay } from '@/lib/supabase'
import { formatDate } from '@/utils/helpers'

const { Title, Text } = Typography

const KHONG_CHUC_VU = ''
const CHUC_VU_QUAN_LY = ['HT', 'P.HT']

function PhuCapGiaTriInput({ value, onChange, fieldName }: { value?: number; onChange?: (v: number | null) => void; fieldName: number }) {
  const form = Form.useFormInstance()
  const loaiPhuCapId = Form.useWatch(['phuCaps', fieldName, 'loaiPhuCapId'], form)
  const loaiPhuCaps = useDanhMucStore.getState().loaiPhuCaps
  const selected = loaiPhuCaps.find((p) => p.id === loaiPhuCapId)
  const suffix = selected?.loaiCongThuc === 'TIEN_MAT' ? 'đ' : selected?.loaiCongThuc === 'HE_SO' ? 'hệ số' : '%'
  return (
    <Space.Compact style={{ width: '100%' }}>
      <InputNumber
        value={value}
        onChange={onChange}
        style={{ width: '100%' }}
        placeholder={selected?.loaiCongThuc === 'HE_SO' ? 'VD 0,33' : 'Giá trị'}
        min={0}
        step={selected?.loaiCongThuc === 'HE_SO' ? 0.01 : 1}
      />
      <Button disabled style={{ pointerEvents: 'none' }}>{suffix}</Button>
    </Space.Compact>
  )
}

export default function VienChucFormPage() {
  const { message } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { currentUser, scopeDonViId, isCBTruong } = useAuth()
  const { getById, addVienChuc, updateVienChuc } = useVienChucStore()
  const { donVis, chucDanhs, bacLuongs, loaiPhuCaps, vtvls, chucVus, getBacLuongsForChucDanh } = useDanhMucStore.getState()
  const luongState = useLuongStore.getState()

  const vc = isEdit ? getById(id) : undefined
  const donViOptions = (scopeDonViId
    ? donVis.filter((d) => d.id === scopeDonViId)
    : donVis.filter((d) => d.active)
  ).map((d) => ({ value: d.id, label: d.ten }))

  const watchVtvl = Form.useWatch('vtvl', form) as string | undefined
  const watchChucDanhIdRaw = Form.useWatch('chucDanhId', form) as string | undefined
  const duocHuongPctn = coPhuCapThamNien(watchVtvl, chucDanhs.find((c) => c.id === watchChucDanhIdRaw)?.nhom)

  // Ngạch/hạng lọc theo VTVL; ngạch đang gán của hồ sơ cũ luôn được giữ lại để không mất dữ liệu
  const chucDanhOptions = chucDanhs
    .filter((c) => c.active)
    .filter((c) => chucDanhHopLeVoiVtvl(c.nhom, watchVtvl) || c.id === watchChucDanhIdRaw)
    .map((c) => ({
      value: c.id,
      label: chucDanhHopLeVoiVtvl(c.nhom, watchVtvl)
        ? `${c.ma} — ${c.ten}`
        : `${c.ma} — ${c.ten} (không thuộc VTVL đang chọn)`,
    }))

  const phuCapOptions = sapXepLoaiPhuCap(loaiPhuCaps.filter((pc) => pc.active))
    .filter((pc) => duocHuongPctn || pc.ma !== 'PC_THAM_NIEN')
    .map((pc) => ({ value: pc.id, label: `${pc.ma} — ${tenHienThiLoaiPhuCap(pc)}` }))

  // Chỉ các loại hình đang dùng; hồ sơ cũ mang loại đã bỏ (HĐ 111, tập sự) vẫn hiện đúng khi sửa
  const loaiLaoDongOptions = vc && !LOAI_LAO_DONG_DANG_DUNG.includes(vc.loaiLaoDong)
    ? [...LOAI_LAO_DONG_OPTIONS, { value: vc.loaiLaoDong, label: LOAI_LAO_DONG_LABELS[vc.loaiLaoDong] }]
    : LOAI_LAO_DONG_OPTIONS

  const vtvlOptions = vtvls.filter((v) => v.active).map((v) => ({ value: v.ma, label: v.ten }))
  // Có lựa chọn rõ ràng "Không giữ chức vụ" — trước đây chỉ bỏ được bằng nút ✕ nhỏ, khó thấy khi chuyển Phó HT về giáo viên
  const chucVuOptions = [
    { value: KHONG_CHUC_VU, label: 'Không giữ chức vụ (giáo viên, nhân viên)' },
    ...chucVus.filter((c) => c.active).map((c) => ({ value: c.ma, label: c.ten })),
  ]

  const watchChucDanhId = Form.useWatch('chucDanhId', form)
  const bacLuongOptions = useMemo(() => {
    if (!watchChucDanhId) return []
    return getBacLuongsForChucDanh(watchChucDanhId).map((b) => ({
      value: b.id,
      label: `Bậc ${b.bac} — Hệ số ${b.heSo.toFixed(2)}`,
    }))
  }, [watchChucDanhId])

  const watchDonViId = Form.useWatch('donViId', form)
  const watchChucVu = Form.useWatch('chucVu', form)
  // Tài khoản trường không có ô Đơn vị → lấy trường của tài khoản
  const loaiTruongForm = donVis.find((d) => d.id === (watchDonViId ?? scopeDonViId ?? vc?.donViId))?.loai
  const monOptions = laCapHoc(loaiTruongForm) ? MON_GIANG_DAY[loaiTruongForm].map((m) => ({ value: m.ma, label: m.ten })) : []
  const pccvInfo = useMemo(() => {
    if (!watchDonViId || !watchChucVu) return null
    const dv = donVis.find((d) => d.id === watchDonViId)
    if (!dv || !dv.soLop || dv.loai === 'OTHER') return null
    const hang = getHangTruong(dv.loai as LoaiDonVi, dv.soLop)
    const heSo = getPhuCapChucVuHeSo(dv.loai as LoaiDonVi, hang, watchChucVu as ChucVu)
    return { hang, heSo, loai: dv.loai }
  }, [watchDonViId, watchChucVu, donVis])

  // ── Bảo lưu phụ cấp chức vụ khi sắp xếp (NĐ 178/2024, NĐ 67/2025) ──
  const pcChucVuId = loaiPhuCaps.find((p) => p.ma === 'PC_CHUC_VU')?.id
  // Hệ số PCCV đang hưởng theo chức vụ cũ, lấy lúc mở hồ sơ (trước khi sửa)
  const pccvDangHuong = useMemo(
    () => (isEdit && pcChucVuId ? chonBanDangHuong(luongState.getActivePhuCaps(id!).filter((p) => p.loaiPhuCapId === pcChucVuId))?.giaTri ?? 0 : 0),
    [isEdit, id, pcChucVuId],
  )
  const pccvTheoChucVuMoi = watchChucVu ? (pccvInfo?.heSo ?? 0) : 0
  const doiChucVu = isEdit && (vc?.chucVu ?? '') !== (watchChucVu ?? '')
  const giamPccv = doiChucVu && pccvDangHuong > pccvTheoChucVuMoi
  const hienBaoLuu = giamPccv || !!vc?.baoLuuPccv
  const watchBlBat = Form.useWatch('blBat', form) as boolean | undefined
  const watchBlNgayQd = Form.useWatch('blNgayQd', form)
  const watchBlHetHan = Form.useWatch('blHetHan', form)
  const blDenNgay = watchBlNgayQd && watchBlHetHan
    ? tinhNgayHetBaoLuu(watchBlNgayQd.format('YYYY-MM-DD'), watchBlHetHan.format('YYYY-MM-DD'))
    : undefined
  const tenChucVu = (ma?: string) => (ma ? chucVus.find((c) => c.ma === ma)?.ten ?? ma : 'Không')

  // Bỏ hẳn chức vụ → gỡ dòng PC chức vụ (trước đây dòng này bị bỏ quên, hưởng mãi không hết).
  // Nếu được bảo lưu thì phần bảo lưu nằm riêng ở mục Bảo lưu PCCV.
  useEffect(() => {
    if (!isEdit || !vc?.chucVu || watchChucVu || !pcChucVuId) return
    const current: any[] = form.getFieldValue('phuCaps') || []
    if (!current.some((pc) => pc?.loaiPhuCapId === pcChucVuId)) return
    form.setFieldValue('phuCaps', current.filter((pc) => pc?.loaiPhuCapId !== pcChucVuId))
  }, [watchChucVu, pcChucVuId])

  useEffect(() => {
    if (!pccvInfo || pccvInfo.heSo <= 0) return
    const pcChucVu = loaiPhuCaps.find((p) => p.ma === 'PC_CHUC_VU')
    if (!pcChucVu) return
    const current: any[] = form.getFieldValue('phuCaps') || []
    const idx = current.findIndex((pc) => pc?.loaiPhuCapId === pcChucVu.id)
    if (idx >= 0) {
      if (current[idx].giaTri === pccvInfo.heSo) return
      const updated = [...current]
      // Mức mới tính từ hôm nay, không mang theo ngày hiệu lực của mức cũ
      updated[idx] = { ...updated[idx], giaTri: pccvInfo.heSo, ngayHieuLuc: dayjs() }
      form.setFieldValue('phuCaps', updated)
    } else {
      form.setFieldValue('phuCaps', [...current, { loaiPhuCapId: pcChucVu.id, giaTri: pccvInfo.heSo, ngayHieuLuc: dayjs() }])
    }
  }, [pccvInfo, loaiPhuCaps])

  // Nhân viên không hưởng PC thâm niên → gỡ dòng phụ cấp này nếu đang có
  const watchPhuCaps = Form.useWatch('phuCaps', form) as { loaiPhuCapId?: string }[] | undefined
  useEffect(() => {
    if (duocHuongPctn) return
    const pcThamNien = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN')
    if (!pcThamNien) return
    const current: any[] = form.getFieldValue('phuCaps') || []
    if (!current.some((pc) => pc?.loaiPhuCapId === pcThamNien.id)) return
    form.setFieldValue('phuCaps', current.filter((pc) => pc?.loaiPhuCapId !== pcThamNien.id))
    message.warning('Vị trí việc làm Nhân viên không hưởng phụ cấp thâm niên — đã gỡ dòng PC Thâm niên nghề')
  }, [duocHuongPctn, watchPhuCaps, loaiPhuCaps])

  const watchBacLuongId = Form.useWatch('bacLuongId', form)
  const watchMocHuongLuong = Form.useWatch('mocHuongLuong', form)
  const selectedBac = useMemo(() => bacLuongs.find((b) => b.id === watchBacLuongId), [watchBacLuongId])
  const watchLoaiLaoDong = Form.useWatch('loaiLaoDong', form) as LoaiLaoDong | undefined
  // Viên chức biên chế: bắt buộc khai mã ngạch, nguồn kinh phí, ngày vào biên chế, bậc lương.
  // Các loại hình hợp đồng: mã ngạch, bậc lương không bắt buộc; không có nguồn kinh phí / ngày biên chế.
  const laBienChe = watchLoaiLaoDong === 'VIEN_CHUC'
  const watchTrangThai = Form.useWatch('trangThai', form) as string | undefined
  const watchHinhThucLuong = Form.useWatch('hinhThucLuong', form) as HinhThucLuong | undefined
  // Hợp đồng nhận lương theo mức tiền → không khai bậc lương, hệ số
  const luongTheoTien = !laBienChe && watchHinhThucLuong === 'TIEN'
  const nhanBienChe = (text: string) => (
    <Space size={6}>
      {text}
      {laBienChe && <Tag color="blue" style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '16px' }}>VC biên chế</Tag>}
    </Space>
  )

  // Tải bản mới nhất từ máy chủ rồi mới điền biểu mẫu: điền từ dữ liệu cũ trên máy rồi lưu lại
  // từng sinh bản phụ cấp trùng (giá trị cũ đè lên bản mới của người khác)
  const [sanSang, setSanSang] = useState(!isEdit)
  const daDien = useRef(false)
  const [pcTrung, setPcTrung] = useState<PhuCapVienChuc[][]>([])
  // Bản phụ cấp đang hưởng lúc mở biểu mẫu: khi lưu chỉ được đóng những bản này,
  // không đụng tới bản người khác thêm trong lúc biểu mẫu đang mở
  const pcLucMo = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!isEdit) return
    let huy = false
    lamMoiNgay().finally(() => { if (!huy) setSanSang(true) })
    return () => { huy = true }
  }, [])

  useEffect(() => {
    if (!vc || !sanSang || daDien.current) return
    daDien.current = true
    form.setFieldsValue({
      ...vc,
      hoTenFull: `${vc.ho} ${vc.ten}`.trim(),
      hinhThucLuong: vc.hinhThucLuong ?? 'HE_SO',
      trangThai: vc.trangThai ?? 'DANG_LAM_VIEC',
      ngaySinh: dayjs(vc.ngaySinh),
      ngayVaoNganh: dayjs(vc.ngayVaoNganh),
      ngayVaoDonVi: dayjs(vc.ngayVaoDonVi),
      ngayHetTapSu: vc.ngayHetTapSu ? dayjs(vc.ngayHetTapSu) : undefined,
      ngayVaoBienChe: vc.ngayVaoBienChe ? dayjs(vc.ngayVaoBienChe) : undefined,
      mocHuongPctn: vc.mocHuongPctn ? dayjs(vc.mocHuongPctn) : undefined,
      ngayChuyenDi: vc.ngayChuyenDi ? dayjs(vc.ngayChuyenDi) : undefined,
      blBat: !!vc.baoLuuPccv,
      blSoQd: vc.baoLuuPccv?.soQuyetDinh,
      blNgayQd: vc.baoLuuPccv ? dayjs(vc.baoLuuPccv.ngayQuyetDinh) : undefined,
      blHetHan: vc.baoLuuPccv ? dayjs(vc.baoLuuPccv.ngayHetHanBoNhiem) : undefined,
    })
    const heSo = luongState.getActiveHeSo(id!)
    if (heSo) {
      const bac = bacLuongs.find((b) => b.chucDanhId === heSo.chucDanhId && b.bac === heSo.bac)
      if (bac) form.setFieldValue('bacLuongId', bac.id)
      // Mốc lỗi (trống, năm 0205…) thì để trống cho người dùng nhập lại thay vì hiện ngày vô nghĩa
      form.setFieldValue('mocHuongLuong', ngayHopLe(heSo.ngayHieuLuc) ? dayjs(heSo.ngayHieuLuc) : undefined)
    }
    // Mỗi loại phụ cấp một dòng (bản đang hưởng); bản trùng được báo riêng và đóng khi lưu
    const dangHuongLucMo = luongState.getActivePhuCaps(id!)
    pcLucMo.current = new Set(dangHuongLucMo.map((p) => p.id))
    const theoLoai = [...nhomTheoLoai(dangHuongLucMo, loaiPhuCaps).values()]
    setPcTrung(theoLoai.filter((a) => a.length > 1))
    form.setFieldValue('phuCaps', theoLoai.map((a) => {
      const pc = chonBanDangHuong(a)!
      return { id: pc.id, loaiPhuCapId: pc.loaiPhuCapId, giaTri: pc.giaTri, ngayHieuLuc: pc.ngayHieuLuc ? dayjs(pc.ngayHieuLuc) : undefined }
    }))
  }, [vc, sanSang])

  const pcBaoLuuId = loaiPhuCaps.find((l) => l.ma === 'PC_BAO_LUU')?.id
  // Mức PC chức vụ bảo lưu (sau sắp xếp) đang khai trên biểu mẫu, để phát hiện khai nhầm sang hệ số chênh lệch
  const heSoBaoLuuDangGhi: number | undefined = watchBlBat ? (vc?.baoLuuPccv?.heSo ?? (pccvDangHuong || undefined)) : undefined
  const tenLoaiPc = (loaiId: string) => tenHienThiLoaiPhuCap(loaiPhuCaps.find((l) => l.id === loaiId)) || loaiId
  const mucPc = (p: Pick<PhuCapVienChuc, 'loaiPhuCapId' | 'giaTri'>) => {
    const l = loaiPhuCaps.find((x) => x.id === p.loaiPhuCapId)
    return l?.loaiCongThuc === 'HE_SO' ? String(p.giaTri).replace('.', ',') : l?.loaiCongThuc === 'TIEN_MAT' ? `${p.giaTri.toLocaleString('vi-VN')}đ` : `${p.giaTri}%`
  }

  /**
   * Chỉ ghi dòng phụ cấp thực sự thay đổi. Dòng giữ nguyên mức thì giữ nguyên bản ghi và ngày hiệu lực;
   * đổi mức thì ghi bản mới từ ngày chọn (store tự đóng bản cũ cùng loại); bản đã hiện lúc mở biểu mẫu
   * mà nay không còn (dòng bị xoá, bản trùng) thì đóng lại.
   */
  const ghiPhuCap = (vcId: string, rows: any[], macDinhNgay: string, mocPctn?: string) => {
    const pcGoc = luongState.getActivePhuCaps(vcId)
    const giuLai = new Set<string>()
    for (const pc of rows) {
      if (!pc?.loaiPhuCapId) continue
      const giaTri = pc.giaTri || 0
      const ngay: string | undefined = pc.ngayHieuLuc ? dayjs(pc.ngayHieuLuc).format('YYYY-MM-DD') : undefined
      const goc = pc.id ? pcGoc.find((p) => p.id === pc.id) : undefined
      if (goc && goc.loaiPhuCapId === pc.loaiPhuCapId && goc.giaTri === giaTri) {
        if (ngay && ngay !== goc.ngayHieuLuc) luongState.updatePhuCap(goc.id, { ngayHieuLuc: ngay })
        giuLai.add(goc.id)
        continue
      }
      const chonNgayMoi = !!ngay && (!goc || ngay !== goc.ngayHieuLuc)
      const laPctn = loaiPhuCaps.find((l) => l.id === pc.loaiPhuCapId)?.ma === 'PC_THAM_NIEN'
      const moi = luongState.addPhuCap({
        vienChucId: vcId,
        loaiPhuCapId: pc.loaiPhuCapId,
        giaTri,
        ngayHieuLuc: chonNgayMoi ? ngay! : (laPctn && mocPctn) || macDinhNgay,
        isActive: true,
        createdBy: currentUser?.id ?? 'system',
      })
      giuLai.add(moi.id)
    }
    for (const p of luongState.getActivePhuCaps(vcId)) {
      if (!giuLai.has(p.id) && pcLucMo.current.has(p.id)) luongState.deactivatePhuCap(p.id)
    }
  }

  const onFinish = async (values: any) => {
    // Tải bản mới nhất trước khi ghi hồ sơ, lương, phụ cấp — tránh đè sửa đổi của người khác
    await lamMoiNgay()
    const { hoTenFull, mocHuongLuong, blBat, blSoQd, blNgayQd, blHetHan, ...restValues } = values
    // Bảo lưu PCCV: giữ mức và chức vụ cũ đã ghi (nếu có), bảo lưu mới thì lấy mức đang hưởng trước khi đổi
    const baoLuuPccv = blBat && blNgayQd && blHetHan
      ? {
          chucVuCu: vc?.baoLuuPccv?.chucVuCu ?? vc?.chucVu ?? '',
          heSo: vc?.baoLuuPccv?.heSo ?? pccvDangHuong,
          soQuyetDinh: String(blSoQd ?? '').trim(),
          ngayQuyetDinh: blNgayQd.format('YYYY-MM-DD'),
          ngayHetHanBoNhiem: blHetHan.format('YYYY-MM-DD'),
          denNgay: tinhNgayHetBaoLuu(blNgayQd.format('YYYY-MM-DD'), blHetHan.format('YYYY-MM-DD')),
        }
      : undefined
    const { ho, ten } = splitHoTen(toUpperName(hoTenFull))
    const formatted = {
      ...restValues,
      // Tài khoản trường không thấy ô Đơn vị (ô bị ẩn nên không gửi giá trị) → luôn gán trường của tài khoản,
      // nếu không hồ sơ mới sẽ không thuộc trường nào và không lên bảng lương, báo cáo
      donViId: restValues.donViId ?? scopeDonViId ?? vc?.donViId,
      ho,
      ten,
      ngaySinh: values.ngaySinh?.format('YYYY-MM-DD'),
      ngayVaoNganh: values.ngayVaoNganh?.format('YYYY-MM-DD'),
      ngayVaoDonVi: values.ngayVaoDonVi?.format('YYYY-MM-DD'),
      ngayHetTapSu: values.ngayHetTapSu?.format('YYYY-MM-DD'),
      ngayVaoBienChe: values.ngayVaoBienChe?.format('YYYY-MM-DD'),
      mocHuongPctn: values.mocHuongPctn?.format('YYYY-MM-DD'),
      ngayChuyenDi: values.trangThai === 'CHUYEN_DI' ? values.ngayChuyenDi?.format('YYYY-MM-DD') : undefined,
      baoLuuPccv,
    }
    if (formatted.loaiLaoDong !== 'VIEN_CHUC') formatted.nguonKinhPhi = undefined
    // Trừ viên chức biên chế (theo ngạch, bậc), mọi loại hình được chọn lương theo mức tiền
    const theoTien = nhanLuongTheoTien(formatted)
    if (laVienChucBienChe(formatted.loaiLaoDong)) formatted.hinhThucLuong = undefined
    if (!theoTien) formatted.mucLuongTien = undefined
    // Lương theo tiền: không ghi bậc lương / hệ số mới
    if (theoTien) formatted.bacLuongId = undefined
    const nhomNgach = chucDanhs.find((c) => c.id === formatted.chucDanhId)?.nhom
    const huongPctn = coPhuCapThamNien(formatted.vtvl, nhomNgach)
    // Nhân viên không hưởng phụ cấp thâm niên → không giữ mốc PCTN
    if (!huongPctn) formatted.mocHuongPctn = undefined
    if (formatted.vtvl !== 'NHAN_VIEN') formatted.congViec = undefined
    if (formatted.vtvl !== 'GIAO_VIEN') formatted.monDay = undefined
    if (formatted.chucVu === KHONG_CHUC_VU) formatted.chucVu = undefined
    const { bacLuongId, phuCaps: phuCapsRaw, ...vcData } = formatted
    // Chốt chặn cuối: không ghi PC thâm niên cho vị trí không được hưởng
    const pcThamNienId = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN')?.id
    const phuCaps = huongPctn
      ? phuCapsRaw
      : (phuCapsRaw || []).filter((pc: any) => pc?.loaiPhuCapId !== pcThamNienId)
    const mocHuongLuongStr: string | undefined = mocHuongLuong?.format('YYYY-MM-DD')

    // Mỗi loại phụ cấp chỉ một dòng (các mức ưu đãi tính là một loại)
    const daCo = new Map<string, string>()
    for (const pc of phuCaps || []) {
      if (!pc?.loaiPhuCapId) continue
      const k = hoPhuCap(pc.loaiPhuCapId, loaiPhuCaps)
      if (daCo.has(k)) {
        message.error(`Phụ cấp "${daCo.get(k)}" có hai dòng — mỗi loại chỉ giữ một dòng (đổi mức thì sửa dòng đang có)`)
        return
      }
      daCo.set(k, tenLoaiPc(pc.loaiPhuCapId))
    }

    if (isEdit && vc) {
      updateVienChuc(id!, vcData, currentUser?.id, currentUser?.fullName)

      // Ghi lịch sử khi bắt đầu, thay đổi hoặc bỏ bảo lưu PCCV
      const blCu = vc.baoLuuPccv
      if (JSON.stringify(blCu ?? null) !== JSON.stringify(baoLuuPccv ?? null)) {
        luongState.addLichSuBienDong({
          vienChucId: id!,
          loai: 'PHU_CAP',
          truongThayDoi: 'Bảo lưu phụ cấp chức vụ',
          giaTriCu: blCu ? `${tenChucVu(blCu.chucVuCu)} ${blCu.heSo} đến ${formatDate(blCu.denNgay)}` : 'Không',
          giaTriMoi: baoLuuPccv
            ? `${tenChucVu(baoLuuPccv.chucVuCu)} ${baoLuuPccv.heSo} đến ${formatDate(baoLuuPccv.denNgay)} (QĐ ${baoLuuPccv.soQuyetDinh})`
            : 'Không bảo lưu',
          ngayThayDoi: baoLuuPccv?.ngayQuyetDinh ?? dayjs().format('YYYY-MM-DD'),
          nguoiThayDoiId: currentUser?.id ?? 'system',
        })
      }

      // Chuyển sang lương theo mức tiền → đóng bản ghi hệ số đang áp dụng (vẫn giữ trong lịch sử lương)
      if (theoTien) {
        const heSoDangCo = luongState.getActiveHeSo(id)
        if (heSoDangCo) luongState.deactivateHeSoLuong(heSoDangCo.id)
      }

      const selectedBacLuong = bacLuongs.find((b) => b.id === bacLuongId)
      const currentHeSo = luongState.getActiveHeSo(id)
      if (
        selectedBacLuong &&
        (!currentHeSo || currentHeSo.bac !== selectedBacLuong.bac || currentHeSo.chucDanhId !== values.chucDanhId)
      ) {
        if (currentHeSo) luongState.deactivateHeSoLuong(currentHeSo.id)
        const ngayHieuLuc = mocHuongLuongStr || dayjs().format('YYYY-MM-DD')
        const ngayTiepTheo = dayjs(ngayHieuLuc).add(selectedBacLuong.thoiGianNangLuong, 'year').format('YYYY-MM-DD')
        const newHeSo = luongState.addHeSoLuong({
          vienChucId: id!,
          chucDanhId: values.chucDanhId,
          bac: selectedBacLuong.bac,
          heSo: selectedBacLuong.heSo,
          ngayHieuLuc,
          ngayNangLuongTiepTheo: ngayTiepTheo,
          lyDo: 'DIEU_CHINH',
          isActive: true,
          createdBy: currentUser?.id ?? 'system',
        })
        updateVienChuc(id!, { heSoLuongHienTaiId: newHeSo.id })
      } else if (selectedBacLuong && currentHeSo && mocHuongLuongStr) {
        // Giữ nguyên bậc, chỉ sửa mốc hưởng: trước đây thay đổi này bị bỏ qua, ngày nâng lương giữ nguyên giá trị sai.
        // Nay ghi mốc mới vào bản lương đang áp dụng và tính lại ngày nâng lương tiếp theo.
        const nangTiep = tinhNgayNangTiep(mocHuongLuongStr, currentHeSo.chucDanhId, currentHeSo.bac, bacLuongs, chucDanhs)
        if (nangTiep && (mocHuongLuongStr !== currentHeSo.ngayHieuLuc || nangTiep !== currentHeSo.ngayNangLuongTiepTheo)) {
          luongState.updateHeSoLuong(currentHeSo.id, { ngayHieuLuc: mocHuongLuongStr, ngayNangLuongTiepTheo: nangTiep })
          luongState.addLichSuBienDong({
            vienChucId: id!,
            loai: 'LUONG',
            truongThayDoi: 'Mốc hưởng lương',
            giaTriCu: `${formatDate(currentHeSo.ngayHieuLuc) || '(trống)'} — nâng lương tiếp ${formatDate(currentHeSo.ngayNangLuongTiepTheo) || '(trống)'}`,
            giaTriMoi: `${formatDate(mocHuongLuongStr)} — nâng lương tiếp ${formatDate(nangTiep)}`,
            ngayThayDoi: dayjs().format('YYYY-MM-DD'),
            nguoiThayDoiId: currentUser?.id ?? 'system',
          })
        }
      }

      ghiPhuCap(id!, phuCaps || [], dayjs().format('YYYY-MM-DD'), vcData.mocHuongPctn)

      message.success('Cập nhật thành công')
      navigate(`/vien-chuc/${id}`)
    } else {
      const selectedBacLuong = bacLuongs.find((b) => b.id === bacLuongId)
      const newVc = addVienChuc({ ...vcData, active: true }, currentUser?.id, currentUser?.fullName)

      if (selectedBacLuong) {
        const ngayHieuLuc = mocHuongLuongStr || vcData.ngayVaoNganh || dayjs().format('YYYY-MM-DD')
        const ngayTiepTheo = dayjs(ngayHieuLuc).add(selectedBacLuong.thoiGianNangLuong, 'year').format('YYYY-MM-DD')
        const newHeSo = luongState.addHeSoLuong({
          vienChucId: newVc.id,
          chucDanhId: values.chucDanhId,
          bac: selectedBacLuong.bac,
          heSo: selectedBacLuong.heSo,
          ngayHieuLuc,
          ngayNangLuongTiepTheo: ngayTiepTheo,
          lyDo: 'TUYEN_DUNG',
          isActive: true,
          createdBy: currentUser?.id ?? 'system',
        })
        updateVienChuc(newVc.id, { heSoLuongHienTaiId: newHeSo.id })
      }

      ghiPhuCap(newVc.id, phuCaps || [], vcData.ngayVaoDonVi || dayjs().format('YYYY-MM-DD'), vcData.mocHuongPctn)

      message.success('Thêm hồ sơ nhân sự thành công')
      navigate(`/vien-chuc/${newVc.id}`)
    }
  }

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? `/vien-chuc/${id}` : '/vien-chuc')}>
          Quay lại
        </Button>
      </Space>
      <Title level={4}>{isEdit ? 'Chỉnh sửa hồ sơ' : 'Thêm hồ sơ nhân sự mới'}</Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ gioiTinh: 'NU', loaiLaoDong: 'VIEN_CHUC', hinhThucLuong: 'HE_SO', phuCaps: [], trangThai: 'DANG_LAM_VIEC', laDangVien: false, mocHuongLuong: dayjs(), donViId: scopeDonViId ?? undefined }}
      >
        {/* ── Thông tin cá nhân ── */}
        <Divider titlePlacement="left">Thông tin cá nhân</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="hoTenFull"
              label="Họ và tên"
              rules={[{ required: true, message: 'Nhập họ và tên' }]}
              getValueFromEvent={(e) => e.target.value.toLocaleUpperCase('vi')}
              extra="Họ tên luôn được lưu IN HOA"
            >
              <Input placeholder="VD: NGUYỄN THỊ HOA" style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="gioiTinh" label="Giới tính" rules={[{ required: true }]}>
              <Select options={[{ value: 'NAM', label: 'Nam' }, { value: 'NU', label: 'Nữ' }]} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="ngaySinh" label="Ngày sinh" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="cccd" label="Số CCCD">
              <Input placeholder="12 số" maxLength={12} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="dienThoai" label="Điện thoại">
              <Input placeholder="0xxxxxxxxx" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="laDangVien" label="Đảng viên">
              <Select options={[{ value: true, label: 'Có' }, { value: false, label: 'Không' }]} />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Thông tin công tác ── */}
        <Divider titlePlacement="left">Thông tin công tác</Divider>
        <Row gutter={16}>
          {!isCBTruong && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="donViId" label="Đơn vị công tác" rules={[{ required: true }]}>
                <Select options={donViOptions} placeholder="Chọn đơn vị" showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="loaiLaoDong" label="Loại hình lao động" rules={[{ required: true }]}>
              <Select
                options={loaiLaoDongOptions}
                onChange={(v: LoaiLaoDong) => {
                  // Chuyển sang hợp đồng → gỡ các lỗi "bắt buộc" còn sót của viên chức biên chế
                  if (v !== 'VIEN_CHUC') {
                    form.setFields([{ name: 'chucDanhId', errors: [] }, { name: 'bacLuongId', errors: [] }])
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="vtvl"
              label="VTVL (Vị trí việc làm)"
              rules={[{ required: true, message: 'Chọn VTVL' }]}
              tooltip="VTVL quyết định nhóm ngạch/hạng được chọn và quyền hưởng phụ cấp thâm niên"
            >
              <Select
                options={vtvlOptions}
                placeholder="Chọn VTVL"
                onChange={(v: string) => {
                  // Ngạch đang chọn không còn hợp lệ với VTVL mới → bỏ ngạch và bậc lương kèm theo
                  const dangChon = chucDanhs.find((c) => c.id === form.getFieldValue('chucDanhId'))
                  if (dangChon && !chucDanhHopLeVoiVtvl(dangChon.nhom, v)) {
                    form.setFieldsValue({ chucDanhId: undefined, bacLuongId: undefined })
                    message.info(`Ngạch "${dangChon.ma} — ${dangChon.ten}" không thuộc VTVL vừa chọn, vui lòng chọn lại ngạch/hạng`)
                  }
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="chucVu"
              label="Chức vụ"
              tooltip="Phó hiệu trưởng về làm giáo viên: chọn &quot;Không giữ chức vụ&quot;. Nếu do sắp xếp tổ chức bộ máy thì bật Bảo lưu phụ cấp chức vụ ở khung vàng bên dưới."
            >
              <Select
                options={chucVuOptions}
                placeholder="Không giữ chức vụ (giáo viên, nhân viên)"
                onChange={(v: string) => {
                  // Đồng bộ Vị trí việc làm với chức vụ quản lý
                  const vtvl = form.getFieldValue('vtvl')
                  if (CHUC_VU_QUAN_LY.includes(v) && vtvl !== 'CBQL') {
                    form.setFieldValue('vtvl', 'CBQL')
                    message.info('Đã chuyển Vị trí việc làm sang Cán bộ quản lý')
                  } else if (!CHUC_VU_QUAN_LY.includes(v) && vtvl === 'CBQL') {
                    form.setFieldValue('vtvl', 'GIAO_VIEN')
                    message.info('Không còn chức vụ quản lý — đã chuyển Vị trí việc làm sang Giáo viên, kiểm tra lại nếu cần')
                  }
                }}
              />
            </Form.Item>
          </Col>
          {watchVtvl === 'NHAN_VIEN' && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="congViec"
                label="Công việc cụ thể"
                rules={[{ required: true, message: 'Chọn công việc cụ thể' }]}
                tooltip="Căn cứ chia nhóm Nhân viên chuyên môn – hỗ trợ / phục vụ / nuôi dưỡng trên trang Tổng quan"
              >
                <Select
                  placeholder="Chọn công việc"
                  showSearch
                  optionFilterProp="label"
                  options={NHOM_VI_TRI.filter((n) => n.key.startsWith('NV_')).map((n) => ({
                    label: n.ten,
                    options: CONG_VIEC.filter((c) => c.nhom === n.key).map((c) => ({ value: c.key, label: c.ten })),
                  }))}
                />
              </Form.Item>
            </Col>
          )}
          {watchVtvl === 'GIAO_VIEN' && monOptions.length > 0 && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="monDay"
                label="Môn giảng dạy"
                tooltip="Căn cứ đối chiếu định mức giáo viên theo từng môn (TT 20/2023/TT-BGDĐT) ở trang Định mức viên chức và Cơ cấu VTVL"
              >
                <Select options={monOptions} placeholder="Chọn môn giảng dạy" allowClear showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="chucDanhId"
              label={nhanBienChe('Mã ngạch/Hạng')}
              rules={[{ required: laBienChe, message: 'Chọn mã ngạch/hạng' }]}
            >
              <Select
                options={chucDanhOptions}
                placeholder={laBienChe ? 'Chọn chức danh' : 'Không bắt buộc'}
                showSearch
                allowClear={!laBienChe}
                optionFilterProp="label"
                onChange={() => form.setFieldValue('bacLuongId', undefined)}
              />
            </Form.Item>
          </Col>
          {laBienChe && (
            <>
              <Col xs={24} sm={12} md={8}>
                <Form.Item name="nguonKinhPhi" label={nhanBienChe('Nguồn kinh phí')} rules={[{ required: true, message: 'Chọn nguồn kinh phí' }]}>
                  <Select options={Object.entries(NGUON_KINH_PHI_LABELS).map(([k, v]) => ({ value: k, label: v }))} placeholder="Chọn nguồn kinh phí" />
                </Form.Item>
              </Col>
            </>
          )}
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="trangThai"
              label="Trạng thái công tác"
              rules={[{ required: true }]}
              tooltip="Chuyển đi, Nghỉ hưu, Thôi việc: hồ sơ vẫn được giữ để tra cứu nhưng không tính vào bảng lương và báo cáo số liệu. Chuyển trong phường thì làm phiếu Chuyển công tác; chuyển ra ngoài tỉnh/phường thì đặt trạng thái Chuyển đi tại đây."
            >
              <Select options={Object.entries(TRANG_THAI_CONG_TAC_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            </Form.Item>
          </Col>
          {watchTrangThai === 'CHUYEN_DI' && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="ngayChuyenDi" label="Ngày chuyển đi" rules={[{ required: true, message: 'Chọn ngày chuyển đi' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
          {hienBaoLuu && (
            <Col xs={24}>
              <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <Space align="center" style={{ marginBottom: watchBlBat ? 10 : 0 }} wrap>
                  <Form.Item name="blBat" valuePropName="checked" noStyle>
                    <Switch size="small" />
                  </Form.Item>
                  <Text strong>{TEN_PCCV_BAO_LUU}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {vc?.baoLuuPccv
                      ? `Đang ghi: chức vụ cũ ${tenChucVu(vc.baoLuuPccv.chucVuCu)} — hệ số bảo lưu ${vc.baoLuuPccv.heSo}`
                      : `${tenChucVu(vc?.chucVu)} (hệ số ${pccvDangHuong}) → ${tenChucVu(watchChucVu)} (hệ số ${pccvTheoChucVuMoi})`}
                  </Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: watchBlBat ? 8 : 0 }}>
                  Mức PC chức vụ của chức vụ cũ được giữ sau sắp xếp tổ chức bộ máy, khai tại đây. Không khai vào dòng
                  "{TEN_HS_CHENH_LECH_BAO_LUU}" và không cộng vào dòng PC chức vụ hiện tại — dòng đó chỉ ghi mức theo chức vụ đang giữ.
                </Text>
                {watchBlBat && (
                  <Row gutter={16}>
                    <Col xs={24} sm={8}>
                      <Form.Item name="blSoQd" label="Số quyết định sắp xếp / bổ nhiệm mới" rules={[{ required: true, message: 'Nhập số quyết định' }]}>
                        <Input placeholder="VD: 123/QĐ-UBND" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item name="blNgayQd" label="Ngày quyết định (bắt đầu bảo lưu)" rules={[{ required: true, message: 'Chọn ngày' }]}>
                        <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="blHetHan"
                        label="Ngày hết hạn bổ nhiệm chức vụ cũ"
                        tooltip="Theo quyết định bổ nhiệm chức vụ cũ"
                        rules={[{ required: true, message: 'Chọn ngày' }]}
                      >
                        <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24}>
                      <Text style={{ fontSize: 12.5 }}>
                        {blDenNgay
                          ? <>Được hưởng nguyên PCCV cũ <b>đến hết {formatDate(blDenNgay)}</b>; sau đó hệ thống tự chuyển về mức theo chức vụ hiện tại.</>
                          : 'Nhập đủ hai ngày để hệ thống tính ngày hết bảo lưu.'}
                        <Text type="secondary" style={{ fontSize: 12 }}> Thời hạn còn lại dưới 6 tháng thì được bảo lưu 6 tháng (NĐ 178/2024, NĐ 67/2025).</Text>
                      </Text>
                    </Col>
                  </Row>
                )}
                {!watchBlBat && giamPccv && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
                    Phụ cấp chức vụ đang giảm. Bật mục này nếu việc thôi giữ / hạ chức vụ là do sắp xếp tổ chức bộ máy.
                  </Text>
                )}
              </div>
            </Col>
          )}
          {pccvInfo && (
            <Col xs={24}>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                title={`Đã tự động thêm PC Chức vụ (hệ số +${pccvInfo.heSo.toFixed(2)} — ${HANG_TRUONG_LABELS[pccvInfo.hang]}, TT 33/2005) vào tổng hệ số lương`}
              />
            </Col>
          )}
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="ngayVaoNganh" label="Ngày vào ngành" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="ngayVaoDonVi" label="Ngày vào đơn vị" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          {laBienChe && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="ngayVaoBienChe"
                label={nhanBienChe('Ngày vào biên chế')}
                rules={[{ required: true, message: 'Chọn ngày vào biên chế' }]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          )}
        </Row>
        {laBienChe ? (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Các ô gắn nhãn <Tag color="blue" style={{ fontSize: 11, lineHeight: '16px' }}>VC biên chế</Tag>
            là thông tin bắt buộc theo quy định đối với viên chức biên chế.
          </Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Loại hình hợp đồng: Mã ngạch/Hạng và Bậc lương không bắt buộc; có thể chọn nhận lương theo mức tiền ở phần Lương & Phụ cấp. Không khai nguồn kinh phí, ngày vào biên chế.
          </Text>
        )}

        {/* ── Trình độ & Nhiệm vụ ── */}
        <Divider titlePlacement="left">Trình độ & Nhiệm vụ</Divider>
        <Row gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="trinhDoChuyenMon" label="Trình độ chuyên môn nghiệp vụ">
              <Input placeholder="VD: Đại học Sư phạm Tiểu học" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="nhiemVuChinh" label="Nhiệm vụ chính">
              <Input placeholder="VD: Giảng dạy lớp 5A" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item name="trinhDoKhac" label="Trình độ khác">
              <Input placeholder="VD: Chuyên môn khác, tin học, ngoại ngữ, LLCT..." />
            </Form.Item>
          </Col>
        </Row>

        {/* ── Lương & Phụ cấp ── */}
        <Divider titlePlacement="left">Lương & Phụ cấp</Divider>
        <Row gutter={16}>
          {!laBienChe && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="hinhThucLuong"
                label="Hình thức nhận lương"
                tooltip="Loại hình hợp đồng có thể nhận lương theo bậc/hệ số, hoặc theo một mức tiền cố định mỗi tháng"
                rules={[{ required: true }]}
              >
                <Select options={Object.entries(HINH_THUC_LUONG_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
              </Form.Item>
            </Col>
          )}
          {luongTheoTien && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="mucLuongTien"
                label="Mức lương (VNĐ/tháng)"
                rules={[{ required: true, message: 'Nhập mức lương' }]}
              >
                <InputNumber<number>
                  min={0}
                  step={100000}
                  style={{ width: '100%' }}
                  placeholder="VD: 5.000.000"
                  formatter={(v) => (v == null || String(v) === '' ? '' : Number(v).toLocaleString('vi-VN'))}
                  parser={(v) => Number((v ?? '').replace(/\D/g, ''))}
                  suffix="đ"
                />
              </Form.Item>
            </Col>
          )}
          {!luongTheoTien && (<>
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="bacLuongId"
              label={nhanBienChe('Bậc lương')}
              rules={[{ required: laBienChe && !isEdit, message: 'Chọn bậc lương' }]}
            >
              <Select
                options={bacLuongOptions}
                placeholder={watchChucDanhId ? (laBienChe ? 'Chọn bậc lương' : 'Không bắt buộc') : 'Chọn chức danh trước'}
                disabled={!watchChucDanhId}
                allowClear={!laBienChe}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item label="Hệ số lương">
              <InputNumber
                value={selectedBac?.heSo}
                disabled
                style={{ width: '100%' }}
                precision={2}
                placeholder="Tự động theo bậc"
              />
            </Form.Item>
          </Col>
          {selectedBac && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Thời gian nâng bậc">
                <Input value={`${selectedBac.thoiGianNangLuong} năm / bậc`} disabled />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              name="mocHuongLuong"
              label="Mốc hưởng lương"
              tooltip="Ngày bắt đầu hưởng bậc lương hiện tại. Sửa mốc thì ngày nâng lương tiếp theo được tính lại khi lưu."
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn mốc hưởng lương" />
            </Form.Item>
          </Col>
          {selectedBac && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Ngày nâng lương tiếp theo" tooltip="Tự tính: mốc hưởng lương + thời gian nâng bậc của ngạch">
                <Input
                  disabled
                  value={watchMocHuongLuong ? dayjs(watchMocHuongLuong).add(selectedBac.thoiGianNangLuong, 'year').format('DD/MM/YYYY') : 'Nhập mốc hưởng lương'}
                />
              </Form.Item>
            </Col>
          )}
          </>)}
          {duocHuongPctn && (
            <Col xs={24} sm={12} md={8}>
              <Form.Item
                name="mocHuongPctn"
                label="Mốc hưởng PCTN"
                tooltip="Mốc hưởng phụ cấp thâm niên — căn cứ để trường đề xuất nâng 1%/năm ở kỳ sau (6 tháng đầu hoặc cuối năm). Chỉ áp dụng với CBQL và giáo viên."
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn mốc hưởng PCTN" />
              </Form.Item>
            </Col>
          )}
        </Row>
        {!duocHuongPctn && watchVtvl && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Vị trí việc làm Nhân viên không hưởng phụ cấp thâm niên nên không khai báo mốc hưởng PCTN.
          </Text>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text strong style={{ fontSize: 14 }}>Phụ cấp đang hưởng</Text>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                const current = form.getFieldValue('phuCaps') || []
                form.setFieldValue('phuCaps', [...current, { loaiPhuCapId: undefined, giaTri: 0, ngayHieuLuc: dayjs() }])
              }}
            >
              Thêm phụ cấp
            </Button>
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            PC Thâm niên nghề (CBQL, giáo viên) vẫn giữ nguyên, hưởng song song với PC ưu đãi nhà giáo.
            PC ưu đãi nhà giáo chọn theo cấp học (NĐ 182/2026): mầm non, tiểu học 45%; THCS 40%; nhân viên 20%.
            Mỗi loại phụ cấp một dòng. Dòng giữ nguyên mức thì giữ nguyên ngày hiệu lực; đổi mức thì ghi bản mới
            từ ngày ở ô "Từ ngày" (để nguyên thì tính từ hôm nay, PC thâm niên tính từ mốc hưởng PCTN), bản cũ chuyển sang lịch sử.
          </Text>
          {heSoBaoLuuDangGhi != null && (watchPhuCaps ?? []).some((p: any) => p?.loaiPhuCapId === pcBaoLuuId && p?.giaTri === heSoBaoLuuDangGhi) && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
              title={`Dòng "${TEN_HS_CHENH_LECH_BAO_LUU}" ${heSoBaoLuuDangGhi} trùng mức ${TEN_PCCV_BAO_LUU}`}
              description={`Nếu đây là phụ cấp chức vụ được giữ sau sắp xếp thì xoá dòng này — mức đó đã được tính qua khung "${TEN_PCCV_BAO_LUU}" ở trên. "${TEN_HS_CHENH_LECH_BAO_LUU}" chỉ dùng cho phần chênh lệch hệ số lương khi chuyển ngạch, xếp lại lương.`}
            />
          )}
          {pcTrung.length > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 8 }}
              title="Hồ sơ đang có phụ cấp ghi trùng — kiểm tra mức đúng trước khi lưu"
              description={
                <div style={{ fontSize: 13 }}>
                  {pcTrung.map((a) => (
                    <div key={a[0].id}>
                      <b>{tenLoaiPc(a[0].loaiPhuCapId)}</b>: {a.map((p) => `${mucPc(p)} từ ${formatDate(p.ngayHieuLuc)}`).join('; ')}
                    </div>
                  ))}
                  <div style={{ marginTop: 4 }}>
                    Biểu mẫu đang hiện bản có ngày hiệu lực mới nhất. Khi bấm Lưu, các bản còn lại sẽ được đóng và chuyển sang lịch sử.
                  </div>
                </div>
              }
            />
          )}
          {luongTheoTien && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
              title="Lương theo mức tiền: phụ cấp tính theo % lương chính không áp dụng (không có hệ số lương chính); phụ cấp dạng hệ số nếu có vẫn được tính."
            />
          )}

          <Form.List name="phuCaps">
            {(fields, { remove }) => (
              <>
                {fields.length === 0 && (
                  <Text type="secondary" italic>Chưa khai báo phụ cấp</Text>
                )}
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="top" style={{ marginBottom: 4 }}>
                    <Form.Item {...restField} name={[name, 'id']} hidden><Input /></Form.Item>
                    <Col flex="auto">
                      <Form.Item
                        {...restField}
                        name={[name, 'loaiPhuCapId']}
                        rules={[{ required: true, message: 'Chọn loại' }]}
                        style={{ marginBottom: 8 }}
                      >
                        <Select
                          options={phuCapOptions}
                          placeholder="Chọn loại phụ cấp"
                          showSearch
                          optionFilterProp="label"
                          onChange={(val: string) => {
                            const selected = loaiPhuCaps.find((p) => p.id === val)
                            if (selected) {
                              const current = form.getFieldValue('phuCaps')
                              current[name].giaTri = selected.giaTri
                              // Dòng mới PC thâm niên: mặc định từ mốc hưởng PCTN
                              const moc = form.getFieldValue('mocHuongPctn')
                              if (!current[name].id && selected.ma === 'PC_THAM_NIEN' && moc) current[name].ngayHieuLuc = moc
                              form.setFieldsValue({ phuCaps: [...current] })
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col flex="140px">
                      <Form.Item
                        {...restField}
                        name={[name, 'giaTri']}
                        style={{ marginBottom: 8 }}
                        rules={[{
                          // Loại "Hệ số" (chức vụ, trách nhiệm, chênh lệch bảo lưu) nhập giá trị hệ số, không phải %
                          validator: (_, v) => {
                            const loai = loaiPhuCaps.find((p) => p.id === form.getFieldValue(['phuCaps', name, 'loaiPhuCapId']))
                            return loai?.loaiCongThuc === 'HE_SO' && v >= 5
                              ? Promise.reject(new Error(`Nhập hệ số (VD ${(v / 100).toLocaleString('vi')}), không nhập %`))
                              : Promise.resolve()
                          },
                        }]}
                      >
                        <PhuCapGiaTriInput fieldName={name} />
                      </Form.Item>
                    </Col>
                    <Col flex="150px">
                      <Form.Item {...restField} name={[name, 'ngayHieuLuc']} style={{ marginBottom: 8 }} tooltip="Ngày bắt đầu hưởng mức này">
                        <DatePicker format="DD/MM/YYYY" placeholder="Từ ngày" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col flex="36px">
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                        style={{ marginTop: 4 }}
                      />
                    </Col>
                  </Row>
                ))}
              </>
            )}
          </Form.List>
        </div>

        {/* ── Ghi chú ── */}
        <Divider titlePlacement="left">Ghi chú</Divider>
        <Row gutter={16}>
          <Col xs={24}>
            <Form.Item name="ghiChu" label="Ghi chú">
              <Input.TextArea rows={3} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              {isEdit ? 'Lưu thay đổi' : 'Thêm mới'}
            </Button>
            <Button onClick={() => navigate(isEdit ? `/vien-chuc/${id}` : '/vien-chuc')}>Hủy</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}
