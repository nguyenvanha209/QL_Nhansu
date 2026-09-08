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

  useEffect(() => {
    if (!hydrated) return

    const init = async () => {
      // 1. Fetch latest data from Supabase (if configured) before seeding
      if (isSupabaseEnabled) {
        await syncFromSupabase()
      }
      // 2. Seed demo data only if stores are still empty after sync
      initSeedData()
      setReady(true)
    }

    init()
  }, [hydrated])

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
