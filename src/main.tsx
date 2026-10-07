import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { choGhiXong } from './lib/supabase'

// Sau mỗi lần cập nhật phần mềm, các gói mã trang cũ bị thay tên. Máy đang mở bản cũ mà bấm sang
// trang chưa tải sẽ không tìm thấy gói → tải lại trang để lấy bản mới (mỗi phiên chỉ thử 1 lần để
// không lặp vô hạn). Chờ các lệnh ghi đang dở lên máy chủ xong rồi mới tải lại, nếu không lần đồng bộ
// khi mở lại sẽ lấy bản máy chủ đè mất thay đổi chưa kịp gửi.
window.addEventListener('vite:preloadError', (e) => {
  try {
    if (sessionStorage.getItem('ql-tai-lai-ban-moi')) return
    sessionStorage.setItem('ql-tai-lai-ban-moi', '1')
  } catch { return }
  e.preventDefault()
  Promise.race([choGhiXong(), new Promise((r) => setTimeout(r, 8000))]).finally(() => window.location.reload())
})
window.addEventListener('load', () => {
  // Tải trang thành công thì cho phép lần cập nhật sau tự tải lại tiếp
  setTimeout(() => { try { sessionStorage.removeItem('ql-tai-lai-ban-moi') } catch { /* bỏ qua */ } }, 10_000)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
