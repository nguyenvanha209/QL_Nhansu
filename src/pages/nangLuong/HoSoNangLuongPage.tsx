import { useSearchParams } from 'react-router-dom'
import { Badge, Card, Tabs, Typography } from 'antd'
import DeXuatListPage from '@/pages/deXuat/DeXuatListPage'
import NangTruocHanPage from '@/pages/truocHan/NangTruocHanPage'
import { useDeXuatCanXuLy } from '@/hooks/useDeXuatCanXuLy'
import { LOAI_DE_XUAT_LABELS, LOAI_HO_SO_NANG_LUONG, TEN_CHUC_NANG_NANG_LUONG } from '@/types/deXuat'
import type { LoaiDeXuat } from '@/types/deXuat'

const { Title } = Typography

// Mảng cố định để hook đếm không tính lại mỗi lần vẽ
const MOT_LOAI = Object.fromEntries(LOAI_HO_SO_NANG_LUONG.map((l) => [l, [l]])) as Record<LoaiDeXuat, LoaiDeXuat[]>

function NhanThe({ loai }: { loai: LoaiDeXuat }) {
  const so = useDeXuatCanXuLy(MOT_LOAI[loai])
  return <Badge count={so} size="small" offset={[8, -2]}><span style={{ color: 'inherit' }}>{LOAI_DE_XUAT_LABELS[loai]}</span></Badge>
}

/** Lập hồ sơ nâng lương - phụ cấp thâm niên: 4 loại hồ sơ theo niên hạn / thành tích, mỗi loại một thẻ */
export default function HoSoNangLuongPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('loai') as LoaiDeXuat | null
  const loai: LoaiDeXuat = q && LOAI_HO_SO_NANG_LUONG.includes(q) ? q : 'NANG_BAC'
  return (
    <Card>
      <Title level={4} style={{ marginTop: 0, marginBottom: 4 }}>{TEN_CHUC_NANG_NANG_LUONG}</Title>
      <Tabs
        activeKey={loai}
        onChange={(k) => setParams({ loai: k }, { replace: true })}
        destroyOnHidden
        items={LOAI_HO_SO_NANG_LUONG.map((l) => ({
          key: l,
          label: <NhanThe loai={l} />,
          children: l === 'NANG_TRUOC_HAN' ? <NangTruocHanPage nhung /> : <DeXuatListPage loai={l} />,
        }))}
      />
    </Card>
  )
}
