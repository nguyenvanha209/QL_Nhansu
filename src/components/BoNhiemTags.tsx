import { Tag, Tooltip } from 'antd'
import { MUC_NHAC_BO_NHIEM, NAM_XET_KEO_DAI } from '@/utils/boNhiem'
import type { MucNhacBoNhiem } from '@/utils/boNhiem'
import { formatDate } from '@/utils/helpers'

/** Nhãn mức nhắc: các mức cần làm việc dùng nền đặc, chữ trắng để nhìn rõ */
export function TagMucBoNhiem({ muc, kemTen = true }: { muc: MucNhacBoNhiem; kemTen?: boolean }) {
  const m = MUC_NHAC_BO_NHIEM[muc]
  const kieu = m.nen ? { background: m.mau, borderColor: m.mau, color: '#fff', fontWeight: 600 } : undefined
  return (
    <Tooltip title={m.moTa}>
      <Tag color={m.nen ? undefined : m.mau} style={{ ...kieu, marginInlineEnd: 0 }}>{kemTen ? m.ten : ''}</Tag>
    </Tooltip>
  )
}

export function TagNhapQua5Nam({ ngayDaNhap }: { ngayDaNhap?: string }) {
  return (
    <Tooltip title={`Đã nhập hết nhiệm kỳ ${formatDate(ngayDaNhap)}, quá 5 năm; đang tính theo 5 năm. Kiểm tra lại quyết định.`}>
      <Tag color="error" style={{ marginInlineEnd: 0 }}>Nhiệm kỳ nhập quá 5 năm</Tag>
    </Tooltip>
  )
}

export function TagKeoDai({ ngayNghiHuu }: { ngayNghiHuu?: string }) {
  return (
    <Tooltip title={`Nghỉ hưu ngày ${formatDate(ngayNghiHuu)}, còn dưới ${NAM_XET_KEO_DAI} năm đến ngày hết nhiệm kỳ`}>
      <Tag color="purple" style={{ marginInlineEnd: 0 }}>Xem xét kéo dài</Tag>
    </Tooltip>
  )
}
