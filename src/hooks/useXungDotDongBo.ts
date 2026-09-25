import { useEffect, useRef } from 'react'
import { App } from 'antd'
import { dangKyXuLyXungDot, dangKyBaoXungDotBanGhi, lamMoiTuMayChu, batNhanThayDoiTucThi } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
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

  // Hai máy cùng sửa một bản ghi: đã giữ bản sửa sau cùng — báo để người dùng kiểm tra lại
  useEffect(() => {
    dangKyBaoXungDotBanGhi((ds) => {
      const tong = ds.reduce((s, x) => s + x.soBanGhi, 0)
      notification.info({
        message: 'Có dữ liệu vừa được người khác sửa cùng lúc',
        description: `${tong} bản ghi được bạn và người khác cùng sửa. Hệ thống đã giữ bản sửa sau cùng — vui lòng kiểm tra lại hồ sơ vừa thao tác.`,
        duration: 12,
        placement: 'topRight',
      })
    })
  }, [notification])

  // Tự làm mới dữ liệu từ máy chủ: nhận thay đổi tức thì (Realtime), dự phòng kiểm tra 30 giây một lần,
  // khi quay lại tab, khi đăng nhập lại.
  // Nhờ vậy tab mở lâu (Admin, lãnh đạo) không còn giữ dữ liệu cũ rồi đè lên người khác.
  const dangNhap = useAuthStore((s) => s.currentUser?.id)
  useEffect(() => {
    if (!dangNhap) return
    lamMoiTuMayChu()
    const huyTucThi = batNhanThayDoiTucThi()
    const dinhKy = window.setInterval(() => { if (document.visibilityState === 'visible') lamMoiTuMayChu() }, 30_000)
    const khiQuayLai = () => { if (document.visibilityState === 'visible') lamMoiTuMayChu() }
    document.addEventListener('visibilitychange', khiQuayLai)
    window.addEventListener('focus', khiQuayLai)
    return () => {
      huyTucThi()
      window.clearInterval(dinhKy)
      document.removeEventListener('visibilitychange', khiQuayLai)
      window.removeEventListener('focus', khiQuayLai)
    }
  }, [dangNhap])
}
