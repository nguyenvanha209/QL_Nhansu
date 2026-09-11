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

// Gọi sau khi hợp nhất thành công, để store nạp lại đúng nội dung vừa ghi.
// Không có bước này thì bộ nhớ tại máy vẫn giữ bản cũ, lần ghi sau sẽ đè mất
// phần vừa hợp nhất của người khác.
type NapLai = (key: string) => void | Promise<void>
let napLai: NapLai | null = null
export function dangKyNapLai(fn: NapLai) {
  napLai = fn
}

const SO_LAN_THU_LAI = 3

const laMangCoId = (v: unknown): v is { id: string }[] =>
  Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')

// Gộp hai mảng theo id: giữ bản ghi của máy chủ mà máy này chưa biết, đồng thời
// ưu tiên bản ghi máy này vừa sửa. Nhờ vậy hai người sửa hai hồ sơ khác nhau
// không còn đè lên nhau.
function tronTheoId(mayChu: { id: string }[], cucBo: { id: string }[]) {
  const ra = new Map(mayChu.map((x) => [x.id, x]))
  for (const x of cucBo) ra.set(x.id, x)
  return [...ra.values()]
}

type KhoiTrangThai = { state?: Record<string, unknown> } & Record<string, unknown>

// Những id vừa bị xóa có chủ đích tại máy này, theo từng mảng.
type DaXoa = Record<string, string[]>

// So bản trước và sau của một lần ghi để biết người dùng vừa xóa hẳn bản ghi
// nào. Không có bước này thì khi trộn, bản ghi đã xóa sẽ từ máy chủ quay trở
// lại — xóa xong vẫn thấy còn.
function timDaXoa(truoc: string | null, sau: string): DaXoa {
  if (!truoc) return {}
  try {
    const a = (JSON.parse(truoc) as KhoiTrangThai)?.state ?? {}
    const b = (JSON.parse(sau) as KhoiTrangThai)?.state ?? {}
    const ra: DaXoa = {}
    for (const [k, va] of Object.entries(a)) {
      const vb = (b as Record<string, unknown>)[k]
      if (!laMangCoId(va) || !laMangCoId(vb)) continue
      const conLai = new Set(vb.map((x) => x.id))
      const mat = va.filter((x) => !conLai.has(x.id)).map((x) => x.id)
      if (mat.length) ra[k] = mat
    }
    return ra
  } catch {
    return {}
  }
}

function tronTrangThai(mayChu: KhoiTrangThai, cucBo: KhoiTrangThai, daXoa: DaXoa = {}): KhoiTrangThai {
  if (!mayChu?.state || !cucBo?.state) return cucBo
  const state: Record<string, unknown> = { ...mayChu.state }

  for (const [k, vCucBo] of Object.entries(cucBo.state)) {
    const vMayChu = mayChu.state[k]
    // Chỉ trộn được những mảng bản ghi có id. Còn lại lấy theo máy này, vì đó
    // là ý định của người vừa thao tác.
    if (!laMangCoId(vCucBo) || !laMangCoId(vMayChu)) {
      state[k] = vCucBo
      continue
    }
    const boXoa = new Set(daXoa[k] ?? [])
    state[k] = tronTheoId(vMayChu.filter((x) => !boXoa.has(x.id)), vCucBo)
  }
  return { ...cucBo, state }
}

async function layBanMayChu(name: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('app_state')
    .select('value, updated_at')
    .eq('key', name)
    .maybeSingle()
  if (error || !data) return null
  return data as { value: KhoiTrangThai; updated_at: string }
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

function xepHangGhi(name: string, value: string, daXoa: DaXoa) {
  const truoc = hangCho.get(name) ?? Promise.resolve()
  const tiep = truoc.then(() => ghiLenMayChu(name, value, 0, daXoa)).catch(() => {})
  hangCho.set(name, tiep)
}

async function ghiLenMayChu(name: string, value: string, lanThu = 0, daXoa: DaXoa = {}): Promise<void> {
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
    // Máy chủ đã đổi sau lần đọc gần nhất. Không ghi đè, nhưng cũng không bỏ
    // cuộc: tải bản mới, trộn theo từng bản ghi rồi ghi lại. Hai người sửa hai
    // hồ sơ khác nhau sẽ cùng giữ được thay đổi của mình.
    if (lanThu >= SO_LAN_THU_LAI) {
      console.warn(`[Supabase] "${name}": hợp nhất ${SO_LAN_THU_LAI} lần vẫn xung đột, dừng lại để khỏi ghi đè.`)
      xuLyXungDot?.(name)
      return
    }

    const banMayChu = await layBanMayChu(name)
    if (!banMayChu) {
      console.warn(`[Supabase] "${name}": xung đột nhưng không đọc lại được máy chủ.`)
      xuLyXungDot?.(name)
      return
    }

    ghiNhanPhienBan(name, banMayChu.updated_at)
    const hopNhat = tronTrangThai(banMayChu.value, parsed as KhoiTrangThai, daXoa)
    console.info(`[Supabase] "${name}": máy chủ đã thay đổi — đã hợp nhất và ghi lại (lần ${lanThu + 1}).`)

    await ghiLenMayChu(name, JSON.stringify(hopNhat), lanThu + 1, daXoa)

    // Nạp lại để bộ nhớ tại máy khớp với nội dung vừa ghi lên máy chủ
    localStorage.setItem(name, JSON.stringify(hopNhat))
    await napLai?.(name)
    return
  }

  ghiNhanPhienBan(name, data[0].updated_at)
}

// Đọc luôn từ localStorage nên giao diện hiện tức thì, không chờ mạng.
// Việc ghi lên máy chủ chạy nền, có kiểm tra phiên bản như trên.
const hybridStorage: StateStorage = {
  getItem: (name: string): string | null => localStorage.getItem(name),

  setItem: (name: string, value: string): void => {
    // Phải đọc bản cũ TRƯỚC khi ghi đè, để biết lần này người dùng xóa hẳn
    // bản ghi nào — dùng khi hợp nhất lúc có xung đột.
    const daXoa = supabase && !dangDongBo ? timDaXoa(localStorage.getItem(name), value) : {}
    localStorage.setItem(name, value)
    if (supabase && !dangDongBo) xepHangGhi(name, value, daXoa)
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
