import { Typography } from 'antd'
import type { ChiTietDeXuat } from '@/types/deXuat'
import type { ChucDanhNgheNghiep } from '@/types/danhMuc'
import { formatDate } from '@/utils/helpers'
import { useDanhMucStore } from '@/store/danhMucStore'
import { hienMucPhuCap } from '@/utils/phuCapDangHuong'
import { coDoiLuong } from '@/types/deXuat'

const { Text } = Typography

/**
 * Tóm tắt nội dung điều chỉnh của một người, cũ → mới, theo 4 thông số lương:
 * Ngạch - Bậc - Hệ số - Mốc hưởng. Thông số không đổi thì ghi "giữ nguyên" để người duyệt thấy rõ.
 */
export default function NoiDungDieuChinh({ r, chucDanhs }: { r: ChiTietDeXuat; chucDanhs: ChucDanhNgheNghiep[] }) {
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
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
  const pcs = r.phuCaps ?? []
  const loai = (id?: string) => loaiPhuCaps.find((l) => l.id === id)
  return (
    <div style={{ lineHeight: 1.6, fontSize: 14 }}>
      {pcs.length > 0 && !coDoiLuong(r) ? <Text type="secondary">Lương giữ nguyên ({cdCu?.ma} bậc {r.bacCu} - {hs(r.heSoCu)})</Text> : <>
      {dong('Ngạch', cdCu ? `${cdCu.ma} (${cdCu.bangLuong})` : r.chucDanhCuId, cdMoi ? `${cdMoi.ma} (${cdMoi.bangLuong})` : r.chucDanhMoiId)}
      {dong('Bậc', `Bậc ${r.bacCu}`, `Bậc ${r.bacMoi}`)}
      {dong('Hệ số', hs(r.heSoCu), hs(r.heSoMoi))}
      {dong('Mốc hưởng', r.ngayHieuLucCu ? formatDate(r.ngayHieuLucCu) : '-', r.ngayHieuLuc ? formatDate(r.ngayHieuLuc) : '-')}
      {r.tnvkMoi != null && dong('Vượt khung', `${r.tnvkCu ?? 0}%`, `${r.tnvkMoi}%`)}
      </>}
      {pcs.map((p) => {
        const lMoi = loai(p.loaiPhuCapId)
        const lCu = loai(p.loaiPhuCapCuId ?? p.loaiPhuCapId)
        return (
          <div key={p.loaiPhuCapId} style={{ whiteSpace: 'normal' }}>
            <Text type="secondary">{lMoi?.ten ?? 'Phụ cấp'}: </Text>
            {p.giaTriCu != null ? `${lCu && lCu.id !== lMoi?.id ? `${lCu.ten} ` : ''}${hienMucPhuCap(lCu, p.giaTriCu)}` : 'chưa hưởng'} <Text type="secondary">→</Text>{' '}
            <Text strong style={{ color: p.giaTriMoi ? '#0958d9' : '#cf1322' }}>{p.giaTriMoi ? hienMucPhuCap(lMoi, p.giaTriMoi) : 'thôi hưởng'}</Text>
            <Text type="secondary" style={{ fontSize: 12.5 }}> từ {formatDate(p.ngayHieuLuc)}</Text>
          </div>
        )
      })}
    </div>
  )
}
