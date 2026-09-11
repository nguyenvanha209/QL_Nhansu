import { supabase, ghiNhanPhienBan, datCoDangDongBo } from './supabase'
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
      for (const row of data) {
        if (row.key === 'ql-auth') continue
        localStorage.setItem(row.key, JSON.stringify(row.value))
        ghiNhanPhienBan(row.key, row.updated_at)
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
