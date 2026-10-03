import { useMemo } from 'react'
import { useVienChucStore } from '@/store/vienChucStore'
import { danhSachBoNhiem, MUC_CAN_NHAC } from '@/utils/boNhiem'

/** Danh sách HT/P.HT kèm tình trạng nhiệm kỳ trong phạm vi tài khoản; `canNhac` = các trường hợp đến mốc nhắc */
export function useBoNhiem(scopeDonViId?: string | null) {
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  return useMemo(() => {
    const tatCa = danhSachBoNhiem(vienChucs, scopeDonViId)
    return {
      tatCa,
      canNhac: tatCa.filter((t) => MUC_CAN_NHAC.includes(t.muc)),
      chuaNhap: tatCa.filter((t) => t.muc === 'CHUA_NHAP'),
    }
  }, [vienChucs, scopeDonViId])
}
