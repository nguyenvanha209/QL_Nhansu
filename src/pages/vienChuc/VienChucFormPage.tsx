import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Form, Input, Select, DatePicker, Button, Row, Col,
  Space, Typography, Divider, InputNumber, Alert, App, Tag, Switch, Tooltip, Result,
} from 'antd'
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined, MinusCircleOutlined, LockOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import { LOAI_LAO_DONG_LABELS, LOAI_LAO_DONG_DANG_DUNG, LOAI_LAO_DONG_OPTIONS, TRANG_THAI_CONG_TAC_LABELS, NGUON_KINH_PHI_LABELS, HINH_THUC_LUONG_LABELS, coPhuCapThamNien, laVienChucBienChe, nhanLuongTheoTien } from '@/types/vienChuc'
import { chucDanhHopLeVoiVtvl } from '@/utils/vtvlRules'
import type { ChucVu, LoaiLaoDong, HinhThucLuong } from '@/types/vienChuc'
import { getPhuCapChucVuHeSo, HANG_TRUONG_LABELS, hangTruongTheoNamHoc, moTaHang } from '@/utils/hangTruong'
import { namHocHienHanh } from '@/utils/dinhMuc'
import type { LoaiDonVi } from '@/types/donVi'
import { splitHoTen, toUpperName } from '@/utils/helpers'
import { sapXepLoaiPhuCap } from '@/utils/phuCapThuTu'
import { CONG_VIEC, NHOM_VI_TRI, laToTruongNuoiDuong } from '@/utils/nhomViTri'
import { MON_GIANG_DAY, laCapHoc } from '@/utils/dinhMuc'
import { chonBanDangHuong, hoPhuCap, nhomTheoLoai } from '@/utils/phuCapDangHuong'
import { ngayHopLe, tinhNgayNangTiep } from '@/utils/nangLuong'
import type { PhuCapVienChuc } from '@/types/luong'
import { tinhNgayHetBaoLuu, tenHienThiLoaiPhuCap, TEN_PCCV_BAO_LUU, TEN_HS_CHENH_LECH_BAO_LUU, dangBaoLuuPccv } from '@/utils/baoLuuPccv'
import { lamMoiNgay } from '@/lib/supabase'
import { formatDate } from '@/utils/helpers'

const { Title, Text } = Typography

const KHONG_CHUC_VU = ''
const CHUC_VU_QUAN_LY = ['HT', 'P.HT']

function PhuCapGiaTriInput({ value, onChange, fieldName, disabled }: { value?: number; onChange?: (v: number | null) => void; fieldName: number; disabled?: boolean }) {
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
        disabled={disabled}
        style={{ width: '100%' }}
        placeholder={selected?.loaiCongThuc === 'HE_SO' ? 'VD 0,33' : 'Giá trị'}
        min={0}
        step={selected?.loaiCongThuc === 'HE_SO' ? 0.01 : 1}
      />
      <Button disabled style={{ pointerEvents: 'none' }}>{suffix}</Button>
    </Space.Compact>
  )
}

/**
 * Bọc ô lương. Khi bị khoá: phủ một lớp trong suốt để bắt cú bấm - ô đã disabled thì trình duyệt
 * không phát sự kiện bấm, nên không bọc thì người dùng bấm vào mà không thấy giải thích gì.
 */
function OKhoaLuong({ khoa, onBam, children }: { khoa: boolean; onBam: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      {children}
      {khoa && (
        <div
          role="button"
          aria-label="Bậc lương, hệ số lương chỉ thay đổi qua phiếu đề xuất"
          onClick={onBam}
          style={{ position: 'absolute', inset: 0, cursor: 'not-allowed', zIndex: 2 }}
        />
      )}
    </div>
  )
}

/** Nhãn ô lương bị khoá với tài khoản trường */
function NhanKhoaLuong({ ten }: { ten: React.ReactNode }) {
  return (
    <span>
      {ten}{' '}
      <Tooltip title="Chỉ thay đổi qua phiếu đề xuất do Phòng VH-XH duyệt">
        <Tag icon={<LockOutlined />} color="default" style={{ marginInlineStart: 4, fontSize: 12 }}>Qua đề xuất</Tag>
      </Tooltip>
    </span>
  )
}

export default function VienChucFormPage() {
  const { message } = App.useApp()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { currentUser, scopeDonViId, isCBTruong, hasPermission } = useAuth()
  const { modal } = App.useApp()
  const { getById, addVienChuc, updateVienChuc } = useVienChucStore()
  const { donVis, chucDanhs, bacLuongs, loaiPhuCaps, vtvls, chucVus, getBacLuongsForChucDanh } = useDanhMucStore.getState()
  const luongState = useLuongStore.getState()

  const vc = isEdit ? getById(id) : undefined

  // Bậc lương - hệ số lương (và mã ngạch kéo theo hệ số) của người ĐÃ có lương đang hưởng chỉ được
  // thay đổi qua phiếu đề xuất do Phòng VH-XH duyệt; duyệt xong hệ thống tự ghi vào hồ sơ.
  // Tài khoản trường (kế toán, hiệu trưởng) không có quyền "luong:write" nên chỉ xem.
  const coQuyenSuaLuong = hasPermission('luong', 'write')
  const heSoLucMo = isEdit ? luongState.getActiveHeSo(id!) : undefined
  const khoaLuong = isEdit && !coQuyenSuaLuong && !!heSoLucMo
  // Phụ cấp: bản đã có dữ liệu (đã cập nhật lần đầu) thì mọi thay đổi về sau phải qua phiếu đề xuất;
  // loại phụ cấp người đó chưa từng có thì tài khoản trường vẫn khai lần đầu được.
  const khoaPhuCap = isEdit && !coQuyenSuaLuong
  const pcDaCoLucMo = useMemo(
    () => (khoaPhuCap ? luongState.getActivePhuCaps(id!) : []),
    [khoaPhuCap, id],
  )
  // Theo nhóm: đang hưởng PC ưu đãi 45% thì cũng không tự thêm PC ưu đãi 40%, 20% (cùng nhóm ưu đãi)
  const hoPcDaCo = useMemo(() => new Set(pcDaCoLucMo.map((p) => hoPhuCap(p.loaiPhuCapId, loaiPhuCaps))), [pcDaCoLucMo])
  const daCoHo = (loaiId: string) => hoPcDaCo.has(hoPhuCap(loaiId, loaiPhuCaps))
  const baoKhoaPhuCap = () => {
    modal.warning({
      title: 'Không sửa trực tiếp phụ cấp đã có',
      content: (
        <div>
          <p>
            Phụ cấp đã được cập nhật lần đầu thì mọi thay đổi về sau (mức hưởng, ngày hiệu lực, gỡ bỏ) phải qua
            <b> phiếu đề xuất</b> gửi Phòng Văn hóa - Xã hội duyệt. Phê duyệt xong hệ thống tự cập nhật vào hồ sơ.
          </p>
          <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
            <li>Nâng phụ cấp thâm niên nghề: lập phiếu <i>Nâng phụ cấp thâm niên nghề</i>.</li>
            <li>Đổi mức phụ cấp chức vụ, trách nhiệm, ưu đãi...: lập phiếu <i>Điều chỉnh hệ số lương - phụ cấp</i>, đính kèm quyết định.</li>
            <li>Loại phụ cấp người này chưa có thì vẫn được thêm mới ngay trong hồ sơ.</li>
          </ul>
        </div>
      ),
      okText: 'Lập phiếu điều chỉnh',
      closable: true,
      maskClosable: true,
      onOk: () => navigate(`/de-xuat/new?loai=DIEU_CHINH&vienChucId=${id}`),
    })
  }
  const baoKhoaLuong = () => {
    if (!khoaLuong) return
    modal.warning({
      title: 'Không sửa trực tiếp bậc lương - hệ số lương',
      content: (
        <div>
          <p>
            Bậc lương, hệ số lương và mã ngạch của viên chức đang hưởng lương chỉ được thay đổi qua
            <b> phiếu đề xuất</b> gửi Phòng Văn hóa - Xã hội duyệt. Khi phiếu được phê duyệt, hệ thống
            <b> tự cập nhật</b> vào hồ sơ và lịch sử lương.
          </p>
          <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
            <li>Đến hạn nâng bậc: lập phiếu <i>Nâng bậc lương thường xuyên</i>.</li>
            <li>Bậc, hệ số đang ghi sai so với quyết định: lập phiếu <i>Điều chỉnh hệ số lương - phụ cấp</i>, đính kèm quyết định.</li>
            <li>Đổi ngạch, hạng chức danh: lập phiếu <i>Chuyển ngạch</i>.</li>
          </ul>
        </div>
      ),
      okText: 'Lập phiếu điều chỉnh',
      closable: true,
      maskClosable: true,
      onOk: () => navigate(`/de-xuat/new?loai=DIEU_CHINH&vienChucId=${id}`),
    })
  }
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
        ? `${c.ma} - ${c.ten}`
        : `${c.ma} - ${c.ten} (không thuộc VTVL đang chọn)`,
    }))

  const phuCapOptions = sapXepLoaiPhuCap(loaiPhuCaps.filter((pc) => pc.active))
    .filter((pc) => duocHuongPctn || pc.ma !== 'PC_THAM_NIEN')
    .map((pc) => ({ value: pc.id, label: `${pc.ma} - ${tenHienThiLoaiPhuCap(pc)}` }))

  // Chỉ các loại hình đang dùng; hồ sơ cũ mang loại đã bỏ (HĐ 111, tập sự) vẫn hiện đúng khi sửa
  const loaiLaoDongOptions = vc && !LOAI_LAO_DONG_DANG_DUNG.includes(vc.loaiLaoDong)
    ? [...LOAI_LAO_DONG_OPTIONS, { value: vc.loaiLaoDong, label: LOAI_LAO_DONG_LABELS[vc.loaiLaoDong] }]
    : LOAI_LAO_DONG_OPTIONS

  const vtvlOptions = vtvls.filter((v) => v.active).map((v) => ({ value: v.ma, label: v.ten }))
  // Có lựa chọn rõ ràng "Không giữ chức vụ" - trước đây chỉ bỏ được bằng nút ✕ nhỏ, khó thấy khi chuyển Phó HT về giáo viên
  const chucVuOptions = [
    { value: KHONG_CHUC_VU, label: 'Không giữ chức vụ (giáo viên, nhân viên)' },
    ...chucVus.filter((c) => c.active).map((c) => ({ value: c.ma, label: c.ten })),
  ]

  const watchChucDanhId = Form.useWatch('chucDanhId', form)
  const bacLuongOptions = useMemo(() => {
    if (!watchChucDanhId) return []
    return getBacLuongsForChucDanh(watchChucDanhId).map((b) => ({
      value: b.id,
      label: `Bậc ${b.bac} - Hệ số ${b.heSo.toFixed(2)}`,
    }))
  }, [watchChucDanhId])

  const watchDonViId = Form.useWatch('donViId', form)
  const watchChucVu = Form.useWatch('chucVu', form)
  const watchCongViec = Form.useWatch('congViec', form)
  const watchNhiemVu = Form.useWatch('nhiemVuChinh', form) as string | undefined
  // Tổ trưởng, tổ phó tổ nuôi dưỡng: không hưởng PC chức vụ - không tự thêm, kế toán được gỡ dòng đã ghi nhầm
  const cdDangChon = chucDanhs.find((c) => c.id === watchChucDanhIdRaw)
  const toNuoiDuong = laToTruongNuoiDuong(
    { vtvl: watchVtvl, chucVu: watchChucVu, congViec: watchCongViec, nhiemVuChinh: watchNhiemVu }, cdDangChon?.ten, cdDangChon?.nhom,
  )
  // Tài khoản trường không có ô Đơn vị → lấy trường của tài khoản
  const loaiTruongForm = donVis.find((d) => d.id === (watchDonViId ?? scopeDonViId ?? vc?.donViId))?.loai
  const monOptions = laCapHoc(loaiTruongForm) ? MON_GIANG_DAY[loaiTruongForm].map((m) => ({ value: m.ma, label: m.ten })) : []
  const pccvInfo = useMemo(() => {
    if (!watchDonViId || !watchChucVu) return null
    const dv = donVis.find((d) => d.id === watchDonViId)
    // Hạng trường theo quy mô năm học hiện hành (trang Thông tin trường)
    const h = hangTruongTheoNamHoc(dv, useDanhMucStore.getState().quyMoTruongs, namHocHienHanh())
    if (!dv || !h) return null
    const heSo = toNuoiDuong ? 0 : getPhuCapChucVuHeSo(dv.loai as LoaiDonVi, h.hang, watchChucVu as ChucVu)
    return { hang: h.hang, heSo, loai: dv.loai, moTa: moTaHang(h) }
  }, [watchDonViId, watchChucVu, donVis, toNuoiDuong])

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
  // Mục bảo lưu luôn mở được khi sửa hồ sơ có chức vụ / PC chức vụ - trước đây chỉ hiện khi vừa đổi chức vụ trong lần sửa đó,
  // nên chức vụ đã đổi từ trước (nhập Excel, lần lưu trước) thì không còn chỗ khai bảo lưu
  const hienBaoLuu = isEdit && (giamPccv || !!vc?.baoLuuPccv || !!vc?.chucVu || !!watchChucVu || pccvDangHuong > 0)
  const watchBlBat = Form.useWatch('blBat', form) as boolean | undefined
  const watchBlNgayQd = Form.useWatch('blNgayQd', form)
  const watchBlHetHan = Form.useWatch('blHetHan', form)
  const blDenNgay = watchBlNgayQd && watchBlHetHan
    ? tinhNgayHetBaoLuu(watchBlNgayQd.format('YYYY-MM-DD'), watchBlHetHan.format('YYYY-MM-DD'))
    : undefined
  const tenChucVu = (ma?: string) => (ma ? chucVus.find((c) => c.ma === ma)?.ten ?? ma : 'Không')

  // Bỏ hẳn chức vụ → gỡ dòng PC chức vụ (trước đây dòng này bị bỏ quên, hưởng mãi không hết).
  // Nếu được bảo lưu thì phần bảo lưu nằm riêng ở mục Bảo lưu PCCV.
  // Phụ cấp đã có bị khoá mà chức vụ / vị trí vừa đổi làm mức phụ cấp phải đổi theo → nhắc lập phiếu
  const [canLapPhieuPc, setCanLapPhieuPc] = useState<string[]>([])
  const ghiCanLapPhieu = (key: string, noiDung: string | null) =>
    setCanLapPhieuPc((ds) => {
      const khac = ds.filter((x) => !x.startsWith(`${key}|`))
      return noiDung ? [...khac, `${key}|${noiDung}`] : khac
    })
  // PC chức vụ là mức theo chức vụ (TT 33/2005), không phải mức tuỳ chọn: khi chức vụ vừa đổi, hoặc mức đang ghi lệch với
  // chức vụ hiện tại, dòng PC chức vụ mở khoá cho tài khoản trường và tự lấy mức theo chức vụ (ghi lịch sử khi lưu).
  // Đang hưởng bảo lưu PCCV thì giữ nguyên - mức bảo lưu xử lý riêng ở mục Bảo lưu.
  const pccvLech = isEdit && !!watchChucVu && !!pccvInfo && pccvInfo.heSo > 0 && pccvDangHuong !== pccvInfo.heSo
  const moKhoaPccv = toNuoiDuong || doiChucVu || pccvLech
  const dongDaCoDb = (pc: any) => khoaPhuCap && !!pc?.id && !(moKhoaPccv && pc.loaiPhuCapId === pcChucVuId)

  useEffect(() => {
    if (!isEdit || !vc?.chucVu || watchChucVu || !pcChucVuId) { ghiCanLapPhieu('boCv', null); return }
    const current: any[] = form.getFieldValue('phuCaps') || []
    if (!current.some((pc) => pc?.loaiPhuCapId === pcChucVuId)) return
    if (current.some((pc) => pc?.loaiPhuCapId === pcChucVuId && dongDaCoDb(pc))) {
      ghiCanLapPhieu('boCv', 'Đã bỏ chức vụ nhưng PC chức vụ đang hưởng chưa được gỡ - lập phiếu Điều chỉnh để gỡ (hoặc khai bảo lưu nếu do sắp xếp)')
      return
    }
    form.setFieldValue('phuCaps', current.filter((pc) => pc?.loaiPhuCapId !== pcChucVuId))
  }, [watchChucVu, pcChucVuId])

  // Vừa chuyển sang tổ trưởng/tổ phó tổ nuôi dưỡng: bỏ dòng PC chức vụ hệ thống vừa tự thêm (chưa lưu)
  useEffect(() => {
    if (!toNuoiDuong || !pcChucVuId) return
    const current: any[] = form.getFieldValue('phuCaps') || []
    if (current.some((pc) => pc?.loaiPhuCapId === pcChucVuId && !pc.id)) {
      form.setFieldValue('phuCaps', current.filter((pc) => !(pc?.loaiPhuCapId === pcChucVuId && !pc.id)))
    }
  }, [toNuoiDuong, pcChucVuId])

  useEffect(() => {
    if (!pccvInfo || pccvInfo.heSo <= 0) return
    const pcChucVu = loaiPhuCaps.find((p) => p.ma === 'PC_CHUC_VU')
    if (!pcChucVu) return
    const current: any[] = form.getFieldValue('phuCaps') || []
    const idx = current.findIndex((pc) => pc?.loaiPhuCapId === pcChucVu.id)
    if (idx >= 0 && dongDaCoDb(current[idx])) {
      ghiCanLapPhieu('pccv', current[idx].giaTri === pccvInfo.heSo
        ? null
        : `Chức vụ mới hưởng PC chức vụ ${pccvInfo.heSo}, đang ghi ${current[idx].giaTri} - lập phiếu Điều chỉnh để đổi mức`)
      return
    }
    if (idx >= 0) {
      if (current[idx].giaTri === pccvInfo.heSo) return
      // Mới mở hồ sơ (chưa đổi chức vụ): không tự sửa mức đang ghi - chỉ cảnh báo, người dùng bấm "Áp dụng mức theo chức vụ"
      if (current[idx].id && !doiChucVu) return
      const updated = [...current]
      // Mức mới tính từ hôm nay, không mang theo ngày hiệu lực của mức cũ
      updated[idx] = { ...updated[idx], giaTri: pccvInfo.heSo, ngayHieuLuc: dayjs() }
      form.setFieldValue('phuCaps', updated)
    } else {
      form.setFieldValue('phuCaps', [...current, { loaiPhuCapId: pcChucVu.id, giaTri: pccvInfo.heSo, ngayHieuLuc: dayjs() }])
    }
  }, [pccvInfo, loaiPhuCaps])

  /** Chức vụ có hệ số PC chức vụ bằng mức đang ghi ở trường này - gợi ý "chức vụ cũ" khi mức cũ còn nằm ở dòng PC chức vụ */
  const goiYChucVuCu = (heSo: number): string | undefined => {
    const dv = donVis.find((d) => d.id === (watchDonViId ?? vc?.donViId))
    const h = hangTruongTheoNamHoc(dv, useDanhMucStore.getState().quyMoTruongs, namHocHienHanh())
    if (!dv || !h || !heSo) return undefined
    const hang = h.hang
    return ['HT', 'P.HT', 'TTCM', 'TPCM'].find((cv) => cv !== watchChucVu && getPhuCapChucVuHeSo(dv.loai as LoaiDonVi, hang, cv as ChucVu) === heSo)
  }
  const batBaoLuu = (bat: boolean) => {
    if (!bat || form.getFieldValue('blHeSo') != null) return
    if (giamPccv) {
      form.setFieldsValue({ blChucVuCu: vc?.chucVu, blHeSo: pccvDangHuong })
    } else if (pccvDangHuong > pccvTheoChucVuMoi) {
      // Mức cũ đang để ở dòng PC chức vụ (chức vụ đã đổi từ trước): chuyển thành mức bảo lưu
      form.setFieldsValue({ blChucVuCu: goiYChucVuCu(pccvDangHuong), blHeSo: pccvDangHuong })
    }
  }

  const apDungPccvTheoChucVu = () => {
    if (!pccvInfo || !pcChucVuId) return
    const current: any[] = form.getFieldValue('phuCaps') || []
    const idx = current.findIndex((pc) => pc?.loaiPhuCapId === pcChucVuId)
    const dongMoi = { loaiPhuCapId: pcChucVuId, giaTri: pccvInfo.heSo, ngayHieuLuc: dayjs() }
    form.setFieldValue('phuCaps', idx >= 0 ? current.map((pc, i) => (i === idx ? { ...pc, ...dongMoi } : pc)) : [...current, dongMoi])
  }

  // Nhân viên không hưởng PC thâm niên → gỡ dòng phụ cấp này nếu đang có
  const watchPhuCaps = Form.useWatch('phuCaps', form) as { loaiPhuCapId?: string }[] | undefined
  useEffect(() => {
    if (duocHuongPctn) return
    const pcThamNien = loaiPhuCaps.find((p) => p.ma === 'PC_THAM_NIEN')
    if (!pcThamNien) return
    const current: any[] = form.getFieldValue('phuCaps') || []
    if (!current.some((pc) => pc?.loaiPhuCapId === pcThamNien.id)) return
    if (current.some((pc) => pc?.loaiPhuCapId === pcThamNien.id && dongDaCoDb(pc))) {
      ghiCanLapPhieu('pctn', 'Vị trí Nhân viên không hưởng PC thâm niên nhưng đang có - lập phiếu Điều chỉnh để gỡ')
      return
    }
    form.setFieldValue('phuCaps', current.filter((pc) => pc?.loaiPhuCapId !== pcThamNien.id))
    message.warning('Vị trí việc làm Nhân viên không hưởng phụ cấp thâm niên - đã gỡ dòng PC Thâm niên nghề')
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
      {laBienChe && <Tag color="blue" style={{ marginInlineEnd: 0, fontSize: 12, lineHeight: '16px' }}>VC biên chế</Tag>}
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
      blChucVuCu: vc.baoLuuPccv?.chucVuCu,
      blHeSo: vc.baoLuuPccv?.heSo,
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
    if (khoaPhuCap) {
      // Ngoại lệ: tổ trưởng, tổ phó tổ nuôi dưỡng không hưởng PC chức vụ - kế toán gỡ hoặc sửa được bản đã ghi
      if (moKhoaPccv && pcChucVuId) {
        for (const p of luongState.getActivePhuCaps(vcId).filter((x) => x.loaiPhuCapId === pcChucVuId)) {
          const dong = rows.find((r) => r?.id === p.id)
          if (dong && (dong.giaTri || 0) === p.giaTri) continue
          if (dong && dong.giaTri > 0) {
            luongState.addPhuCap({
              vienChucId: vcId, loaiPhuCapId: pcChucVuId, giaTri: dong.giaTri,
              ngayHieuLuc: dong.ngayHieuLuc ? dayjs(dong.ngayHieuLuc).format('YYYY-MM-DD') : macDinhNgay,
              isActive: true, createdBy: currentUser?.id ?? 'system',
            })
          } else {
            luongState.deactivatePhuCap(p.id)
          }
          luongState.addLichSuBienDong({
            vienChucId: vcId, loai: 'PHU_CAP',
            truongThayDoi: toNuoiDuong ? 'PC chức vụ (tổ trưởng/tổ phó tổ nuôi dưỡng)' : `PC chức vụ theo chức vụ ${tenChucVu(watchChucVu)}`,
            giaTriCu: String(p.giaTri).replace('.', ','),
            giaTriMoi: dong && dong.giaTri > 0 ? String(dong.giaTri).replace('.', ',') : 'Gỡ - không hưởng PC chức vụ',
            ngayThayDoi: dayjs().format('YYYY-MM-DD'), nguoiThayDoiId: currentUser?.id ?? 'system',
          })
        }
      }
      // Tài khoản trường: chỉ ghi phụ cấp loại (nhóm) người này chưa từng có; bản đã có giữ nguyên
      const dangCo = new Set(luongState.getActivePhuCaps(vcId).map((p) => hoPhuCap(p.loaiPhuCapId, loaiPhuCaps)))
      for (const pc of rows) {
        if (!pc?.loaiPhuCapId || pc.id || dangCo.has(hoPhuCap(pc.loaiPhuCapId, loaiPhuCaps))) continue
        const laPctn = loaiPhuCaps.find((l) => l.id === pc.loaiPhuCapId)?.ma === 'PC_THAM_NIEN'
        luongState.addPhuCap({
          vienChucId: vcId,
          loaiPhuCapId: pc.loaiPhuCapId,
          giaTri: pc.giaTri || 0,
          ngayHieuLuc: pc.ngayHieuLuc ? dayjs(pc.ngayHieuLuc).format('YYYY-MM-DD') : (laPctn && mocPctn) || macDinhNgay,
          isActive: true,
          createdBy: currentUser?.id ?? 'system',
        })
        dangCo.add(hoPhuCap(pc.loaiPhuCapId, loaiPhuCaps))
      }
      return
    }
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
    // Tải bản mới nhất trước khi ghi hồ sơ, lương, phụ cấp - tránh đè sửa đổi của người khác
    await lamMoiNgay()
    const { hoTenFull, mocHuongLuong, blBat, blSoQd, blNgayQd, blHetHan, blChucVuCu, blHeSo, ...restValues } = values
    // Bảo lưu PCCV: giữ mức và chức vụ cũ đã ghi (nếu có), bảo lưu mới thì lấy mức đang hưởng trước khi đổi
    const baoLuuPccv = blBat && blNgayQd && blHetHan
      ? {
          chucVuCu: blChucVuCu ?? vc?.baoLuuPccv?.chucVuCu ?? vc?.chucVu ?? '',
          heSo: blHeSo ?? vc?.baoLuuPccv?.heSo ?? pccvDangHuong,
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
    // Chốt chặn cuối khi lưu: tài khoản không có quyền sửa lương thì giữ nguyên ngạch, bậc đang hưởng
    // (kể cả khi giá trị bị đổi bằng cách khác ngoài ô nhập), và không cho chuyển sang lương theo mức tiền
    if (khoaLuong && vc && heSoLucMo) {
      const bacGoc = bacLuongs.find((b) => b.chucDanhId === heSoLucMo.chucDanhId && b.bac === heSoLucMo.bac)
      const doiNgach = (formatted.chucDanhId ?? '') !== (vc.chucDanhId ?? '')
      const doiBac = !!bacGoc && formatted.bacLuongId !== bacGoc.id
      if (theoTien || doiNgach || doiBac) {
        baoKhoaLuong()
        return
      }
    }
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
        message.error(`Phụ cấp "${daCo.get(k)}" có hai dòng - mỗi loại chỉ giữ một dòng (đổi mức thì sửa dòng đang có)`)
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
            giaTriCu: `${formatDate(currentHeSo.ngayHieuLuc) || '(trống)'} - nâng lương tiếp ${formatDate(currentHeSo.ngayNangLuongTiepTheo) || '(trống)'}`,
            giaTriMoi: `${formatDate(mocHuongLuongStr)} - nâng lương tiếp ${formatDate(nangTiep)}`,
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

  // Tài khoản trường chỉ sửa hồ sơ trường mình (trước đây mở được hồ sơ trường khác bằng đường dẫn)
  if (vc && scopeDonViId && vc.donViId !== scopeDonViId) {
    return <Result status="403" title="Không có quyền sửa hồ sơ này" subTitle="Hồ sơ thuộc trường khác." extra={<Button onClick={() => navigate('/vien-chuc')}>Về danh sách</Button>} />
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
                  if (dangChon && !chucDanhHopLeVoiVtvl(dangChon.nhom, v) && khoaLuong) {
                    message.warning(`Ngạch "${dangChon.ma} - ${dangChon.ten}" không thuộc VTVL vừa chọn - đổi ngạch phải lập phiếu đề xuất Chuyển ngạch`)
                  } else if (dangChon && !chucDanhHopLeVoiVtvl(dangChon.nhom, v)) {
                    form.setFieldsValue({ chucDanhId: undefined, bacLuongId: undefined })
                    message.info(`Ngạch "${dangChon.ma} - ${dangChon.ten}" không thuộc VTVL vừa chọn, vui lòng chọn lại ngạch/hạng`)
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
                    message.info('Không còn chức vụ quản lý - đã chuyển Vị trí việc làm sang Giáo viên, kiểm tra lại nếu cần')
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
                tooltip="Căn cứ chia nhóm Nhân viên chuyên môn - hỗ trợ / phục vụ / nuôi dưỡng trên trang Tổng quan"
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
                label={loaiTruongForm === 'MAM_NON' ? 'Nhóm, lớp phụ trách' : 'Môn giảng dạy'}
                tooltip={loaiTruongForm === 'MAM_NON'
                  ? 'Nhóm, lớp độ tuổi giáo viên phụ trách - để theo dõi và lập danh sách ở trang Định mức viên chức và Cơ cấu VTVL'
                  : 'Căn cứ đối chiếu định mức giáo viên theo từng môn (TT 20/2023/TT-BGDĐT) ở trang Định mức viên chức và Cơ cấu VTVL'}
              >
                <Select options={monOptions} placeholder={loaiTruongForm === 'MAM_NON' ? 'Chọn nhóm, lớp' : 'Chọn môn giảng dạy'} allowClear showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
          )}
          <Col xs={24} sm={12} md={8}>
            <Form.Item
              label={khoaLuong ? <NhanKhoaLuong ten={nhanBienChe('Mã ngạch/Hạng')} /> : nhanBienChe('Mã ngạch/Hạng')}
              required={laBienChe}
            >
              {/* Ô bị khoá vẫn bắt được cú bấm (Select của antd là thẻ div) để báo lý do và chỉ đường lập phiếu */}
              <OKhoaLuong khoa={khoaLuong} onBam={baoKhoaLuong}>
                <Form.Item name="chucDanhId" noStyle rules={[{ required: laBienChe, message: 'Chọn mã ngạch/hạng' }]}>
                  <Select
                    options={chucDanhOptions}
                    placeholder={laBienChe ? 'Chọn chức danh' : 'Không bắt buộc'}
                    showSearch
                    allowClear={!laBienChe && !khoaLuong}
                    optionFilterProp="label"
                    disabled={khoaLuong}
                    onChange={() => form.setFieldValue('bacLuongId', undefined)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </OKhoaLuong>
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
                    <Switch size="small" onChange={batBaoLuu} />
                  </Form.Item>
                  <Text strong>{TEN_PCCV_BAO_LUU}</Text>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {vc?.baoLuuPccv
                      ? `Đang ghi: chức vụ cũ ${tenChucVu(vc.baoLuuPccv.chucVuCu)} - hệ số bảo lưu ${vc.baoLuuPccv.heSo}`
                      : giamPccv
                        ? `${tenChucVu(vc?.chucVu)} (hệ số ${pccvDangHuong}) → ${tenChucVu(watchChucVu)} (hệ số ${pccvTheoChucVuMoi})`
                        : 'Bật nếu người này đang hưởng PC chức vụ của chức vụ cũ do sắp xếp tổ chức bộ máy'}
                  </Text>
                </Space>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: watchBlBat ? 8 : 0 }}>
                  Mức PC chức vụ của chức vụ cũ được giữ sau sắp xếp tổ chức bộ máy, khai tại đây. Không khai vào dòng
                  "{TEN_HS_CHENH_LECH_BAO_LUU}" và không cộng vào dòng PC chức vụ hiện tại - dòng đó chỉ ghi mức theo chức vụ đang giữ.
                </Text>
                {watchBlBat && (
                  <Row gutter={16}>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="blChucVuCu"
                        label="Chức vụ cũ (trước sắp xếp)"
                        dependencies={['chucVu']}
                        rules={[
                          { required: true, message: 'Chọn chức vụ cũ' },
                          ({ getFieldValue }) => ({
                            validator: (_, v) => (v && v === getFieldValue('chucVu')
                              ? Promise.reject(new Error('Chức vụ cũ phải khác chức vụ hiện tại'))
                              : Promise.resolve()),
                          }),
                        ]}
                      >
                        <Select options={chucVuOptions.filter((o) => o.value !== KHONG_CHUC_VU)} placeholder="Chọn chức vụ cũ" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="blHeSo"
                        label="Hệ số PC chức vụ cũ (bảo lưu)"
                        tooltip="Mức PC chức vụ của chức vụ cũ theo quyết định - không phải mức của chức vụ hiện tại"
                        rules={[
                          { required: true, message: 'Nhập hệ số' },
                          {
                            validator: (_, v) => (v != null && v <= pccvTheoChucVuMoi
                              ? Promise.reject(new Error(`Phải cao hơn PC chức vụ hiện tại (${String(pccvTheoChucVuMoi).replace('.', ',')}) mới có tác dụng`))
                              : Promise.resolve()),
                          },
                        ]}
                      >
                        <InputNumber min={0} max={1.5} step={0.05} precision={2} style={{ width: '100%' }} placeholder="VD: 0,35" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8} />
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
                      <Text style={{ fontSize: 13.5 }}>
                        {blDenNgay
                          ? <>Được hưởng nguyên PCCV cũ <b>đến hết {formatDate(blDenNgay)}</b>; sau đó hệ thống tự chuyển về mức theo chức vụ hiện tại.</>
                          : 'Nhập đủ hai ngày để hệ thống tính ngày hết bảo lưu.'}
                        <Text type="secondary" style={{ fontSize: 13 }}> Thời hạn còn lại dưới 6 tháng thì được bảo lưu 6 tháng (NĐ 178/2024, NĐ 67/2025).</Text>
                      </Text>
                    </Col>
                  </Row>
                )}
                {watchBlBat && pccvInfo && (() => {
                  const dongCv = (watchPhuCaps ?? []).find((pc) => pc?.loaiPhuCapId === pcChucVuId) as { giaTri?: number } | undefined
                  return dongCv?.giaTri != null && dongCv.giaTri > pccvInfo.heSo ? (
                    <Alert
                      type="warning" showIcon style={{ marginTop: 8 }}
                      title={`Dòng PC chức vụ đang ghi ${String(dongCv.giaTri).replace('.', ',')} - cao hơn mức theo chức vụ hiện tại (${String(pccvInfo.heSo).replace('.', ',')})`}
                      description="Mức cũ đã khai ở mục bảo lưu này; dòng PC chức vụ chỉ ghi mức theo chức vụ đang giữ, để khi hết bảo lưu lương tự về đúng mức."
                      action={<Button size="small" onClick={apDungPccvTheoChucVu}>Đưa về mức theo chức vụ</Button>}
                    />
                  ) : null
                })()}
                {!watchBlBat && giamPccv && (
                  <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 6 }}>
                    Phụ cấp chức vụ đang giảm. Bật mục này nếu việc thôi giữ / hạ chức vụ là do sắp xếp tổ chức bộ máy.
                  </Text>
                )}
              </div>
            </Col>
          )}
          {toNuoiDuong ? (
            <Col xs={24}>
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title="Tổ trưởng, tổ phó tổ nuôi dưỡng không hưởng phụ cấp chức vụ (TT 33/2005 chỉ áp dụng cho tổ chuyên môn, tổ văn phòng)"
                description="Hệ thống không tự thêm PC chức vụ. Nếu hồ sơ đang có dòng PC chức vụ ghi nhầm, bấm nút xoá ở dòng đó rồi Lưu - việc gỡ được ghi vào lịch sử biến động."
              />
            </Col>
          ) : pccvInfo && pccvInfo.heSo > 0 && (() => {
            const dongCv = (watchPhuCaps ?? []).find((pc) => pc?.loaiPhuCapId === pcChucVuId) as { giaTri?: number } | undefined
            const khop = dongCv?.giaTri === pccvInfo.heSo
            const theoQd = `PC chức vụ theo chức vụ ${tenChucVu(watchChucVu)} (${pccvInfo.moTa}; TT 33/2005): hệ số ${String(pccvInfo.heSo).replace('.', ',')}`
            return (
              <Col xs={24}>
                <Alert
                  type={khop ? 'info' : 'warning'}
                  showIcon
                  style={{ marginBottom: 16 }}
                  title={khop
                    ? `${theoQd} - đã ghi ở mục Phụ cấp${pccvDangHuong !== pccvInfo.heSo && isEdit ? ` (đổi từ ${String(pccvDangHuong).replace('.', ',')}, ghi lịch sử khi Lưu)` : ''}`
                    : `${theoQd} - mục Phụ cấp đang ghi ${dongCv ? String(dongCv.giaTri).replace('.', ',') : 'chưa có'}`}
                  description={khop && pccvDangHuong !== pccvInfo.heSo && isEdit
                    ? 'Kiểm tra ngày hiệu lực của dòng PC chức vụ (mặc định hôm nay - sửa theo ngày quyết định phân công) rồi bấm Lưu.'
                    : !khop && !dongDaCoDb((watchPhuCaps ?? []).find((pc) => pc?.loaiPhuCapId === pcChucVuId))
                      ? 'Nếu mức theo chức vụ là đúng (VD vừa đổi chức vụ), bấm "Áp dụng mức theo chức vụ", sửa ngày hiệu lực theo quyết định rồi Lưu. Trường hợp đang hưởng bảo lưu do sắp xếp thì khai ở mục Bảo lưu.'
                      : undefined}
                  action={!khop && !dongDaCoDb((watchPhuCaps ?? []).find((pc) => pc?.loaiPhuCapId === pcChucVuId))
                    ? <Button size="small" onClick={apDungPccvTheoChucVu}>Áp dụng mức theo chức vụ</Button>
                    : undefined}
                />
              </Col>
            )
          })()}
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
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
            Các ô gắn nhãn <Tag color="blue" style={{ fontSize: 12, lineHeight: '16px' }}>VC biên chế</Tag>
            là thông tin bắt buộc theo quy định đối với viên chức biên chế.
          </Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
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
        {khoaLuong && (
          <Alert
            type="info"
            showIcon
            icon={<LockOutlined />}
            style={{ marginBottom: 12 }}
            title="Mã ngạch, bậc lương, hệ số lương chỉ thay đổi qua phiếu đề xuất"
            description={(
              <span>
                Phòng Văn hóa - Xã hội duyệt phiếu xong, hệ thống tự cập nhật vào hồ sơ.{' '}
                <a onClick={() => navigate(`/de-xuat/new?loai=DIEU_CHINH&vienChucId=${id}`)}>Lập phiếu điều chỉnh cho người này</a>
              </span>
            )}
          />
        )}
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
              label={khoaLuong ? <NhanKhoaLuong ten={nhanBienChe('Bậc lương')} /> : nhanBienChe('Bậc lương')}
              required={laBienChe && !isEdit}
            >
              <OKhoaLuong khoa={khoaLuong} onBam={baoKhoaLuong}>
                <Form.Item name="bacLuongId" noStyle rules={[{ required: laBienChe && !isEdit, message: 'Chọn bậc lương' }]}>
                  <Select
                    options={bacLuongOptions}
                    placeholder={watchChucDanhId ? (laBienChe ? 'Chọn bậc lương' : 'Không bắt buộc') : 'Chọn chức danh trước'}
                    disabled={!watchChucDanhId || khoaLuong}
                    allowClear={!laBienChe && !khoaLuong}
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </OKhoaLuong>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Form.Item label={khoaLuong ? <NhanKhoaLuong ten="Hệ số lương" /> : 'Hệ số lương'}>
              <OKhoaLuong khoa={khoaLuong} onBam={baoKhoaLuong}>
                <InputNumber
                  value={selectedBac?.heSo}
                  disabled
                  style={{ width: '100%' }}
                  precision={2}
                  placeholder="Tự động theo bậc"
                />
              </OKhoaLuong>
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
                tooltip="Mốc hưởng phụ cấp thâm niên - căn cứ để trường đề xuất nâng 1%/năm ở kỳ sau (6 tháng đầu hoặc cuối năm). Chỉ áp dụng với CBQL và giáo viên."
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn mốc hưởng PCTN" />
              </Form.Item>
            </Col>
          )}
        </Row>
        {!duocHuongPctn && watchVtvl && (
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
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
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
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
              description={`Nếu đây là phụ cấp chức vụ được giữ sau sắp xếp thì xoá dòng này - mức đó đã được tính qua khung "${TEN_PCCV_BAO_LUU}" ở trên. "${TEN_HS_CHENH_LECH_BAO_LUU}" chỉ dùng cho phần chênh lệch hệ số lương khi chuyển ngạch, xếp lại lương.`}
            />
          )}
          {khoaPhuCap && pcDaCoLucMo.length > 0 && (
            <Alert
              type="info"
              showIcon
              icon={<LockOutlined />}
              style={{ marginBottom: 8 }}
              title="Phụ cấp đã có dữ liệu chỉ thay đổi qua phiếu đề xuất"
              description={(
                <span>
                  Các dòng có nhãn khoá giữ nguyên; loại phụ cấp người này chưa có thì vẫn bấm "Thêm phụ cấp" để khai lần đầu.{' '}
                  <a onClick={() => navigate(`/de-xuat/new?loai=DIEU_CHINH&vienChucId=${id}`)}>Lập phiếu điều chỉnh</a>
                </span>
              )}
            />
          )}
          {canLapPhieuPc.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
              title="Cần lập phiếu đề xuất để cập nhật phụ cấp"
              description={<ul style={{ margin: 0, paddingLeft: 18 }}>{canLapPhieuPc.map((x) => <li key={x}>{x.split('|')[1]}</li>)}</ul>}
            />
          )}
          {pcTrung.length > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 8 }}
              title="Hồ sơ đang có phụ cấp ghi trùng - kiểm tra mức đúng trước khi lưu"
              description={
                <div style={{ fontSize: 14 }}>
                  {pcTrung.map((a) => (
                    <div key={a[0].id}>
                      <b>{tenLoaiPc(a[0].loaiPhuCapId)}</b>: {a.map((p) => `${mucPc(p)} từ ${formatDate(p.ngayHieuLuc)}`).join('; ')}
                    </div>
                  ))}
                  <div style={{ marginTop: 4 }}>
                    {khoaPhuCap
                      ? 'Biểu mẫu đang hiện bản có ngày hiệu lực mới nhất. Phòng VH-XH sẽ đóng bản thừa - báo Phòng hoặc lập phiếu Điều chỉnh.'
                      : 'Biểu mẫu đang hiện bản có ngày hiệu lực mới nhất. Khi bấm Lưu, các bản còn lại sẽ được đóng và chuyển sang lịch sử.'}
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
                {fields.map(({ key, name, ...restField }) => {
                  const khoaDong = dongDaCoDb(form.getFieldValue(['phuCaps', name]))
                  return (
                  <Row key={key} gutter={8} align="top" style={{ marginBottom: 4, position: 'relative' }}>
                    <Form.Item {...restField} name={[name, 'id']} hidden><Input /></Form.Item>
                    <Col flex="auto">
                      <Form.Item
                        {...restField}
                        name={[name, 'loaiPhuCapId']}
                        rules={[{ required: true, message: 'Chọn loại' }]}
                        style={{ marginBottom: 8 }}
                      >
                        <Select
                          disabled={khoaDong}
                          // Dòng khai mới: không cho chọn loại người này đã có (đổi mức phải qua phiếu)
                          options={khoaPhuCap && !khoaDong
                            ? phuCapOptions.map((o) => {
                                const khoa = daCoHo(o.value) && !(toNuoiDuong && o.value === pcChucVuId)
                                return { ...o, disabled: khoa, label: khoa ? `${o.label} (đã có - đổi qua phiếu)` : o.label }
                              })
                            : phuCapOptions}
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
                        <PhuCapGiaTriInput fieldName={name} disabled={khoaDong} />
                      </Form.Item>
                    </Col>
                    <Col flex="150px">
                      <Form.Item {...restField} name={[name, 'ngayHieuLuc']} style={{ marginBottom: 8 }} tooltip="Ngày bắt đầu hưởng mức này">
                        <DatePicker format="DD/MM/YYYY" placeholder="Từ ngày" style={{ width: '100%' }} disabled={khoaDong} />
                      </Form.Item>
                    </Col>
                    <Col flex="36px">
                      {khoaDong ? (
                        <Tooltip title="Phụ cấp đã có - thay đổi qua phiếu đề xuất">
                          <Button type="text" icon={<LockOutlined />} onClick={baoKhoaPhuCap} style={{ marginTop: 4, color: '#94a3b8' }} />
                        </Tooltip>
                      ) : (
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                          style={{ marginTop: 4 }}
                        />
                      )}
                    </Col>
                    {/* Bấm vào dòng bị khoá: báo lý do (ô disabled không phát sự kiện bấm) */}
                    {khoaDong && (
                      <div
                        role="button"
                        aria-label="Phụ cấp đã có - thay đổi qua phiếu đề xuất"
                        onClick={baoKhoaPhuCap}
                        style={{ position: 'absolute', inset: '0 44px 0 0', cursor: 'not-allowed', zIndex: 2 }}
                      />
                    )}
                  </Row>
                  )
                })}
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
