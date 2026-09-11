import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'

const PHUT = 60 * 1000
const HAN_NGHI = 10 * PHUT // hết hạn sau 10 phút không thao tác
const BAO_TRUOC = 60 * 1000 // cảnh báo trước khi thoát 1 phút
const NHIP_KIEM = 5 * 1000 // nhịp kiểm tra
const KHOA_MOC = 'ql-moc-hoat-dong' // dùng chung giữa các tab

// So sánh theo MỐC THỜI GIAN thay vì đếm bằng setTimeout. setTimeout bị trình
// duyệt bóp nghẹt ở tab nền và không đáng tin sau khi máy ngủ — đóng nắp máy
// hai tiếng rồi mở lại vẫn có thể không đăng xuất. Mốc thời gian thì luôn đúng.
//
// Mốc lưu ở localStorage nên mọi tab dùng chung: thao tác ở tab này giữ cho tab
// kia không bị thoát oan.
export function useIdleTimeout() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)
  const [giaySapThoat, setGiaySapThoat] = useState<number | null>(null)
  const daThoat = useRef(false)
  // Cho phép nút "Tôi vẫn đang làm việc" gia hạn trực tiếp, thay vì phải phát
  // một sự kiện chuột giả rồi trông chờ vào cơ chế nổi bọt.
  const giaHan = useRef<() => void>(() => {})

  useEffect(() => {
    if (!currentUser) {
      setGiaySapThoat(null)
      daThoat.current = false
      return
    }

    // Tiết lưu: mousemove bắn hàng trăm lần mỗi giây, ghi localStorage từng lần
    // là lãng phí. Ghi mỗi 2 giây một lần đã đủ chính xác cho ngưỡng 10 phút.
    let lanGhiCuoi = 0
    const datMoc = () => {
      const nay = Date.now()
      if (nay - lanGhiCuoi >= 2000) {
        lanGhiCuoi = nay
        try {
          localStorage.setItem(KHOA_MOC, String(nay))
        } catch {
          /* chế độ riêng tư có thể chặn ghi — bỏ qua, vẫn chạy theo mốc trong phiên */
        }
      }
      setGiaySapThoat(null)
    }

    const docMoc = (): number => {
      try {
        const v = Number(localStorage.getItem(KHOA_MOC))
        return Number.isFinite(v) && v > 0 ? v : Date.now()
      } catch {
        return Date.now()
      }
    }

    const kiemTra = () => {
      if (daThoat.current) return
      const nhanRoi = Date.now() - docMoc()

      if (nhanRoi >= HAN_NGHI) {
        daThoat.current = true
        setGiaySapThoat(null)
        logout(true)
        return
      }
      const conLai = HAN_NGHI - nhanRoi
      setGiaySapThoat(conLai <= BAO_TRUOC ? Math.ceil(conLai / 1000) : null)
    }

    giaHan.current = datMoc

    const SU_KIEN = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'mousemove'] as const
    SU_KIEN.forEach((e) => window.addEventListener(e, datMoc, { passive: true }))

    // Tab quay lại tiền cảnh (sau khi máy ngủ chẳng hạn) thì kiểm tra ngay,
    // không đợi hết nhịp.
    document.addEventListener('visibilitychange', kiemTra)

    datMoc()
    const dinhKy = window.setInterval(kiemTra, NHIP_KIEM)

    return () => {
      window.clearInterval(dinhKy)
      SU_KIEN.forEach((e) => window.removeEventListener(e, datMoc))
      document.removeEventListener('visibilitychange', kiemTra)
    }
  }, [currentUser, logout])

  // giaySapThoat: số giây còn lại khi sắp bị đăng xuất, null nghĩa là chưa tới
  // ngưỡng cảnh báo. tiepTuc: gia hạn phiên làm việc.
  return { giaySapThoat, tiepTuc: () => giaHan.current() }
}
