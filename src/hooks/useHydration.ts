import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useDeXuatStore } from '@/store/deXuatStore'

const stores = [
  useAuthStore,
  useUserStore,
  useDanhMucStore,
  useVienChucStore,
  useLuongStore,
  useDeXuatStore,
] as const

export function useHydration() {
  const [hydrated, setHydrated] = useState(() =>
    stores.every((s) => s.persist.hasHydrated())
  )

  useEffect(() => {
    if (hydrated) return

    let done = 0
    const total = stores.length
    const check = () => { if (++done >= total) setHydrated(true) }

    const unsubs = stores.map((store) => {
      if (store.persist.hasHydrated()) { check(); return () => {} }
      const unsub = store.persist.onFinishHydration(check)
      store.persist.rehydrate()
      return unsub
    })

    return () => unsubs.forEach((u) => u())
  }, [hydrated])

  return hydrated
}
