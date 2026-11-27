import { useMemo } from 'react'
import { Alert, Space, Tag, Typography } from 'antd'
import type { DeXuatLuong } from '@/types/deXuat'
import { LOAI_DE_XUAT_LABELS } from '@/types/deXuat'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { doiChieuPhieu, tenKyPhieu } from '@/utils/doiChieuGoiY'
import type { NguoiGoiY } from '@/utils/doiChieuGoiY'

const { Text } = Typography

/**
 * Gợi ý soát cho chuyên viên Phòng VHXH khi thẩm định: so danh sách đơn vị lập với danh sách phần mềm tổng hợp từ hồ sơ
 * (người đến hạn nâng bậc, đến mốc nâng PCTN, đủ 5 năm xếp PCTN lần đầu trong kỳ).
 */
export default function DoiChieuGoiY({ dx, moHoSo }: { dx: DeXuatLuong; moHoSo: (vienChucId: string) => void }) {
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const heSoLuongs = useLuongStore((s) => s.heSoLuongs)
  const phuCaps = useLuongStore((s) => s.phuCapVienChucs)
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const bacLuongs = useDanhMucStore((s) => s.bacLuongs)
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)

  const kq = useMemo(
    () => doiChieuPhieu(dx, deXuats, { vienChucs, heSoLuongs, phuCaps, loaiPhuCaps, bacLuongs, chucDanhs }),
    [dx, deXuats, vienChucs, heSoLuongs, phuCaps, loaiPhuCaps, bacLuongs, chucDanhs],
  )
  const khop = !kq.thieu.length && !kq.thua.length
  const tenNguoi = (n: NguoiGoiY) => (
    <span key={n.vienChucId} style={{ display: 'inline-block', marginRight: 12 }}>
      <a onClick={() => moHoSo(n.vienChucId)}>{n.hoTen}</a>{n.ghiChu ? <Text type="secondary" style={{ fontSize: 12 }}> ({n.ghiChu})</Text> : null}
    </span>
  )

  return (
    <Alert
      type={khop ? 'success' : 'warning'}
      showIcon
      style={{ marginBottom: 12 }}
      title={khop
        ? `Khớp với gợi ý của phần mềm: ${kq.soGoiY} người ${LOAI_DE_XUAT_LABELS[dx.loai].toLowerCase()} trong ${tenKyPhieu(kq.ky)}`
        : `Đối chiếu với gợi ý của phần mềm (${tenKyPhieu(kq.ky)}): ${kq.thieu.length ? `thiếu ${kq.thieu.length}` : ''}${kq.thieu.length && kq.thua.length ? ', ' : ''}${kq.thua.length ? `thừa ${kq.thua.length}` : ''} người`}
      description={
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {kq.thieu.length > 0 && (
            <div><Tag color="orange">Phần mềm gợi ý, phiếu chưa có</Tag>{kq.thieu.map(tenNguoi)}</div>
          )}
          {kq.thua.length > 0 && (
            <div><Tag color="red">Có trong phiếu, theo hồ sơ chưa đến hạn</Tag>{kq.thua.map(tenNguoi)}</div>
          )}
          {kq.oPhieuKhac.length > 0 && (
            <div><Tag>Đã ở phiếu khác cùng kỳ</Tag>{kq.oPhieuKhac.map((n) => <span key={n.vienChucId} style={{ marginRight: 12 }}>{n.hoTen} <Text type="secondary" style={{ fontSize: 12 }}>({n.ma})</Text></span>)}</div>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            Gợi ý tính theo hồ sơ hiện tại (mốc lương, mốc PCTN, tháng đóng BHXH). Người thiếu: đề nghị đơn vị giải trình (không đủ tiêu chuẩn, bị kéo dài...) hoặc bổ sung; người thừa: kiểm tra lại mốc hưởng.
          </Text>
        </Space>
      }
    />
  )
}
