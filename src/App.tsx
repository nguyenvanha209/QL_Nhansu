import { ConfigProvider } from 'antd'
import viVN from 'antd/locale/vi_VN'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import AppRouter from '@/router/AppRouter'
import { initSeedData } from '@/utils/seed'

dayjs.locale('vi')
initSeedData()

export default function App() {
  return (
    <ConfigProvider
      locale={viVN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <AppRouter />
    </ConfigProvider>
  )
}
