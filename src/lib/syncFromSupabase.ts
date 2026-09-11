import {
  supabase, ghiNhanPhienBan, datCoDangDongBo, dangKyNapLai,
  dangKyChiaKho, laKhoChia, tachKhoa, gopCacManh, KHOA_GOC,
} from './supabase'
import type { KhoiTrangThai } from './supabase'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { useLuongStore } from '@/store/luongStore'
import { useDeXuatStore } from '@/store/deXuatStore'
import { useChuyenCongTacStore } from '@/store/chuyenCongTacStore'
import { useNhatKyStore } from '@/store/nhatKyStore'

// Không đồng bộ useAuthStore: phiên đăng nhập là của riêng từng máy.
const STORES = [
  useUserStore,
  useDanhMucStore,
  useVienChucStore,
  useLuongStore,
  useDeXuatStore,
  useChuyenCongTacStore,
  useNhatKyStore,
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

export type SyncResult =
  | 'loaded' // đã kéo được dữ liệu từ máy chủ
  | 'empty' // kết nối được nhưng máy chủ chưa có dữ liệu (lần chạy đầu tiên)
  | 'error' // không kết nối được / lỗi — KHÔNG được coi là "chưa có dữ liệu"
  | 'disabled' // chưa cấu hình Supabase

// Kéo toàn bộ state từ Supabase về localStorage rồi rehydrate các store.
// Phân biệt rõ "máy chủ trống" với "lỗi kết nối": nếu lỗi mà vẫn seed dữ liệu mẫu
// thì bản seed sẽ được đẩy ngược lên Supabase và xoá sạch dữ liệu thật.
export async function syncFromSupabase(): Promise<SyncResult> {
  if (!supabase) return 'disabled'

  try {
    // updated_at là phiên bản dùng cho khoá lạc quan khi ghi ngược lên.
    const { data, error } = await supabase.from('app_state').select('key, value, updated_at')

    if (error) {
      console.error('[Supabase] Không đọc được app_state:', error.message)
      return 'error'
    }
    if (!data || data.length === 0) return 'empty'

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
        localStorage.setItem(row.key, JSON.stringify(row.value))
      }

      for (const [ten, manhList] of theoKho) {
        const gop = gopCacManh(manhList)
        if (gop) localStorage.setItem(ten, JSON.stringify(gop))
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
