export type LoaiDonVi = 'MAM_NON' | 'TIEU_HOC' | 'THCS' | 'OTHER'

export interface DonVi {
  id: string
  ma: string
  ten: string
  loai: LoaiDonVi
  diaChi?: string
  hieuTruong?: string
  active: boolean
  createdAt: string
}

export const LOAI_DON_VI_LABELS: Record<LoaiDonVi, string> = {
  MAM_NON: 'Mầm non',
  TIEU_HOC: 'Tiểu học',
  THCS: 'THCS',
  OTHER: 'Khác',
}
