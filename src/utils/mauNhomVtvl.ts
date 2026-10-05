/** Màu nhận diện 3 nhóm vị trí việc làm (và ngoài danh mục) - dùng chung cho bảng định mức, tổng hợp, báo cáo, Excel */
export const MAU_NHOM_VTVL: Record<string, { nen: string; tieuDe: string; vien: string; argbNen: string; argbTieuDe: string }> = {
  QUAN_LY: { nen: '#eff6ff', tieuDe: '#dbeafe', vien: '#2563eb', argbNen: 'FFEFF6FF', argbTieuDe: 'FFDBEAFE' },
  CHUYEN_MON: { nen: '#f0fdf4', tieuDe: '#dcfce7', vien: '#16a34a', argbNen: 'FFF0FDF4', argbTieuDe: 'FFDCFCE7' },
  HO_TRO: { nen: '#fffbeb', tieuDe: '#fef3c7', vien: '#d97706', argbNen: 'FFFFFBEB', argbTieuDe: 'FFFEF3C7' },
  NGOAI_DM: { nen: '#f8fafc', tieuDe: '#e2e8f0', vien: '#64748b', argbNen: 'FFF8FAFC', argbTieuDe: 'FFE2E8F0' },
}
