import type { BacLuong } from '@/types/danhMuc'

// Bảng hệ số lương viên chức (NĐ 204/2004/NĐ-CP, bảng 3) - dùng sinh bảng bậc khi
// thêm chức danh hoặc đổi bảng lương của chức danh ở trang Danh mục.
export const BANG_LUONG_CHUAN: Record<string, { heSos: number[]; thoiGian: 2 | 3 }> = {
  'A2.1': { heSos: [4.4, 4.74, 5.08, 5.42, 5.76, 6.1, 6.44, 6.78], thoiGian: 3 },
  'A2.2': { heSos: [4.0, 4.34, 4.68, 5.02, 5.36, 5.7, 6.04, 6.38], thoiGian: 3 },
  A1: { heSos: [2.34, 2.67, 3.0, 3.33, 3.66, 3.99, 4.32, 4.65, 4.98], thoiGian: 3 },
  A0: { heSos: [2.1, 2.41, 2.72, 3.03, 3.34, 3.65, 3.96, 4.27, 4.58, 4.89], thoiGian: 3 },
  B: { heSos: [1.86, 2.06, 2.26, 2.46, 2.66, 2.86, 3.06, 3.26, 3.46, 3.66, 3.86, 4.06], thoiGian: 2 },
}

const chuanHoa = (bangLuong?: string) => (bangLuong ?? '').toUpperCase().replace(/\s/g, '')

/** Bảng bậc chuẩn của chức danh theo bảng lương; undefined nếu bảng lương không có trong danh sách chuẩn */
export function bacLuongTheoBang(chucDanhId: string, bangLuong?: string): BacLuong[] | undefined {
  const bang = BANG_LUONG_CHUAN[chuanHoa(bangLuong)]
  if (!bang) return undefined
  return bang.heSos.map((heSo, i) => ({
    id: `bl_${chucDanhId}_${i + 1}`, chucDanhId, bac: i + 1, heSo, thoiGianNangLuong: bang.thoiGian,
  }))
}

/** Bảng bậc hiện có của chức danh đã khớp đúng bảng lương chuẩn chưa */
export function bacLuongKhopBang(hienCo: BacLuong[], chuan: BacLuong[]) {
  const ds = [...hienCo].sort((a, b) => a.bac - b.bac)
  return ds.length === chuan.length
    && ds.every((b, i) => b.bac === chuan[i].bac && b.heSo === chuan[i].heSo && b.thoiGianNangLuong === chuan[i].thoiGianNangLuong)
}
