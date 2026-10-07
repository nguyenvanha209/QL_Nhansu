import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Chính sách bảo mật nội dung (CSP) cho bản đưa lên mạng: chỉ chạy mã của chính trang, chỉ kết nối tới
// Supabase; chặn chèn mã lạ (XSS) và gửi dữ liệu ra nơi khác. GitHub Pages không cho đặt header nên dùng thẻ meta
// (thẻ meta không hỗ trợ frame-ancestors). Bản chạy thử trên máy không gắn vì Vite cần mã nội tuyến.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' blob: https://*.supabase.co",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const ganCsp = (): Plugin => ({
  name: 'gan-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />`),
})

export default defineConfig({
  // Chạy ở tên miền riêng ql-nhansu.ngoquyen.edu.vn (gốc '/'); trước đây là nguyenvanha209.github.io/QL_Nhansu/
  base: '/',
  plugins: [react(), ganCsp()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rolldownOptions: {
      output: {
        // Thư viện tách gói riêng: ít thay đổi giữa các lần cập nhật phần mềm nên trình duyệt giữ lại
        // trong bộ nhớ đệm, không phải tải lại; thư viện nặng (biểu đồ, PDF, Excel) chỉ tải khi trang cần.
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'antd', test: /[\\/]node_modules[\\/](antd|@ant-design|@rc-component|rc-[^\\/]+|@emotion)[\\/]/, priority: 20 },
            { name: 'supabase', test: /[\\/]node_modules[\\/]@supabase[\\/]/, priority: 20 },
            { name: 'bieu-do', test: /[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/, priority: 20 },
            { name: 'pdf', test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable)[\\/]/, priority: 20 },
            { name: 'xlsx', test: /[\\/]node_modules[\\/]xlsx[\\/]/, priority: 20 },
          ],
        },
      },
    },
  },
})
