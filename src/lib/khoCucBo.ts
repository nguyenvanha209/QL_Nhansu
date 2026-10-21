// Bộ nhớ trên máy (thay cho gọi thẳng localStorage)
//
// localStorage chỉ có khoảng 5 MB mỗi trang trên điện thoại (iPhone: mọi trình duyệt dùng lõi WebKit; nhiều
// máy Android cũng vậy) - dữ liệu phần mềm đã vượt mức này, đăng nhập xong báo "Không tải được dữ liệu".
//
// Nay 8 kho dữ liệu (hồ sơ, lương, danh mục...) cất trong IndexedDB - có trên mọi trình duyệt, dung lượng
// hàng trăm MB. Khi mở trang, toàn bộ được đọc lên bộ nhớ một lần (khoiTaoKhoCucBo, trước khi tạo các store),
// sau đó đọc/ghi đồng bộ trên bộ nhớ như localStorage, phần ghi xuống IndexedDB chạy nền (gom 300 ms).
// Kèm theo là "sổ phiên bản": phiên bản máy chủ (updated_at) mà bản cất trên máy đang khớp, và kho nào còn
// thay đổi chưa lên máy chủ - để lần mở sau chỉ tải những phần đã đổi (xem syncFromSupabase).
//
// Các khoá nhỏ (phiên đăng nhập, mốc thao tác, thông báo đã xem) vẫn ở localStorage để các tab dùng chung.
// Trình duyệt không mở được IndexedDB (rất hiếm) thì quay về localStorage như trước, hết chỗ thì giữ trong
// bộ nhớ phiên; khi đó mỗi lần mở trang tải lại toàn bộ.

/** Các kho dữ liệu (tên persist của store) - cất IndexedDB */
const KHO_DU_LIEU = new Set([
  'ql-users', 'ql-danh-muc', 'ql-vien-chuc', 'ql-luong', 'ql-de-xuat', 'ql-chuyen-cong-tac', 'ql-nhat-ky', 'ql-thong-bao',
])
export const laKhoDuLieu = (k: string) => KHO_DU_LIEU.has(k)

const TEN_DB = 'ql-nhansu'
const BANG = 'kho'
const KHOA_SO = '__so_phien_ban__'

const boNho = new Map<string, string>()
let db: IDBDatabase | null = null
let dungIdb = false
let daHetCho = false

// ───────────────────────────── Sổ phiên bản ─────────────────────────────

interface SoPhienBan {
  /** Khoá trên máy chủ (app_state.key) → updated_at mà bản trên máy đang khớp */
  phienBan: Record<string, string>
  /** Kho còn thay đổi trên máy chưa lên máy chủ */
  chuaGui: string[]
}
let so: SoPhienBan = { phienBan: {}, chuaGui: [] }

// ───────────────────────────── IndexedDB ─────────────────────────────

const choGhi = new Map<string, string | null>() // null = xoá
let henGhi: number | undefined
let dangGhi: Promise<void> = Promise.resolve()

function moDb(): Promise<IDBDatabase> {
  return new Promise((ok, loi) => {
    if (typeof indexedDB === 'undefined') return loi(new Error('Không có IndexedDB'))
    const yc = indexedDB.open(TEN_DB, 1)
    yc.onupgradeneeded = () => { if (!yc.result.objectStoreNames.contains(BANG)) yc.result.createObjectStore(BANG) }
    yc.onsuccess = () => {
      const d = yc.result
      // Tab khác cần nâng cấp / xoá cơ sở dữ liệu (bản phần mềm mới) → nhả kết nối, không chặn tab đó.
      // Tab này vẫn chạy trên bộ nhớ; phần chưa ghi xuống máy thì lần mở sau tải lại từ máy chủ.
      d.onversionchange = () => {
        d.close()
        if (db === d) db = null
      }
      ok(d)
    }
    yc.onerror = () => loi(yc.error)
    yc.onblocked = () => loi(new Error('IndexedDB bị chặn'))
  })
}

function docHet(d: IDBDatabase): Promise<Map<string, string>> {
  return new Promise((ok, loi) => {
    const ra = new Map<string, string>()
    const tx = d.transaction(BANG, 'readonly')
    const yc = tx.objectStore(BANG).openCursor()
    yc.onsuccess = () => {
      const c = yc.result
      if (!c) return
      if (typeof c.value === 'string') ra.set(String(c.key), c.value)
      c.continue()
    }
    tx.oncomplete = () => ok(ra)
    tx.onerror = () => loi(tx.error)
  })
}

/** Ghi mọi thay đổi đang chờ trong MỘT giao dịch (dữ liệu và sổ phiên bản lên cùng lúc hoặc cùng không) */
function xaGhi(): Promise<void> {
  window.clearTimeout(henGhi)
  henGhi = undefined
  if (!db || !choGhi.size) return dangGhi
  const lo = [...choGhi]
  choGhi.clear()
  const d = db
  dangGhi = dangGhi.then(() => new Promise<void>((ok) => {
    try {
      const tx = d.transaction(BANG, 'readwrite')
      const st = tx.objectStore(BANG)
      for (const [k, v] of lo) {
        if (v == null) st.delete(k)
        else st.put(v, k)
      }
      tx.oncomplete = () => ok()
      tx.onerror = tx.onabort = () => {
        console.warn('[Bộ nhớ máy] Ghi IndexedDB không thành công -', tx.error)
        ok()
      }
    } catch (e) {
      console.warn('[Bộ nhớ máy] Ghi IndexedDB không thành công -', e)
      ok()
    }
  }))
  return dangGhi
}

function henXa() {
  if (henGhi === undefined) henGhi = window.setTimeout(() => { void xaGhi() }, 300)
}

function luuSo() {
  if (!dungIdb) return
  choGhi.set(KHOA_SO, JSON.stringify(so))
  henXa()
}

// ───────────────────────────── Đồng bộ giữa các tab ─────────────────────────────
// IndexedDB không có sự kiện "storage" như localStorage → báo cho tab khác qua BroadcastChannel.

type NgheTab = (k: string) => void
const ngheTab = new Set<NgheTab>()
const kenh: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ql-nhansu-kho') : null
if (kenh) {
  kenh.onmessage = (e: MessageEvent<{ k: string; v: string | null }>) => {
    const { k, v } = e.data ?? {}
    if (!k || !dungIdb) return
    if (v == null) boNho.delete(k)
    else boNho.set(k, v)
    ngheTab.forEach((fn) => fn(k))
  }
}
/** Tab khác vừa lưu một kho dữ liệu (để nạp lại store) */
export function ngheThayDoiTuTabKhac(fn: NgheTab) {
  ngheTab.add(fn)
  return () => { ngheTab.delete(fn) }
}

// ───────────────────────────── Khởi tạo ─────────────────────────────

const hetGio = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, loi) => setTimeout(() => loi(new Error('Hết thời gian')), ms))])

/**
 * Gọi MỘT lần trước khi tạo các store (main.tsx): đọc IndexedDB lên bộ nhớ, chuyển dữ liệu cũ từ
 * localStorage sang. Lỗi thì giữ cách cũ (localStorage), không chặn việc mở phần mềm.
 */
export async function khoiTaoKhoCucBo(): Promise<void> {
  try {
    db = await hetGio(moDb(), 4000)
    const daCo = await hetGio(docHet(db), 8000)
    for (const [k, v] of daCo) {
      if (k === KHOA_SO) {
        try {
          const doc = JSON.parse(v) as Partial<SoPhienBan>
          so = { phienBan: doc.phienBan ?? {}, chuaGui: doc.chuaGui ?? [] }
        } catch { /* sổ hỏng: coi như chưa có */ }
      } else if (laKhoDuLieu(k)) boNho.set(k, v)
    }
    // Chuyển dữ liệu đang cất ở localStorage (bản trước) sang IndexedDB rồi mới xoá
    const cu: string[] = []
    for (const k of KHO_DU_LIEU) {
      const v = goi(() => localStorage.getItem(k), null)
      if (v == null) continue
      cu.push(k)
      if (!boNho.has(k)) { boNho.set(k, v); choGhi.set(k, v) }
    }
    dungIdb = true
    if (choGhi.size) {
      // Bản lấy từ localStorage chưa có sổ phiên bản → lần đầu vẫn tải toàn bộ từ máy chủ
      so = { phienBan: {}, chuaGui: [] }
      choGhi.set(KHOA_SO, JSON.stringify(so))
    }
    await xaGhi()
    for (const k of cu) goi(() => localStorage.removeItem(k), undefined)
  } catch (e) {
    console.warn('[Bộ nhớ máy] Không dùng được IndexedDB, dùng localStorage -', e)
    db = null
    dungIdb = false
    boNho.clear()
  }
}

/** Đang cất dữ liệu bằng IndexedDB (có sổ phiên bản để chỉ tải phần đổi) */
export const dangDungIndexedDb = () => dungIdb

// Ẩn/đóng tab: ghi ngay phần đang chờ
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void xaGhi() })
  window.addEventListener('pagehide', () => { void xaGhi() })
}

// ───────────────────────────── Đọc / ghi ─────────────────────────────

const laHetCho = (e: unknown) =>
  e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)

function goi<T>(fn: () => T, macDinh: T): T {
  try {
    return fn()
  } catch {
    return macDinh
  }
}

/** Chế độ localStorage hết chỗ: dời các kho dữ liệu lớn sang bộ nhớ phiên để giải phóng chỗ */
function giaiPhongCho() {
  for (const k of KHO_DU_LIEU) {
    const v = goi(() => localStorage.getItem(k), null)
    if (v == null) continue
    boNho.set(k, v)
    goi(() => localStorage.removeItem(k), undefined)
  }
}

export const khoCucBo = {
  getItem(k: string): string | null {
    if (boNho.has(k)) return boNho.get(k)!
    if (dungIdb && laKhoDuLieu(k)) return null
    return goi(() => localStorage.getItem(k), null)
  },

  setItem(k: string, v: string): void {
    if (dungIdb && laKhoDuLieu(k)) {
      boNho.set(k, v)
      choGhi.set(k, v)
      henXa()
      kenh?.postMessage({ k, v })
      return
    }
    // Chế độ localStorage: kho đã dời sang bộ nhớ phiên thì giữ luôn ở đó
    if (boNho.has(k) && laKhoDuLieu(k)) {
      boNho.set(k, v)
      return
    }
    try {
      localStorage.setItem(k, v)
      boNho.delete(k)
      return
    } catch (e) {
      if (!laHetCho(e)) {
        boNho.set(k, v)
        return
      }
    }
    if (!daHetCho) {
      daHetCho = true
      console.warn('[Bộ nhớ máy] localStorage hết chỗ - dữ liệu lớn giữ trong bộ nhớ phiên, mỗi lần mở trang tải lại từ máy chủ')
    }
    if (laKhoDuLieu(k)) {
      goi(() => localStorage.removeItem(k), undefined)
      boNho.set(k, v)
      giaiPhongCho()
      return
    }
    // Khoá nhỏ (phiên đăng nhập...): giải phóng chỗ rồi ghi lại
    giaiPhongCho()
    try {
      localStorage.setItem(k, v)
      boNho.delete(k)
    } catch {
      boNho.set(k, v)
    }
  },

  removeItem(k: string): void {
    boNho.delete(k)
    if (dungIdb && laKhoDuLieu(k)) {
      choGhi.set(k, null)
      henXa()
      kenh?.postMessage({ k, v: null })
      return
    }
    goi(() => localStorage.removeItem(k), undefined)
  },
}

// ───────────────────────────── Sổ phiên bản (dùng ở tầng đồng bộ) ─────────────────────────────

/** Bản trên máy của khoá `key` (app_state.key) đang khớp phiên bản máy chủ `updatedAt` */
export function soGhiPhienBan(key: string, updatedAt: string | null) {
  if (!dungIdb) return
  if (updatedAt == null) {
    if (!(key in so.phienBan)) return
    delete so.phienBan[key]
  } else {
    if (so.phienBan[key] === updatedAt) return
    so.phienBan[key] = updatedAt
  }
  luuSo()
}

/** Đánh dấu kho còn / hết thay đổi chưa lên máy chủ */
export function soDanhDauChuaGui(ten: string, chuaGui: boolean) {
  if (!dungIdb) return
  const co = so.chuaGui.includes(ten)
  if (co === chuaGui) return
  so.chuaGui = chuaGui ? [...so.chuaGui, ten] : so.chuaGui.filter((x) => x !== ten)
  luuSo()
}

/** Đọc sổ: phiên bản máy chủ mà bản trên máy đang khớp, và kho còn thay đổi chưa gửi */
export function soDoc(): { phienBan: Readonly<Record<string, string>>; chuaGui: ReadonlySet<string> } {
  return { phienBan: so.phienBan, chuaGui: new Set(so.chuaGui) }
}

/** Có đang phải giữ dữ liệu trong bộ nhớ phiên vì localStorage hết chỗ không */
export const dangThieuBoNho = () => daHetCho
