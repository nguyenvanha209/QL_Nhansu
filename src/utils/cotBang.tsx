// ═══════════════════════════════════════════════════════════════════════════
// QUY CHUẨN BẢNG CỦA PHẦN MỀM
// Mọi bảng danh sách người / số liệu dùng các hàm dưới đây để trình bày thống nhất:
//
// 1. Khung bảng: thuộc tính BANG_CHUAN - cỡ nhỏ, kẻ khung, cuộn ngang theo nội dung (không bóp cột),
//    tiêu đề bảng dính trên khi cuộn dọc, phân trang 20 dòng có "Tổng N ...".
// 2. Cột đầu: STT (52px, giữa). Cột Họ và tên ngay sau, 200px, GHIM TRÁI khi cuộn ngang,
//    không cắt chữ, bấm tên mở hồ sơ (nếu có quyền), sắp xếp theo tên rồi họ.
// 3. MỌI cột phải có độ rộng. Không để cột chữ không có độ rộng mà bật cắt chữ - antd sẽ bóp cột
//    đó còn vài ký tự ("PH...", "GV ..."). Chữ dài (đơn vị, chức danh, ghi chú) dùng cotChu: có độ rộng,
//    cắt chữ kèm chú thích khi rê chuột.
// 4. Cột ngày, cột ngắn căn giữa (giới tính, nhãn, số, tuổi) KHÔNG xuống dòng - dòng nào cũng cao bằng nhau.
// 5. Độ rộng chuẩn: ngày 105 (giữa) · giới tính 75 (giữa) · đơn vị 190 · chức danh 220 (kèm mã ngạch nhỏ)
//    · chức vụ 110 · loại hình 160 · nhãn trạng thái 110-130 (giữa) · số 70-90 (giữa).
// 6. Trang: tiêu đề cấp 4 + một dòng mô tả phạm vi số liệu (chữ xám) → các ô thống kê (nếu có) → hàng
//    bộ lọc bên trái, nút Xuất Excel bên phải → bảng → ghi chú căn cứ (chữ xám nhỏ) dưới bảng.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactNode } from 'react'
import { Tooltip, Typography } from 'antd'
import type { TableProps } from 'antd'
import type { ColumnType } from 'antd/es/table'
import { formatDate } from '@/utils/helpers'

const { Text } = Typography

const KHONG_XUONG_DONG = { style: { whiteSpace: 'nowrap' as const } }

/** Thuộc tính khung bảng chuẩn: <Table {...BANG_CHUAN} ... /> (ghi đè pagination khi cần) */
export const BANG_CHUAN = {
  size: 'small',
  bordered: true,
  scroll: { x: 'max-content' },
  sticky: { offsetHeader: 0 },
  pagination: { pageSize: 20, showSizeChanger: false, showTotal: (t: number) => `Tổng ${t} dòng` },
} satisfies Partial<TableProps<object>>

/** Phân trang chuẩn với chữ tổng riêng, VD phanTrang('viên chức') → "Tổng 21 viên chức" */
export const phanTrang = (donVi: string, pageSize = 20) =>
  ({ pageSize, showSizeChanger: false, showTotal: (t: number) => `Tổng ${t} ${donVi}` })

/** STT theo thứ tự đang hiển thị (tính cả trang) */
export function cotSTT<T>(): ColumnType<T> {
  return {
    title: 'STT', key: 'stt', width: 52, align: 'center', fixed: 'left',
    render: (_v, _r, i) => i + 1,
  }
}

type CoTen = { ho: string; ten: string; id?: string }

/** Họ và tên: ghim trái, không cắt chữ, sắp theo tên rồi họ; truyền moHoSo để bấm mở hồ sơ */
export function cotHoTen<T extends CoTen>(moHoSo?: (r: T) => void, title = 'Họ và tên'): ColumnType<T> {
  return {
    title, key: 'hoTen', width: 200, fixed: 'left',
    sorter: (a, b) => a.ten.localeCompare(b.ten, 'vi') || a.ho.localeCompare(b.ho, 'vi'),
    render: (_v, r) => (moHoSo ? <a onClick={() => moHoSo(r)}>{r.ho} {r.ten}</a> : `${r.ho} ${r.ten}`),
  }
}

/** Ngày (dd/mm/yyyy), giữa; đậm khi là mốc chính của bảng */
export function cotNgay<T>(title: string, lay: (r: T) => string | undefined, opts: { dam?: boolean; width?: number; sapXep?: boolean } = {}): ColumnType<T> {
  return {
    title, key: `ngay-${title}`, width: opts.width ?? 105, align: 'center', onCell: () => KHONG_XUONG_DONG,
    sorter: opts.sapXep ? (a, b) => (lay(a) ?? '').localeCompare(lay(b) ?? '') : undefined,
    render: (_v, r) => {
      const s = formatDate(lay(r) ?? '')
      return opts.dam ? <Text strong>{s}</Text> : s
    },
  }
}

/** Cột chữ dài có độ rộng, cắt chữ kèm chú thích khi rê chuột; phu = dòng chữ xám nhỏ phía sau (VD mã ngạch) */
export function cotChu<T>(title: string, lay: (r: T) => string | undefined, width: number, opts: { phu?: (r: T) => string | undefined; sapXep?: boolean } = {}): ColumnType<T> {
  return {
    title, key: `chu-${title}`, width, ellipsis: { showTitle: false },
    sorter: opts.sapXep ? (a, b) => (lay(a) ?? '').localeCompare(lay(b) ?? '', 'vi') : undefined,
    render: (_v, r) => {
      const chinh = lay(r) ?? ''
      const phu = opts.phu?.(r)
      if (!chinh && !phu) return <Text type="secondary">-</Text>
      const day = phu ? `${chinh} (${phu})` : chinh
      return (
        <Tooltip title={day} placement="topLeft">
          <span>{chinh}{phu && <Text type="secondary" style={{ fontSize: 12 }}> ({phu})</Text>}</span>
        </Tooltip>
      )
    },
  }
}

/** Cột ngắn căn giữa (giới tính, nhãn, số) */
export function cotGiua<T>(title: ReactNode, key: string, width: number, render: (r: T) => ReactNode, sorter?: (a: T, b: T) => number): ColumnType<T> {
  return { title, key, width, align: 'center', sorter, onCell: () => KHONG_XUONG_DONG, render: (_v, r) => render(r) }
}

export const tenGioiTinh = (g?: string) => (g === 'NAM' ? 'Nam' : g === 'NU' ? 'Nữ' : '')
