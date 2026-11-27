import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Card, Tabs, Tooltip, Typography } from 'antd'
import dayjs from 'dayjs'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useAuth } from '@/hooks/useAuth'
import { namCuaPhieu } from '@/components/TongHopHoSoNangLuong'
import type { TrangThaiDeXuat } from '@/types/deXuat'
import DeXuatListPage from '@/pages/deXuat/DeXuatListPage'
import NangTruocHanPage from '@/pages/truocHan/NangTruocHanPage'
import { useDeXuatCanXuLy } from '@/hooks/useDeXuatCanXuLy'
import { usePhamVi } from '@/hooks/usePhamVi'
import { LOAI_DE_XUAT_LABELS, LOAI_HO_SO_NANG_LUONG, TEN_CHUC_NANG_NANG_LUONG } from '@/types/deXuat'
import type { LoaiDeXuat } from '@/types/deXuat'

const { Title } = Typography

// Mảng cố định để hook đếm không tính lại mỗi lần vẽ
const MOT_LOAI = Object.fromEntries(LOAI_HO_SO_NANG_LUONG.map((l) => [l, [l]])) as Record<LoaiDeXuat, LoaiDeXuat[]>

// Các giai đoạn của hồ sơ, hiện số phiếu dưới tên thẻ (chỉ giai đoạn có phiếu)
const GIAI_DOAN: { ten: string; tenDu: string; mau: string; tt: TrangThaiDeXuat[] }[] = [
  { ten: 'Đang lập', tenDu: 'Đơn vị đang lập', mau: '#8c8c8c', tt: ['NHAP'] },
  { ten: 'Chờ TT', tenDu: 'Chờ Thủ trưởng đơn vị duyệt', mau: '#1677ff', tt: ['CHO_HIEU_TRUONG_DUYET'] },
  { ten: 'Chờ VHXH', tenDu: 'Chờ Phòng VHXH thẩm định', mau: '#d46b08', tt: ['CHO_XET_DUYET'] },
  { ten: 'Chờ LĐ', tenDu: 'Chờ Lãnh đạo Phòng phê duyệt', mau: '#722ed1', tt: ['CHO_PHE_DUYET'] },
  { ten: 'Đã duyệt', tenDu: 'Đã phê duyệt', mau: '#389e0d', tt: ['DA_PHE_DUYET'] },
  { ten: 'Bổ sung/TC', tenDu: 'Yêu cầu bổ sung / bị từ chối', mau: '#cf1322', tt: ['YEU_CAU_BO_SUNG', 'TU_CHOI'] },
]

function NhanThe({ loai }: { loai: LoaiDeXuat }) {
  const soCho = useDeXuatCanXuLy(MOT_LOAI[loai])
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const { scopeDonViId } = useAuth()
  const { trongPhamVi } = usePhamVi()
  const nam = dayjs().year()
  // Số hồ sơ (phiếu) năm nay theo từng giai đoạn, trong phạm vi tài khoản (đơn vị mình / khối đang xem)
  const dem = useMemo(() => {
    const ds = deXuats.filter((d) => d.loai === loai && namCuaPhieu(d) === nam && (scopeDonViId ? d.donViId === scopeDonViId : trongPhamVi(d.donViId)))
    return GIAI_DOAN.map((g) => ({ ...g, so: ds.filter((d) => g.tt.includes(d.trangThai)).length }))
  }, [deXuats, loai, nam, scopeDonViId, trongPhamVi])
  const coSo = dem.filter((g) => g.so)
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25 }}>
      <Badge count={soCho} size="small" offset={[8, -2]} title={soCho ? `${soCho} hồ sơ chờ bạn xử lý` : undefined}>
        <span style={{ color: 'inherit' }}>{LOAI_DE_XUAT_LABELS[loai]}</span>
      </Badge>
      <Tooltip title={coSo.length ? `Năm ${nam}: ${coSo.map((g) => `${g.tenDu} ${g.so}`).join('; ')}` : `Năm ${nam}: chưa có hồ sơ`}>
        <span style={{ fontSize: 11.5, marginTop: 2, whiteSpace: 'nowrap' }}>
          {coSo.length
            ? coSo.map((g, i) => <span key={g.ten} style={{ color: g.mau, fontWeight: 600 }}>{i ? ' · ' : ''}{g.ten} {g.so}</span>)
            : <span style={{ color: '#bfbfbf' }}>Chưa có hồ sơ {nam}</span>}
        </span>
      </Tooltip>
    </span>
  )
}

/** Lập hồ sơ nâng lương - phụ cấp thâm niên: 4 loại hồ sơ theo niên hạn / thành tích, mỗi loại một thẻ */
export default function HoSoNangLuongPage() {
  const [params, setParams] = useSearchParams()
  // Phụ cấp thâm niên nhà giáo chỉ có ở trường học: khối cơ quan, ĐVSN chỉ còn nâng lương thường xuyên, trước thời hạn
  const { laTruongHocKhoi } = usePhamVi()
  const cacLoai = laTruongHocKhoi ? LOAI_HO_SO_NANG_LUONG : LOAI_HO_SO_NANG_LUONG.filter((l) => l !== 'PHU_CAP_THAM_NIEN' && l !== 'PCTN_LAN_DAU')
  const q = params.get('loai') as LoaiDeXuat | null
  const loai: LoaiDeXuat = q && cacLoai.includes(q) ? q : 'NANG_BAC'
  return (
    <Card>
      <Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>{laTruongHocKhoi ? TEN_CHUC_NANG_NANG_LUONG : 'Lập hồ sơ nâng lương'}</Title>
      <Tabs
        activeKey={loai}
        onChange={(k) => setParams({ loai: k }, { replace: true })}
        destroyOnHidden
        items={cacLoai.map((l) => ({
          key: l,
          label: <NhanThe loai={l} />,
          children: l === 'NANG_TRUOC_HAN' ? <NangTruocHanPage nhung /> : <DeXuatListPage loai={l} />,
        }))}
      />
    </Card>
  )
}
