import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useChuyenCongTacStore } from '@/store/chuyenCongTacStore'

const stores = [
  useAuthStore,
  useUserStore,
  useDanhMucStore,
  useVienChucStore,
  useLuongStore,
  useDeXuatStore,
  useChuyenCongTacStore,
] as const

export function useHydration() {
  const [hydrated, setHydrated] = useState(() =>
    stores.every((s) => s.persist.hasHydrated())
  )

  useEffect(() => {
    if (hydrated) return

    // Safety net: if stores don't finish in 4s, proceed anyway
    const timeout = setTimeout(() => setHydrated(true), 4000)

    let done = 0
    const check = () => { if (++done >= stores.length) setHydrated(true) }

    const unsubs = stores.map((store) => {
      if (store.persist.hasHydrated()) { check(); return () => {} }
      return store.persist.onFinishHydration(check)
    })

    return () => {
      clearTimeout(timeout)
      unsubs.forEach((u) => u())
    }
  }, [hydrated])

  return hydrated
}
