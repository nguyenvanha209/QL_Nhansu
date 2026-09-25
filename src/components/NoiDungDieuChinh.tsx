import { Typography } from 'antd'
import type { ChiTietDeXuat } from '@/types/deXuat'
import type { ChucDanhNgheNghiep } from '@/types/danhMuc'
import { formatDate } from '@/utils/helpers'

const { Text } = Typography

/**
 * Tóm tắt nội dung điều chỉnh của một người, cũ → mới, theo 4 thông số lương:
 * Ngạch – Bậc – Hệ số – Mốc hưởng. Thông số không đổi thì ghi "giữ nguyên" để người duyệt thấy rõ.
 */
export default function NoiDungDieuChinh({ r, chucDanhs }: { r: ChiTietDeXuat; chucDanhs: ChucDanhNgheNghiep[] }) {
  const cdCu = chucDanhs.find((c) => c.id === r.chucDanhCuId)
  const cdMoi = chucDanhs.find((c) => c.id === r.chucDanhMoiId)
  const hs = (n: number) => Number(n).toFixed(2).replace('.', ',')
  const dong = (nhan: string, cu: string, moi: string) => {
    const doi = cu !== moi
    return (
      <div key={nhan} style={{ whiteSpace: 'nowrap' }}>
        <Text type="secondary" style={{ display: 'inline-block', width: 62 }}>{nhan}</Text>
        {doi
          ? <>{cu} <Text type="secondary">→</Text> <Text strong style={{ color: '#0958d9' }}>{moi}</Text></>
          : <Text type="secondary">{cu} (giữ nguyên)</Text>}
      </div>
    )
  }
  return (
    <div style={{ lineHeight: 1.6, fontSize: 13 }}>
      {dong('Ngạch', cdCu ? `${cdCu.ma} (${cdCu.bangLuong})` : r.chucDanhCuId, cdMoi ? `${cdMoi.ma} (${cdMoi.bangLuong})` : r.chucDanhMoiId)}
      {dong('Bậc', `Bậc ${r.bacCu}`, `Bậc ${r.bacMoi}`)}
      {dong('Hệ số', hs(r.heSoCu), hs(r.heSoMoi))}
      {dong('Mốc hưởng', r.ngayHieuLucCu ? formatDate(r.ngayHieuLucCu) : '—', r.ngayHieuLuc ? formatDate(r.ngayHieuLuc) : '—')}
    </div>
  )
}
