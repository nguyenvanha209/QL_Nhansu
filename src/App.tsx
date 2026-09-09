import { useEffect, useState } from 'react'
import { Spin, App as AntApp } from 'antd'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import AppRouter from '@/router/AppRouter'
import { useHydration } from '@/hooks/useHydration'
import { initSeedData } from '@/utils/seed'
import { isSupabaseEnabled } from '@/lib/supabase'
import { syncFromSupabase } from '@/lib/syncFromSupabase'

dayjs.locale('vi')

export default function App() {
  const hydrated = useHydration()
  const [ready, setReady] = useState(false)
  const [syncError, setSyncError] = useState(false)

  useEffect(() => {
    if (!hydrated) return

    const init = async () => {
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
      theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}
    >
      <AntApp>
        <AppRouter />
      </AntApp>
    </ConfigProvider>
  )
}
