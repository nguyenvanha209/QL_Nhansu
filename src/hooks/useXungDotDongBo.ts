import { useEffect, useRef } from 'react'
import { App } from 'antd'
import { dangKyXuLyXungDot } from '@/lib/supabase'
import { syncFromSupabase } from '@/lib/syncFromSupabase'

// Khi máy chủ đã thay đổi sau lần đọc gần nhất, lệnh ghi bị từ chối để không đè
// mất dữ liệu của người khác. Lúc đó phải tải lại bản mới và nói rõ cho người
// dùng biết thao tác vừa rồi CHƯA được lưu — im lặng ở đây là nguy hiểm nhất,
// vì người dùng sẽ đinh ninh mình đã lưu xong.
export function useXungDotDongBo() {
  const { notification } = App.useApp()
  const dangXuLy = useRef(false)

  useEffect(() => {
    dangKyXuLyXungDot(async () => {
      if (dangXuLy.current) return
      dangXuLy.current = true

      const kq = await syncFromSupabase()
      dangXuLy.current = false

      notification.warning({
        message: 'Thao tác vừa rồi chưa được lưu',
        description:
          kq === 'loaded'
            ? 'Dữ liệu trên máy chủ vừa được người khác cập nhật. Hệ thống đã tải về bản mới nhất để tránh ghi đè. Vui lòng kiểm tra lại và thực hiện lại thao tác vừa rồi.'
            : 'Dữ liệu trên máy chủ đã thay đổi nhưng hiện không tải lại được. Vui lòng kiểm tra kết nối mạng rồi tải lại trang trước khi nhập tiếp.',
        duration: 0,
        placement: 'topRight',
      })
    })
  }, [notification])
}
