// Ghi dữ liệu lên Supabase có kiểm tra phiên bản (khoá lạc quan) - DÙNG CHO MỌI SCRIPT SỬA DỮ LIỆU.
//
// Vì sao: script đọc dữ liệu, sửa rồi PATCH ngược lại cả ô. Nếu giữa lúc đọc và lúc ghi có
// người dùng khác lưu (kế toán đang nhập quy mô, hồ sơ...), lệnh ghi mù sẽ đè mất thay đổi đó.
// Ở đây lệnh ghi chỉ có hiệu lực khi `updated_at` trên máy chủ vẫn đúng bằng lúc đọc;
// nếu không, đọc lại và áp dụng lại phép sửa (tối đa 3 lần) rồi mới dừng.
//
// Cách dùng trong script:
//   import { suaKho } from './ghi-an-toan.mjs'
//   await suaKho('ql-danh-muc', (value) => { ...sửa value tại chỗ...; return soChoDaSua }, { apply: true })
//
// Hàm biến đổi trả về số mục đã sửa (0 = không có gì để ghi). Mặc định chỉ xem trước (apply: false).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const URL_SB = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim()
const KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

export async function docKho(key) {
  const res = await fetch(`${URL_SB}/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&select=value,updated_at`, { headers: HEADERS })
  if (!res.ok) throw new Error(`Đọc ${key} -> ${res.status} ${await res.text()}`)
  const rows = await res.json()
  if (!rows.length) throw new Error(`Không có key "${key}"`)
  return rows[0]
}

/** Ghi value nếu updated_at trên máy chủ vẫn là `phienBanDoc`. Trả về true nếu đã ghi, false nếu bị người khác đổi trước. */
export async function ghiKhoNeuChuaDoi(key, value, phienBanDoc) {
  const res = await fetch(
    `${URL_SB}/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&updated_at=eq.${encodeURIComponent(phienBanDoc)}`,
    {
      method: 'PATCH',
      headers: { ...HEADERS, Prefer: 'return=representation' },
      body: JSON.stringify({ value, updated_at: new Date().toISOString() }),
    },
  )
  if (!res.ok) throw new Error(`Ghi ${key} -> ${res.status} ${await res.text()}`)
  const rows = await res.json()
  return rows.length > 0
}

export async function suaKho(key, bienDoi, { apply = false, soLanThu = 3 } = {}) {
  for (let lan = 1; lan <= soLanThu; lan++) {
    const { value, updated_at } = await docKho(key)
    const soDaSua = await bienDoi(value)
    if (!soDaSua) { console.log(`${key}: không có gì để sửa.`); return 0 }
    if (!apply) { console.log(`${key}: ${soDaSua} mục sẽ sửa (xem trước - thêm --apply để ghi).`); return soDaSua }
    if (await ghiKhoNeuChuaDoi(key, value, updated_at)) {
      console.log(`${key}: đã ghi ${soDaSua} mục.`)
      return soDaSua
    }
    console.warn(`${key}: máy khác vừa lưu trong lúc script chạy - đọc lại và thử lần ${lan + 1}...`)
  }
  throw new Error(`${key}: vẫn có người lưu liên tục sau ${soLanThu} lần thử, dừng để không đè dữ liệu của họ.`)
}
