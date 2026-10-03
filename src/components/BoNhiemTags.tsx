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

export function TagKeoDai({ ngayNghiHuu }: { ngayNghiHuu?: string }) {
  return (
    <Tooltip title={`Nghỉ hưu ngày ${formatDate(ngayNghiHuu)} - còn dưới ${NAM_XET_KEO_DAI} năm tính đến ngày hết nhiệm kỳ: xem xét kéo dài thời hạn giữ chức vụ đến khi nghỉ hưu thay vì bổ nhiệm lại`}>
      <Tag color="purple" style={{ marginInlineEnd: 0 }}>Xem xét kéo dài</Tag>
    </Tooltip>
  )
}
