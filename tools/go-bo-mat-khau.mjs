// Dọn mật khẩu dạng nguyên văn khỏi máy chủ.
// Chạy SAU KHI đã xác nhận các trường đăng nhập được bằng cơ chế RPC mới.
//
//   node tools/go-bo-mat-khau.mjs            xem trước
//   node tools/go-bo-mat-khau.mjs --apply    thực hiện
//
// Việc thực hiện:
//   1. Xoá trường `password` khỏi mọi tài khoản trong ql-users
//   2. Xoá hẳn bản ghi ql-auth (phiên cũ còn sót, có chứa mật khẩu)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const APPLY = process.argv.includes('--apply')

const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const URL_SB = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim()
const KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()

const sb = async (method, url, body) => {
  const res = await fetch(`${URL_SB}/rest/v1/${url}`, {
    method,
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

// Sao lưu trước khi đụng vào
const rows = await sb('GET', 'app_state?select=key,value')
const dirBackup = path.join(ROOT, 'tools', 'backups')
fs.mkdirSync(dirBackup, { recursive: true })
const fileBackup = path.join(dirBackup, `truoc-go-mat-khau-${Date.now()}.json`)
fs.writeFileSync(fileBackup, JSON.stringify(rows, null, 2), 'utf8')
console.log(`✓ Sao lưu -> tools/backups/${path.basename(fileBackup)}\n`)

const rowUsers = rows.find((r) => r.key === 'ql-users')
const users = rowUsers.value.state.users
const coMatKhau = users.filter((u) => 'password' in u)
const coAuth = rows.some((r) => r.key === 'ql-auth')

console.log(`Tài khoản còn lưu mật khẩu nguyên văn : ${coMatKhau.length}/${users.length}`)
coMatKhau.forEach((u) => console.log(`    ${u.username}`))
console.log(`Bản ghi ql-auth tồn đọng              : ${coAuth ? 'CÓ — sẽ xoá' : 'không có'}`)

if (!coMatKhau.length && !coAuth) {
  console.log('\nKhông có gì để dọn.')
  process.exit(0)
}

if (!APPLY) {
  console.log('\n(Xem trước — chạy lại với --apply để thực hiện)')
  process.exit(0)
}

// 1. Gỡ password khỏi ql-users
if (coMatKhau.length) {
  rowUsers.value.state.users = users.map((u) => {
    const { password, ...conLai } = u
    void password
    return conLai
  })
  await sb('PATCH', 'app_state?key=eq.ql-users', {
    value: rowUsers.value,
    updated_at: new Date().toISOString(),
  })
  console.log(`\n✓ Đã gỡ mật khẩu khỏi ${coMatKhau.length} tài khoản trong ql-users`)
}

// 2. Xoá bản ghi phiên cũ
if (coAuth) {
  await sb('DELETE', 'app_state?key=eq.ql-auth')
  console.log('✓ Đã xoá bản ghi ql-auth')
}

console.log('\nXong. Báo các trường xoá bộ nhớ trình duyệt rồi đăng nhập lại.')
