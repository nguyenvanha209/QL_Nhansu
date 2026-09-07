import { supabase } from './supabase'
import { useAuthStore } from '@/store/authStore'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useDeXuatStore } from '@/store/deXuatStore'

const STORES = [
  useAuthStore,
  useUserStore,
  useDanhMucStore,
  useVienChucStore,
  useLuongStore,
  useDeXuatStore,
]

// Pull all app state from Supabase into localStorage, then rehydrate all stores.
// Returns true if data was found in Supabase, false if table is empty / unreachable.
export async function syncFromSupabase(): Promise<boolean> {
  if (!supabase) return false

  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('key, value')

    if (error || !data || data.length === 0) return false

    // Write Supabase data into localStorage so rehydrate() picks it up
    for (const row of data) {
      localStorage.setItem(row.key, JSON.stringify(row.value))
    }

    // Rehydrate all stores from the updated localStorage
    await Promise.all(STORES.map((s) => s.persist.rehydrate()))
    return true
  } catch {
    return false
  }
}
