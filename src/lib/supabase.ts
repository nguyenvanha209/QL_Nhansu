import { createClient } from '@supabase/supabase-js'
import { createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

// Async storage adapter — syncs to Supabase when configured, falls back to localStorage
const supabaseStateStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!supabase) return localStorage.getItem(name)
    const { data, error } = await supabase
      .from('app_state')
      .select('value')
      .eq('key', name)
      .maybeSingle()
    if (error || !data) return null
    return JSON.stringify(data.value)
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (!supabase) { localStorage.setItem(name, value); return }
    await supabase.from('app_state').upsert(
      { key: name, value: JSON.parse(value), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  },

  removeItem: async (name: string): Promise<void> => {
    if (!supabase) { localStorage.removeItem(name); return }
    await supabase.from('app_state').delete().eq('key', name)
  },
}

// Use this as the storage option in every Zustand persist config
export const persistStorage = () => createJSONStorage(() => supabaseStateStorage)

export const isSupabaseEnabled = !!supabase
