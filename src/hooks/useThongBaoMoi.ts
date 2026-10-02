import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useThongBaoStore } from '@/store/thongBaoStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import type { CapHocTB } from '@/types/thongBao'
import { demThongBaoMoi } from '@/utils/thongBaoDaXem'

/** Số thông báo kết quả đã ban hành mà người đang đăng nhập chưa mở - trường chỉ tính phần cấp học của mình */
export function useThongBaoMoi(): number {
  const { currentUser, scopeDonViId } = useAuth()
  const thongBaos = useThongBaoStore((s) => s.thongBaos)
  const loaiTruong = useDanhMucStore((s) => s.donVis.find((d) => d.id === scopeDonViId)?.loai)
  const capTruong = scopeDonViId
    ? (loaiTruong === 'MAM_NON' || loaiTruong === 'TIEU_HOC' || loaiTruong === 'THCS' ? loaiTruong as CapHocTB : 'KHONG' as CapHocTB)
    : null
  const [, veLai] = useState(0)
  useEffect(() => {
    const fn = () => veLai((n) => n + 1)
    window.addEventListener('qlvc-tb-da-xem', fn)
    return () => window.removeEventListener('qlvc-tb-da-xem', fn)
  }, [])
  return demThongBaoMoi(thongBaos, currentUser?.id, capTruong)
}
