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

// Gộp hai mảng theo id (bản sau thắng) — chỉ dùng khi ghép các mảnh của CÙNG một bản máy chủ lại
function tronTheoId(truoc: { id: string }[], sau: { id: string }[]) {
  const ra = new Map(truoc.map((x) => [x.id, x]))
  for (const x of sau) ra.set(x.id, x)
  return [...ra.values()]
}

export type KhoiTrangThai = { state?: Record<string, unknown> } & Record<string, unknown>

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

// ───────────────────────────────────────────────────────────────────────────
// Hợp nhất 3 chiều
//
// Trước đây khi xung đột, MỌI bản ghi có ở máy này đều đè lên máy chủ — kể cả
// bản ghi máy này không hề sửa. Máy mở từ sáng (Admin, lãnh đạo) chỉ cần lưu một
// thao tác bất kỳ là trả lại dữ liệu buổi sáng cho những hồ sơ Kế toán vừa sửa
// (đã xảy ra: hồ sơ quay về mã ngạch cũ, bản ghi lương cũ bật lại → 2 bản ghi).
//
// Nay mỗi máy nhớ "bản gốc" — nội dung từng bản ghi lúc đọc được từ máy chủ.
// So 3 bản (gốc / máy chủ / máy này) cho từng bản ghi:
//   - máy này không sửa        → lấy bản máy chủ
//   - chỉ máy này sửa           → lấy bản máy này
//   - cả hai cùng sửa (hiếm)    → lấy bản có thời điểm sửa mới hơn, và báo người dùng
// ───────────────────────────────────────────────────────────────────────────

type BanGoc = { mang: Map<string, Map<string, string>>; khac: Map<string, string> }
const banGoc = new Map<string, BanGoc>()

function layBanGoc(kho: string): BanGoc {
  let g = banGoc.get(kho)
  if (!g) {
    g = { mang: new Map(), khac: new Map() }
    banGoc.set(kho, g)
  }
  return g
}

/** Ghi nhận nội dung đã khớp với máy chủ làm bản gốc. thayToanBo = true khi đó là toàn bộ kho. */
export function ghiNhanBanGoc(kho: string, state: Record<string, unknown> | undefined, thayToanBo = false) {
  if (!state) return
  const g = layBanGoc(kho)
  if (thayToanBo) {
    g.mang.clear()
    g.khac.clear()
  }
  for (const [k, v] of Object.entries(state)) {
    if (laMangCoId(v)) {
      let m = g.mang.get(k)
      if (!m) g.mang.set(k, (m = new Map()))
      for (const bg of v) m.set(bg.id, JSON.stringify(bg))
    } else {
      g.khac.set(k, JSON.stringify(v))
    }
  }
}

function boBanGoc(kho: string, daXoa: DaXoa) {
  const g = banGoc.get(kho)
  if (!g) return
  for (const [k, ids] of Object.entries(daXoa)) for (const id of ids) g.mang.get(k)?.delete(id)
}

// Thời điểm sửa của một bản ghi để phân định khi hai máy cùng sửa
const thoiDiemSua = (bg: Record<string, unknown>) =>
  String(bg.updatedAt ?? bg.createdAt ?? bg.thoiGian ?? '')

type BaoXungDot = (ds: { kho: string; soBanGhi: number }[]) => void
let baoXungDot: BaoXungDot | null = null
export function dangKyBaoXungDotBanGhi(fn: BaoXungDot) {
  baoXungDot = fn
}

/**
 * Hợp nhất 3 chiều bản máy chủ với bản máy này.
 * idsConLaiTaiMay: id đang có trong TOÀN BỘ kho ở máy này — với kho chia mảnh, bản ghi vắng
 * mặt trong mảnh này nhưng còn ở mảnh khác là đã chuyển mảnh (VD đổi trường), không phải bị xoá.
 */
export function hopNhat3Chieu(
  kho: string,
  mayChu: KhoiTrangThai,
  cucBo: KhoiTrangThai,
  daXoa: DaXoa = {},
  idsConLaiTaiMay?: Map<string, Set<string>>,
): { khoi: KhoiTrangThai; soXungDot: number } {
  if (!mayChu?.state || !cucBo?.state) return { khoi: cucBo, soXungDot: 0 }
  const g = layBanGoc(kho)
  const state: Record<string, unknown> = { ...mayChu.state }
  let soXungDot = 0

  const tenCacMang = new Set([...Object.keys(mayChu.state), ...Object.keys(cucBo.state)])
  for (const k of tenCacMang) {
    const vMayChu = mayChu.state[k]
    const vCucBo = cucBo.state[k]

    if (!laMangCoId(vCucBo) || !laMangCoId(vMayChu)) {
      // Giá trị đơn (không phải mảng bản ghi): máy này chưa đổi thì theo máy chủ
      if (vCucBo === undefined) continue
      const goc = g.khac.get(k)
      state[k] = goc !== undefined && JSON.stringify(vCucBo) === goc && vMayChu !== undefined ? vMayChu : vCucBo
      continue
    }

    const gocMang = g.mang.get(k) ?? new Map<string, string>()
    const boXoa = new Set(daXoa[k] ?? [])
    const conLai = idsConLaiTaiMay?.get(k)
    const theoIdMayChu = new Map(vMayChu.map((x) => [x.id, x]))
    const theoIdCucBo = new Map(vCucBo.map((x) => [x.id, x]))
    const ra: { id: string }[] = []

    for (const id of new Set([...theoIdMayChu.keys(), ...theoIdCucBo.keys()])) {
      const sv = theoIdMayChu.get(id)
      const lc = theoIdCucBo.get(id)
      const goc = gocMang.get(id)

      if (!lc) {
        if (!sv) continue
        if (boXoa.has(id)) continue // máy này vừa xoá có chủ đích
        if (conLai?.has(id)) continue // đã chuyển sang mảnh khác ở máy này
        // Máy này không có: bản mới của người khác → giữ. Máy này từng có (bản gốc)
        // mà nay không còn và máy chủ vẫn y như gốc → máy này đã xoá → bỏ.
        if (goc !== undefined && JSON.stringify(sv) === goc) continue
        ra.push(sv)
        continue
      }
      if (!sv) {
        // Máy chủ không có: máy này tạo mới → giữ. Có trong bản gốc tức người khác
        // đã xoá: máy này không sửa gì thì tôn trọng việc xoá, có sửa thì giữ lại.
        if (goc !== undefined && JSON.stringify(lc) === goc) continue
        ra.push(lc)
        continue
      }

      const jLc = JSON.stringify(lc)
      const jSv = JSON.stringify(sv)
      if (jLc === jSv) { ra.push(sv); continue }
      if (goc === undefined) {
        // Không có bản gốc (chưa từng đọc được) → không biết ai sửa: lấy bản sửa sau
        ra.push(thoiDiemSua(lc as Record<string, unknown>) >= thoiDiemSua(sv as Record<string, unknown>) ? lc : sv)
        continue
      }
      if (jLc === goc) { ra.push(sv); continue } // máy này không sửa
      if (jSv === goc) { ra.push(lc); continue } // chỉ máy này sửa
      // Cả hai cùng sửa một bản ghi
      soXungDot++
      ra.push(thoiDiemSua(lc as Record<string, unknown>) >= thoiDiemSua(sv as Record<string, unknown>) ? lc : sv)
    }
    state[k] = ra
  }
  return { khoi: { ...cucBo, state }, soXungDot }
}

// ───────────────────────────────────────────────────────────────────────────
// Chia kho theo đơn vị
//
// Toàn bộ lương của 11 trường trước đây nằm chung một ô 567KB. Mỗi lần lưu bất
// cứ thứ gì đều phải ghi lại cả ô, nên vừa chậm vừa hay đụng nhau.
//
// Nay mỗi trường một ô riêng: sửa hồ sơ trường nào chỉ ghi ô trường đó, khoảng
// vài chục KB. Hai trường khác nhau thao tác cùng lúc thì không còn liên quan
// gì tới nhau.
//
// Bộ nhớ tại máy và các store vẫn giữ nguyên một mảng gộp như cũ — việc chia
// chỉ diễn ra ở lớp này khi ghi lên máy chủ.
// ───────────────────────────────────────────────────────────────────────────

export const KHOA_GOC = '_goc' // phần không chia được: trường vô hướng, mảng không có id
const NGAN_CACH = '::'

type ChiaTheo = (banGhi: Record<string, unknown>, tenMang: string) => string
const cauHinhChia = new Map<string, ChiaTheo>()

export function dangKyChiaKho(ten: string, chiaTheo: ChiaTheo) {
  cauHinhChia.set(ten, chiaTheo)
}

export const laKhoChia = (ten: string) => cauHinhChia.has(ten)
export const khoaManh = (ten: string, manh: string) => `${ten}${NGAN_CACH}${manh}`
export const tachKhoa = (khoa: string) => {
  const i = khoa.indexOf(NGAN_CACH)
  return i < 0 ? { ten: khoa, manh: null } : { ten: khoa.slice(0, i), manh: khoa.slice(i + NGAN_CACH.length) }
}

// Nội dung mảnh đã ghi lần gần nhất, để bỏ qua những mảnh không đổi.
// Đây chính là chỗ tiết kiệm: sửa một trường thì 10 mảnh còn lại không phải ghi.
const manhDaGhi = new Map<string, string>()

function chiaTrangThai(ten: string, khoi: KhoiTrangThai): Map<string, KhoiTrangThai> {
  const chiaTheo = cauHinhChia.get(ten)!
  const state = khoi.state ?? {}
  const ra = new Map<string, Record<string, unknown>>()

  const lay = (manh: string) => {
    if (!ra.has(manh)) ra.set(manh, {})
    return ra.get(manh)!
  }
  lay(KHOA_GOC)

  for (const [tenMang, giaTri] of Object.entries(state)) {
    if (!laMangCoId(giaTri)) {
      lay(KHOA_GOC)[tenMang] = giaTri
      continue
    }
    // Mảng có id thì rải từng bản ghi về mảnh của nó. Mọi mảnh đều phải có khoá
    // này, kể cả khi rỗng — thiếu thì lúc gộp lại sẽ tưởng mảng không tồn tại.
    for (const manh of ra.keys()) lay(manh)[tenMang] = []
    for (const bg of giaTri) {
      const manh = chiaTheo(bg as Record<string, unknown>, tenMang) || KHOA_GOC
      const o = lay(manh)
      if (!Array.isArray(o[tenMang])) o[tenMang] = []
      ;(o[tenMang] as unknown[]).push(bg)
    }
    for (const o of ra.values()) if (!Array.isArray(o[tenMang])) o[tenMang] = []
  }

  const kq = new Map<string, KhoiTrangThai>()
  for (const [manh, state2] of ra) kq.set(manh, { ...khoi, state: state2 })
  return kq
}

// Gộp các mảnh (và ô cũ chưa chia, nếu còn) thành một khối như store vẫn đọc
export function gopCacManh(manhList: KhoiTrangThai[]): KhoiTrangThai | null {
  if (!manhList.length) return null
  const goc = manhList[0]
  const state: Record<string, unknown> = {}

  for (const m of manhList) {
    for (const [k, v] of Object.entries(m.state ?? {})) {
      if (laMangCoId(v)) {
        const daCo = state[k]
        state[k] = laMangCoId(daCo) ? tronTheoId(daCo, v) : v
      } else if (!(k in state)) {
        state[k] = v
      }
    }
  }
  return { ...goc, state }
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
let soLenhDangGhi = 0

function xepHangGhi(name: string, value: string, daXoa: DaXoa) {
  const truoc = hangCho.get(name) ?? Promise.resolve()
  const viec = laKhoChia(name)
    ? () => ghiTheoManh(name, value, daXoa)
    : () => ghiLenMayChu(name, value, 0, daXoa)
  soLenhDangGhi++
  const tiep = truoc.then(viec).catch(() => {}).finally(() => { soLenhDangGhi-- })
  hangCho.set(name, tiep)
}

/** Chờ mọi lệnh ghi đang xếp hàng xong */
export async function choGhiXong() {
  while (soLenhDangGhi > 0) await Promise.all([...hangCho.values()])
}

// id đang có trong toàn bộ kho ở máy này (để nhận ra bản ghi chuyển mảnh, không phải bị xoá)
function idsToanKhoTaiMay(ten: string): Map<string, Set<string>> {
  const ra = new Map<string, Set<string>>()
  try {
    const state = (JSON.parse(localStorage.getItem(ten) ?? '{}') as KhoiTrangThai).state ?? {}
    for (const [k, v] of Object.entries(state)) if (laMangCoId(v)) ra.set(k, new Set(v.map((x) => x.id)))
  } catch { /* bỏ qua */ }
  return ra
}

// Đưa nội dung một mảnh (đã khớp máy chủ) vào kho gộp ở máy này rồi nạp lại store.
// Trước đây sau khi hợp nhất một mảnh, phần mềm lưu nhầm vào khoá mảnh trong
// localStorage nên store vẫn giữ bản cũ — lần ghi sau lại xung đột.
async function apDungManhVaoKho(ten: string, manh: string, noiDung: KhoiTrangThai) {
  const chiaTheo = cauHinhChia.get(ten)
  if (!chiaTheo) return
  let khoi: KhoiTrangThai
  try {
    khoi = JSON.parse(localStorage.getItem(ten) ?? '{}') as KhoiTrangThai
  } catch {
    return
  }
  const state: Record<string, unknown> = { ...(khoi.state ?? {}) }
  for (const [k, v] of Object.entries(noiDung.state ?? {})) {
    if (!laMangCoId(v)) {
      if (manh === KHOA_GOC) state[k] = v
      continue
    }
    const idsMoi = new Set(v.map((x) => x.id))
    const cu = laMangCoId(state[k]) ? (state[k] as { id: string }[]) : []
    state[k] = [
      ...cu.filter((bg) => !idsMoi.has(bg.id) && (chiaTheo(bg as Record<string, unknown>, k) || KHOA_GOC) !== manh),
      ...v,
    ]
  }
  const moi = { ...khoi, state }
  dangDongBo = true
  try {
    localStorage.setItem(ten, JSON.stringify(moi))
    await napLai?.(ten)
  } finally {
    dangDongBo = false
  }
  const json = chiaTrangThai(ten, moi).get(manh)
  if (json) manhDaGhi.set(khoaManh(ten, manh), JSON.stringify(json))
}

// Chia khối thành từng mảnh rồi chỉ ghi những mảnh thực sự đổi.
async function ghiTheoManh(name: string, value: string, daXoa: DaXoa): Promise<void> {
  let khoi: KhoiTrangThai
  try {
    khoi = JSON.parse(value) as KhoiTrangThai
  } catch {
    console.error('[Supabase] Bỏ qua lệnh ghi: dữ liệu không phải JSON hợp lệ —', name)
    return
  }

  const cacManh = chiaTrangThai(name, khoi)
  let soGhi = 0

  for (const [manh, noiDung] of cacManh) {
    const khoa = khoaManh(name, manh)
    const json = JSON.stringify(noiDung)
    if (manhDaGhi.get(khoa) === json) continue // mảnh không đổi, khỏi ghi

    await ghiLenMayChu(khoa, json, 0, daXoa)
    manhDaGhi.set(khoa, json)
    soGhi++
  }

  if (soGhi) {
    const kb = Math.round(value.length / 1024)
    console.info(`[Supabase] "${name}": ghi ${soGhi}/${cacManh.size} mảnh (khối gộp ${kb} KB)`)
  }

  await donODangCu(name)
}

// Ô cũ chưa chia vẫn giữ nguyên toàn bộ dữ liệu. Để nguyên thì mỗi lần đồng bộ
// lại gộp nó vào, và bản ghi vừa xoá sẽ từ đó sống lại. Sau khi đã chia xong
// thì dọn đi. Máy nào còn chạy bản cũ mà ghi lại vào ô đó thì lần đồng bộ sau
// vẫn gộp được, nên không mất dữ liệu của họ.
const daDonODangCu = new Set<string>()

async function donODangCu(name: string) {
  if (!supabase || daDonODangCu.has(name)) return
  daDonODangCu.add(name)

  const { error } = await supabase.from('app_state').delete().eq('key', name)
  if (error) {
    daDonODangCu.delete(name)
    console.warn(`[Supabase] Chưa dọn được ô cũ "${name}" —`, error.message)
    return
  }
  phienBanMayChu.delete(name)
  console.info(`[Supabase] Đã dọn ô cũ "${name}" sau khi chia thành từng mảnh.`)
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
    ghiNhanBanGoc(tachKhoa(name).ten, (parsed as KhoiTrangThai).state)
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
    // cuộc: tải bản mới, hợp nhất 3 chiều theo từng bản ghi rồi ghi lại.
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
    const { ten, manh } = tachKhoa(name)
    const { khoi: hopNhat, soXungDot } = hopNhat3Chieu(
      ten, banMayChu.value, parsed as KhoiTrangThai, daXoa, manh ? idsToanKhoTaiMay(ten) : undefined,
    )
    console.info(`[Supabase] "${name}": máy chủ đã thay đổi — đã hợp nhất 3 chiều và ghi lại (lần ${lanThu + 1})${soXungDot ? `, ${soXungDot} bản ghi cùng bị sửa` : ''}.`)
    if (soXungDot) baoXungDot?.([{ kho: ten, soBanGhi: soXungDot }])

    await ghiLenMayChu(name, JSON.stringify(hopNhat), lanThu + 1, daXoa)

    // Nạp lại để bộ nhớ tại máy khớp với nội dung vừa ghi lên máy chủ
    if (manh) {
      await apDungManhVaoKho(ten, manh, hopNhat)
    } else {
      dangDongBo = true
      try {
        localStorage.setItem(name, JSON.stringify(hopNhat))
        await napLai?.(name)
      } finally {
        dangDongBo = false
      }
    }
    return
  }

  ghiNhanPhienBan(name, data[0].updated_at)
  // Ghi thành công: nội dung vừa ghi chính là bản trên máy chủ → làm bản gốc mới
  const { ten } = tachKhoa(name)
  ghiNhanBanGoc(ten, (parsed as KhoiTrangThai).state)
  boBanGoc(ten, daXoa)
}

// ───────────────────────────────────────────────────────────────────────────
// Làm mới từ máy chủ
//
// Trước đây mỗi máy chỉ đọc máy chủ lúc mở trang: tab mở từ sáng giữ dữ liệu
// buổi sáng cả ngày. Nay cứ 60 giây (và khi quay lại tab, khi đăng nhập lại,
// trước thao tác quan trọng) kiểm tra phiên bản từng ô — chỉ vài trăm byte.
// Ô nào đổi thì tải về, hợp nhất 3 chiều với bản đang có ở máy (giữ nguyên
// phần máy này đang sửa dở) rồi nạp lại store.
// ───────────────────────────────────────────────────────────────────────────

let dangLamMoi: Promise<number> | null = null

/** Trả về số ô đã tải mới. Bỏ qua lượt này nếu máy đang ghi dở. */
export function lamMoiTuMayChu(): Promise<number> {
  if (!supabase) return Promise.resolve(0)
  if (dangLamMoi) return dangLamMoi
  dangLamMoi = (async () => {
    try {
      if (soLenhDangGhi > 0 || dangDongBo) return 0
      const { data: dsPhienBan, error } = await supabase.from('app_state').select('key, updated_at')
      if (error || !dsPhienBan) return 0
      const doi = dsPhienBan
        .filter((r) => r.key !== 'ql-auth' && r.updated_at !== phienBanMayChu.get(r.key))
        // Ô cũ chưa chia của kho đã chia: để lần mở trang sau gộp, không tải từng lượt
        .filter((r) => !laKhoChia(r.key) || r.key.includes(NGAN_CACH))
        .map((r) => r.key as string)
      if (!doi.length) return 0

      const { data: dsMoi, error: e2 } = await supabase.from('app_state').select('key, value, updated_at').in('key', doi)
      if (e2 || !dsMoi) return 0
      // Người dùng vừa thao tác trong lúc tải → để lượt sau, tránh chen ngang lệnh ghi
      if (soLenhDangGhi > 0) return 0

      const khoCanNap = new Set<string>()
      let tongXungDot = 0
      for (const row of dsMoi) {
        const { ten, manh } = tachKhoa(row.key)
        const mayChu = row.value as KhoiTrangThai
        let cucBo: KhoiTrangThai
        try {
          const toanKho = JSON.parse(localStorage.getItem(ten) ?? 'null') as KhoiTrangThai | null
          if (!toanKho) continue
          cucBo = manh ? (chiaTrangThai(ten, toanKho).get(manh) ?? { ...toanKho, state: {} }) : toanKho
        } catch {
          continue
        }
        const { khoi, soXungDot } = hopNhat3Chieu(ten, mayChu, cucBo, {}, manh ? idsToanKhoTaiMay(ten) : undefined)
        tongXungDot += soXungDot
        ghiNhanPhienBan(row.key, row.updated_at)
        ghiNhanBanGoc(ten, mayChu.state)
        if (manh) {
          await apDungManhVaoKho(ten, manh, khoi)
        } else {
          dangDongBo = true
          try {
            localStorage.setItem(ten, JSON.stringify(khoi))
          } finally {
            dangDongBo = false
          }
          khoCanNap.add(ten)
        }
      }
      for (const ten of khoCanNap) {
        dangDongBo = true
        try {
          await napLai?.(ten)
        } finally {
          dangDongBo = false
        }
      }
      if (tongXungDot) baoXungDot?.([{ kho: 'nhiều kho', soBanGhi: tongXungDot }])
      return dsMoi.length
    } catch (e) {
      console.warn('[Supabase] Làm mới không thành công —', e)
      return 0
    } finally {
      dangLamMoi = null
    }
  })()
  return dangLamMoi
}

// ───────────────────────────────────────────────────────────────────────────
// Nhận thay đổi tức thì (Supabase Realtime)
//
// Kế toán vừa thêm hồ sơ thì máy chủ báo ngay cho các máy đang mở (Admin, lãnh
// đạo) để tự làm mới — không phải chờ tới lượt kiểm tra định kỳ. Cần bật
// Realtime cho bảng app_state (tools/sql/03-bat-realtime.sql); chưa bật thì
// vẫn còn kiểm tra định kỳ 30 giây.
// ───────────────────────────────────────────────────────────────────────────

export function batNhanThayDoiTucThi(): () => void {
  if (!supabase) return () => {}
  let hen: number | undefined
  const kenh = supabase
    .channel('app_state_thay_doi')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, (p) => {
      const key = (p.new as { key?: string } | null)?.key ?? (p.old as { key?: string } | null)?.key
      const moi = (p.new as { updated_at?: string } | null)?.updated_at
      // Thay đổi do chính máy này ghi thì đã có phiên bản khớp → bỏ qua
      if (key && moi && phienBanMayChu.get(key) === moi) return
      window.clearTimeout(hen)
      hen = window.setTimeout(() => { lamMoiTuMayChu() }, 800) // gom nhiều mảnh ghi liền nhau
    })
    .subscribe()
  return () => {
    window.clearTimeout(hen)
    supabase?.removeChannel(kenh)
  }
}

/** Ghi nhận nội dung từng mảnh đang có trên máy chủ để lần ghi sau chỉ ghi mảnh thực sự đổi */
export function ghiNhanManhDaCo(ten: string) {
  if (!laKhoChia(ten)) return
  try {
    const khoi = JSON.parse(localStorage.getItem(ten) ?? 'null') as KhoiTrangThai | null
    if (!khoi) return
    for (const [manh, nd] of chiaTrangThai(ten, khoi)) manhDaGhi.set(khoaManh(ten, manh), JSON.stringify(nd))
  } catch { /* bỏ qua */ }
}

/** Làm mới ngay trước thao tác quan trọng: chờ ghi xong, tải bản mới (tối đa 6 giây). */
export async function lamMoiNgay(): Promise<void> {
  if (!supabase) return
  const cho = (async () => {
    await choGhiXong()
    await lamMoiTuMayChu()
  })()
  await Promise.race([cho, new Promise((r) => setTimeout(r, 6000))])
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
