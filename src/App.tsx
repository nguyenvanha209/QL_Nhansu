import { useEffect } from 'react'
import { Spin } from 'antd'
import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import AppRouter from '@/router/AppRouter'
import { useHydration } from '@/hooks/useHydration'
import { initSeedData } from '@/utils/seed'
import { isSupabaseEnabled } from '@/lib/supabase'

dayjs.locale('vi')

export default function App() {
  const hydrated = useHydration()

  useEffect(() => {
    if (hydrated) initSeedData()
  }, [hydrated])

  if (!hydrated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <Spin size="large" />
        <span style={{ color: '#666' }}>
          {isSupabaseEnabled ? 'Đang kết nối cơ sở dữ liệu...' : 'Đang tải dữ liệu...'}
        </span>
      </div>
    )
  }

  return (
    <ConfigProvider
      locale={viVN}
      theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}
    >
      <AppRouter />
    </ConfigProvider>
  )
}
