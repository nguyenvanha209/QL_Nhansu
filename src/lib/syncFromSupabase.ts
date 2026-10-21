import { khoCucBo, dangDungIndexedDb, soDoc, ngheThayDoiTuTabKhac } from './khoCucBo'
import {
  supabase, ghiNhanPhienBan, ghiNhanBanGoc, ghiNhanManhDaCo, datCoDangDongBo, dangKyNapLai,
  dangKyChiaKho, laKhoChia, tachKhoa, gopCacManh, KHOA_GOC, chiaTrangThai, khoaManh,
} from './supabase'
import type { KhoiTrangThai } from './supabase'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useChuyenCongTacStore } from '@/store/chuyenCongTacStore'
import { useNhatKyStore } from '@/store/nhatKyStore'
import { useThongBaoStore } from '@/store/thongBaoStore'

// Không đồng bộ useAuthStore: phiên đăng nhập là của riêng từng máy.
const STORES = [
  useUserStore,
  useDanhMucStore,
  useVienChucStore,
  useLuongStore,
  useDeXuatStore,
  useChuyenCongTacStore,
  useNhatKyStore,
  useThongBaoStore,
]

// Sau khi tầng đồng bộ hợp nhất dữ liệu, store tương ứng phải nạp lại để bộ nhớ
// tại máy khớp với nội dung vừa ghi. Thiếu bước này thì lần ghi kế tiếp sẽ đè
// mất đúng phần vừa hợp nhất của người khác.
const KHO_THEO_KHOA: Record<string, { persist: { rehydrate: () => void | Promise<void> } }> = {
  'ql-users': useUserStore,
  'ql-danh-muc': useDanhMucStore,
  'ql-vien-chuc': useVienChucStore,
  'ql-luong': useLuongStore,
  'ql-de-xuat': useDeXuatStore,
  'ql-chuyen-cong-tac': useChuyenCongTacStore,
  'ql-nhat-ky': useNhatKyStore,
  'ql-thong-bao': useThongBaoStore,
}

// Khai báo chia kho theo đơn vị trường.
// Hồ sơ viên chức có sẵn donViId. Hệ số lương, phụ cấp, lịch sử biến động thì
// gắn với viên chức, phải tra ngược qua vienChucId để biết thuộc trường nào.
dangKyChiaKho('ql-vien-chuc', (bg) => String(bg.donViId ?? KHOA_GOC))
dangKyChiaKho('ql-luong', (bg) => {
  const vcId = bg.vienChucId
  if (typeof vcId !== 'string') return KHOA_GOC
  const vc = useVienChucStore.getState().vienChucs.find((v) => v.id === vcId)
  return vc?.donViId ?? KHOA_GOC
})

dangKyNapLai(async (key) => {
  const { ten } = tachKhoa(key)
  const kho = KHO_THEO_KHOA[ten] ?? KHO_THEO_KHOA[key]
  if (!kho) return
  datCoDangDongBo(true)
  try {
    await kho.persist.rehydrate()
  } finally {
    datCoDangDongBo(false)
  }
})

// Hai tab trên cùng máy dùng chung localStorage nhưng mỗi tab giữ store riêng trong
// bộ nhớ. Tab kia vừa lưu → tab này nạp lại, nếu không lần lưu sau của tab này sẽ
// ghi bản cũ của nó đè lên cả localStorage lẫn máy chủ.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !KHO_THEO_KHOA[e.key]) return
    datCoDangDongBo(true)
    Promise.resolve(KHO_THEO_KHOA[e.key].persist.rehydrate()).finally(() => datCoDangDongBo(false))
  })
  // Dữ liệu cất trong IndexedDB không phát sự kiện "storage" → tab kia báo qua BroadcastChannel
  ngheThayDoiTuTabKhac((k) => {
    if (!KHO_THEO_KHOA[k]) return
    datCoDangDongBo(true)
    Promise.resolve(KHO_THEO_KHOA[k].persist.rehydrate()).finally(() => datCoDangDongBo(false))
  })
}

type DongMayChu = { key: string; value: unknown; updated_at: string }

const docKhoi = (ten: string): KhoiTrangThai | null => {
  try {
    return JSON.parse(khoCucBo.getItem(ten) ?? 'null') as KhoiTrangThai | null
  } catch {
    return null
  }
}

/**
 * Chọn các ô cần tải từ máy chủ; ô còn lại dùng lại bản cất trên máy.
 * Một kho được dùng lại khi: trên máy có bản cất, không còn thay đổi chưa gửi, và MỌI ô của kho trên máy chủ
 * vẫn đúng phiên bản bản cất đang khớp. Kho chia mảnh còn phải có đúng tập mảnh như máy chủ (không còn ô cũ
 * chưa chia) - có mảnh nào đổi thì tải lại cả kho, tránh lệch mảnh làm bản ghi đã xoá sống lại.
 * Không dùng IndexedDB (không có sổ phiên bản) thì tải hết như trước.
 */
function chonOCanTai(ds: { key: string; updated_at: string }[]): { tai: string[]; dungLai: Map<string, KhoiTrangThai> } {
  const dungLai = new Map<string, KhoiTrangThai>() // tên kho → bản trên máy
  if (!dangDungIndexedDb()) return { tai: ds.map((r) => r.key), dungLai }
  const { phienBan, chuaGui } = soDoc()
  const theoTen = new Map<string, { key: string; updated_at: string }[]>()
  for (const r of ds) {
    const { ten } = tachKhoa(r.key)
    if (!theoTen.has(ten)) theoTen.set(ten, [])
    theoTen.get(ten)!.push(r)
  }
  const tai: string[] = []
  for (const [ten, oCuaKho] of theoTen) {
    const khoi = KHO_THEO_KHOA[ten] && !chuaGui.has(ten) ? docKhoi(ten) : null
    let dung = !!khoi && oCuaKho.every((r) => phienBan[r.key] === r.updated_at)
    if (dung && laKhoChia(ten)) {
      const manhMay = new Set([...chiaTrangThai(ten, khoi!).keys()].map((m) => khoaManh(ten, m)))
      dung = oCuaKho.every((r) => r.key !== ten && manhMay.has(r.key)) && manhMay.size === oCuaKho.length
    }
    if (dung) dungLai.set(ten, khoi!)
    else tai.push(...oCuaKho.map((r) => r.key))
  }
  return { tai, dungLai }
}

export type SyncResult =
  | 'loaded' // đã kéo được dữ liệu từ máy chủ
  | 'empty' // kết nối được nhưng máy chủ chưa có dữ liệu (lần chạy đầu tiên)
  | 'error' // không kết nối được / lỗi - KHÔNG được coi là "chưa có dữ liệu"
  | 'disabled' // chưa cấu hình Supabase

// Kéo toàn bộ state từ Supabase về localStorage rồi rehydrate các store.
// Phân biệt rõ "máy chủ trống" với "lỗi kết nối": nếu lỗi mà vẫn seed dữ liệu mẫu
// thì bản seed sẽ được đẩy ngược lên Supabase và xoá sạch dữ liệu thật.
export async function syncFromSupabase(): Promise<SyncResult> {
  if (!supabase) return 'disabled'

  try {
    // Trước hết chỉ hỏi phiên bản từng ô (vài trăm byte); updated_at là phiên bản dùng cho khoá lạc quan khi ghi.
    const { data: dsPhienBan, error } = await supabase.from('app_state').select('key, updated_at')

    if (error) {
      console.error('[Supabase] Không đọc được app_state:', error.message)
      return 'error'
    }
    if (!dsPhienBan || dsPhienBan.length === 0) return 'empty'

    // Chỉ tải những ô đã đổi so với bản cất trên máy
    const { tai, dungLai } = chonOCanTai(dsPhienBan.filter((r) => r.key !== 'ql-auth') as { key: string; updated_at: string }[])
    let data: DongMayChu[] = []
    if (tai.length) {
      const { data: moi, error: e2 } = await supabase.from('app_state').select('key, value, updated_at').in('key', tai)
      if (e2 || !moi) {
        console.error('[Supabase] Không đọc được app_state:', e2?.message)
        return 'error'
      }
      data = moi as DongMayChu[]
    }
    console.info(`[Supabase] Mở trang: tải ${tai.length} ô, dùng lại bản trên máy ${dungLai.size} kho`)

    // Khoá ghi trong lúc rehydrate, nếu không việc nạp lại state có thể kích
    // hoạt lệnh ghi ngược lên máy chủ ngay giữa chừng.
    datCoDangDongBo(true)
    try {
      // Bỏ qua ql-auth: phiên đăng nhập là của riêng từng máy, kéo về sẽ biến
      // người dùng này thành người dùng khác. Bản ghi cũ trên máy chủ (nếu còn)
      // cũng không được phép ghi đè phiên tại chỗ.
      // Kho đã chia thì dữ liệu nằm rải ở nhiều mảnh, phải gộp lại thành một
      // khối như store vẫn đọc. Ô cũ chưa chia (nếu máy nào còn chạy bản trước
      // và ghi vào đó) cũng được gộp chung, nên không bị chia đôi dữ liệu.
      const theoKho = new Map<string, KhoiTrangThai[]>()

      for (const row of data) {
        if (row.key === 'ql-auth') continue
        ghiNhanPhienBan(row.key, row.updated_at)

        const { ten } = tachKhoa(row.key)
        if (laKhoChia(ten)) {
          if (!theoKho.has(ten)) theoKho.set(ten, [])
          theoKho.get(ten)!.push(row.value as KhoiTrangThai)
          continue
        }
        khoCucBo.setItem(row.key, JSON.stringify(row.value))
        // Bản gốc để hợp nhất 3 chiều: nội dung đúng như máy chủ lúc đọc
        ghiNhanBanGoc(row.key, (row.value as KhoiTrangThai)?.state, true)
      }

      for (const [ten, manhList] of theoKho) {
        const gop = gopCacManh(manhList)
        if (gop) {
          khoCucBo.setItem(ten, JSON.stringify(gop))
          ghiNhanBanGoc(ten, gop.state, true)
          // Mảnh đã khớp máy chủ → lần ghi sau chỉ ghi mảnh đổi, không ghi lại cả 12 mảnh
          // (ghi thừa làm mọi máy khác phải tải lại toàn bộ)
          ghiNhanManhDaCo(ten)
        }
      }

      // Kho dùng lại bản trên máy: ghi nhận phiên bản và bản gốc như vừa đọc từ máy chủ (nội dung đã khớp)
      for (const r of dsPhienBan) {
        const { ten } = tachKhoa(r.key)
        const khoi = dungLai.get(ten)
        if (!khoi) continue
        ghiNhanPhienBan(r.key, r.updated_at)
      }
      for (const [ten, khoi] of dungLai) {
        ghiNhanBanGoc(ten, khoi.state, true)
        if (laKhoChia(ten)) ghiNhanManhDaCo(ten)
      }

      await Promise.all(STORES.map((s) => s.persist.rehydrate()))
    } finally {
      datCoDangDongBo(false)
    }

    return 'loaded'
  } catch (e) {
    console.error('[Supabase] Lỗi khi đồng bộ:', e)
    datCoDangDongBo(false)
    return 'error'
  }
}
