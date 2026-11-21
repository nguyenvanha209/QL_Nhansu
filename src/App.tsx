import { useEffect, useState } from 'react'
import { Spin, App as AntApp } from 'antd'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import AppRouter from '@/router/AppRouter'
import LopBaoVePhien from '@/components/LopBaoVePhien'
import { useHydration } from '@/hooks/useHydration'
import { initSeedData } from '@/utils/seed'
import { isSupabaseEnabled, napPhienDangNhap, dangKyKhiHetPhien, supabase } from '@/lib/supabase'
import { emailDangNhap } from '@/lib/auth'
import { useUserStore } from '@/store/userStore'
import { useAuthStore } from '@/store/authStore'
import { syncFromSupabase } from '@/lib/syncFromSupabase'

dayjs.locale('vi')

async function lamMoiPhienTuMayChu() {
  const cu = useAuthStore.getState().currentUser
  if (!cu) return
  const moi = useUserStore.getState().findByUsername(cu.username)
  const email = (await supabase?.auth.getSession())?.data.session?.user.email
  if (!moi || (email && email !== emailDangNhap(cu.username))) {
    useAuthStore.setState({ currentUser: null })
    return
  }
  useAuthStore.setState({ currentUser: { ...cu, role: moi.role, donViId: moi.donViId, quyenRieng: moi.quyenRieng, fullName: moi.fullName, active: moi.active } })
}

export default function App() {
  const hydrated = useHydration()
  const [ready, setReady] = useState(false)
  const [syncError, setSyncError] = useState(false)

  // Phiên máy chủ hết hạn / bị thu hồi trong lúc dùng → đăng xuất khỏi phần mềm
  useEffect(() => {
    dangKyKhiHetPhien(() => { if (useAuthStore.getState().currentUser) useAuthStore.setState({ currentUser: null }) })
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const init = async () => {
      // 0. Chưa có phiên máy chủ (chưa đăng nhập, phiên hết hạn, hoặc "phiên" tự tạo trong trình duyệt)
      //    → về màn hình đăng nhập; không đồng bộ, không tạo dữ liệu mẫu
      if (isSupabaseEnabled && !(await napPhienDangNhap())) {
        if (useAuthStore.getState().currentUser) useAuthStore.setState({ currentUser: null })
        setReady(true)
        return
      }

      // 1. Kéo dữ liệu mới nhất từ Supabase trước khi nghĩ đến việc seed
      const result = isSupabaseEnabled ? await syncFromSupabase() : 'disabled'

      // 2. Không đọc được máy chủ thì DỪNG: nếu seed lúc này, bản seed sẽ được
      //    đẩy ngược lên Supabase và xoá sạch dữ liệu thật đang có ở đó.
      if (result === 'error') {
        setSyncError(true)
        return
      }

      // 3. Chỉ seed khi máy chủ thực sự chưa có dữ liệu (hoặc chưa bật Supabase)
      initSeedData()

      // 4. Vai trò, trường phụ trách lấy lại từ danh sách tài khoản trên máy chủ (máy chủ chỉ cho quản trị viên
      //    sửa phần này - tools/sql/08), không tin bản phiên lưu trong trình duyệt; phiên phải đúng tài khoản.
      if (isSupabaseEnabled) await lamMoiPhienTuMayChu()
      setReady(true)
    }

    init()
  }, [hydrated])

  if (syncError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
        <h2 style={{ margin: 0, color: '#cf1322' }}>Không kết nối được máy chủ dữ liệu</h2>
        <p style={{ color: '#666', maxWidth: 460 }}>
          Hệ thống dừng lại để bảo vệ dữ liệu trên máy chủ. Vui lòng kiểm tra kết nối mạng rồi tải lại trang.
        </p>
        <button onClick={() => window.location.reload()} style={{ padding: '6px 16px', cursor: 'pointer' }}>Tải lại trang</button>
      </div>
    )
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <Spin size="large" />
        <span style={{ color: '#666' }}>
          {isSupabaseEnabled ? 'Đang đồng bộ dữ liệu từ máy chủ...' : 'Đang tải dữ liệu...'}
        </span>
      </div>
    )
  }

  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 8,
          // Chữ mặc định 14px nhỏ khi đọc lâu trên màn 1080p: nâng lên 15px (tiêu đề, ô nhập, bảng tự giãn theo)
          fontSize: 15,
          controlHeight: 34,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorBgLayout: '#f1f5f9',
        },
        components: {
          Card: { borderRadiusLG: 12 },
          Table: { borderRadiusLG: 8, cellPaddingInline: 10, cellPaddingBlock: 10, cellPaddingInlineSM: 8, cellPaddingBlockSM: 7 },
          Menu: { fontSize: 15 },
          Button: { borderRadius: 8 },
        },
      }}
    >
      <AntApp>
        <LopBaoVePhien />
        <AppRouter />
      </AntApp>
    </ConfigProvider>
  )
}
