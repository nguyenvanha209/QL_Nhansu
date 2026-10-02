import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // Chạy ở tên miền riêng ql-nhansu.ngoquyen.edu.vn (gốc '/'); trước đây là nguyenvanha209.github.io/QL_Nhansu/
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
