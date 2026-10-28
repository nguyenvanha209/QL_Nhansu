import { useMemo } from 'react'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { QUY_DINH_KE_TOAN_MAC_DINH, MUC_CAN_NHAC_KE_TOAN, danhSachKeToan } from '@/utils/chuyenDoiKeToan'

/** Kế toán các trường kèm tình trạng định kỳ chuyển đổi vị trí công tác; `canNhac` = đến mốc nhắc */
export function useChuyenDoiKeToan(scopeDonViId?: string | null) {
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const quyDinh = useDanhMucStore((s) => s.quyDinhKeToan) ?? QUY_DINH_KE_TOAN_MAC_DINH
  return useMemo(() => {
    const tatCa = danhSachKeToan(vienChucs, quyDinh, scopeDonViId)
    return {
      quyDinh,
      tatCa,
      canNhac: tatCa.filter((t) => MUC_CAN_NHAC_KE_TOAN.includes(t.muc)),
      chuaNhap: tatCa.filter((t) => t.muc === 'CHUA_NHAP'),
    }
  }, [vienChucs, quyDinh, scopeDonViId])
}
