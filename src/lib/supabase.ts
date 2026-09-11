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

// ───────────────────────────────────────────────────────────────────────────
// Khoá lạc quan (optimistic locking)
//
// Trước đây mỗi lần ghi là một lệnh upsert mù: ai ghi sau thắng. Một máy giữ
// dữ liệu cũ trong bộ nhớ sẽ đè sạch dữ liệu mới trên máy chủ mà không ai hay.
// Sự cố này đã xảy ra hai lần: xoá mất lương của 52 hồ sơ vừa nhập, và một tab
// mở từ phiên bản cũ ghi đè dữ liệu tài khoản.
//
// Nay mỗi lần ghi đều kèm điều kiện "bản trên máy chủ phải đúng phiên bản tôi
// đã đọc". Không khớp nghĩa là có người khác vừa ghi — lệnh ghi bị từ chối và
// hệ thống tải lại bản mới thay vì đè lên.
// ───────────────────────────────────────────────────────────────────────────

const phienBanMayChu = new Map<string, string>()

export function ghiNhanPhienBan(key: string, updatedAt: string | null) {
  if (updatedAt) phienBanMayChu.set(key, updatedAt)
}

type XuLyXungDot = (key: string) => void
let xuLyXungDot: XuLyXungDot | null = null
export function dangKyXuLyXungDot(fn: XuLyXungDot) {
  xuLyXungDot = fn
}

// Trong lúc kéo dữ liệu từ máy chủ về, việc rehydrate có thể kích hoạt ghi
// ngược lên — phải khoá lại, nếu không sẽ thành vòng lặp ghi.
let dangDongBo = false
export function datCoDangDongBo(bat: boolean) {
  dangDongBo = bat
}

// Mỗi key ghi tuần tự, tránh hai lệnh ghi cùng key chạy song song rồi tự xung
// đột với chính mình.
const hangCho = new Map<string, Promise<void>>()

function xepHangGhi(name: string, value: string) {
  const truoc = hangCho.get(name) ?? Promise.resolve()
  const tiep = truoc.then(() => ghiLenMayChu(name, value)).catch(() => {})
  hangCho.set(name, tiep)
}

async function ghiLenMayChu(name: string, value: string): Promise<void> {
  if (!supabase) return

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    console.error('[Supabase] Bỏ qua lệnh ghi: dữ liệu không phải JSON hợp lệ —', name)
    return
  }

  const banDaBiet = phienBanMayChu.get(name)
  const bayGio = new Date().toISOString()

  // Chưa từng đọc được bản ghi này từ máy chủ: chỉ được phép tạo mới, tuyệt đối
  // không ghi đè bản có sẵn (đó chính là kiểu ghi mù đã gây mất dữ liệu).
  if (!banDaBiet) {
    const { data, error } = await supabase
      .from('app_state')
      .insert({ key: name, value: parsed, updated_at: bayGio })
      .select('updated_at')

    if (error) {
      // Mã 23505 = trùng khoá chính: bản ghi đã tồn tại mà máy này chưa đọc.
      if (error.code === '23505') {
        console.warn(`[Supabase] "${name}" đã có trên máy chủ nhưng máy này chưa đọc — tải lại thay vì ghi đè.`)
        xuLyXungDot?.(name)
      } else {
        console.warn('[Supabase] Lỗi khi tạo bản ghi', name, '—', error.message)
      }
      return
    }
    ghiNhanPhienBan(name, data?.[0]?.updated_at ?? null)
    return
  }

  const { data, error } = await supabase
    .from('app_state')
    .update({ value: parsed, updated_at: bayGio })
    .eq('key', name)
    .eq('updated_at', banDaBiet)
    .select('updated_at')

  if (error) {
    console.warn('[Supabase] Lỗi khi ghi', name, '—', error.message)
    return
  }

  if (!data || data.length === 0) {
    console.warn(`[Supabase] Xung đột phiên bản ở "${name}": máy chủ đã thay đổi sau lần đọc gần nhất. Không ghi đè.`)
    xuLyXungDot?.(name)
    return
  }

  ghiNhanPhienBan(name, data[0].updated_at)
}

// Đọc luôn từ localStorage nên giao diện hiện tức thì, không chờ mạng.
// Việc ghi lên máy chủ chạy nền, có kiểm tra phiên bản như trên.
const hybridStorage: StateStorage = {
  getItem: (name: string): string | null => localStorage.getItem(name),

  setItem: (name: string, value: string): void => {
    localStorage.setItem(name, value)
    if (supabase && !dangDongBo) xepHangGhi(name, value)
  },

  removeItem: (name: string): void => {
    localStorage.removeItem(name)
    if (supabase && !dangDongBo) {
      supabase.from('app_state').delete().eq('key', name).then(({ error }) => {
        if (error) console.warn('[Supabase] Lỗi khi xoá', name, '—', error.message)
        else phienBanMayChu.delete(name)
      })
    }
  },
}

export const persistStorage = () => createJSONStorage(() => hybridStorage)
