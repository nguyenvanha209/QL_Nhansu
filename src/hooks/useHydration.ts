import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useDeXuatStore } from '@/store/deXuatStore'

// Returns true once all Zustand persist stores have loaded from storage
export function useHydration() {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stores = [
      useAuthStore,
      useUserStore,
      useDanhMucStore,
      useVienChucStore,
      useLuongStore,
      useDeXuatStore,
    ]

    // Trigger rehydration on all stores then check completion
    Promise.all(stores.map((s) => s.persist.rehydrate())).then(() => {
      setHydrated(true)
    })
  }, [])

  return hydrated
}
