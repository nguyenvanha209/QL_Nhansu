import { createClient } from '@supabase/supabase-js'
import { createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase =
  supabaseUrl && supabaseKey && supabaseUrl.startsWith('https://')
    ? createClient(supabaseUrl, supabaseKey)
    : null

export const isSupabaseEnabled = !!supabase

// localStorage-first: reads from localStorage immediately (no async wait),
// then syncs to Supabase in the background when configured.
const hybridStorage: StateStorage = {
  getItem: (name: string): string | null => {
    // Always read from localStorage — instant, no network wait
    return localStorage.getItem(name)
  },

  setItem: (name: string, value: string): void => {
    localStorage.setItem(name, value)
    // Fire-and-forget sync to Supabase
    if (supabase) {
      supabase.from('app_state').upsert(
        { key: name, value: JSON.parse(value), updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      ).then(({ error }) => {
        if (error) console.warn('[Supabase sync error]', error.message)
      })
    }
  },

  removeItem: (name: string): void => {
    localStorage.removeItem(name)
    if (supabase) {
      supabase.from('app_state').delete().eq('key', name)
    }
  },
}

export const persistStorage = () => createJSONStorage(() => hybridStorage)
