// Công cụ can thiệp CSDL thủ công
//
//   node tools/db.mjs keys                       Liệt kê các key + dung lượng
//   node tools/db.mjs get <key> [duong.dan]      Xem dữ liệu (cắt bớt nếu dài)
//   node tools/db.mjs backup                     Tải toàn bộ về file .json
//   node tools/db.mjs restore <file.json>        Khôi phục từ file backup
//   node tools/db.mjs find <key> <truong> <gtri> Tìm bản ghi trong mảng
//   node tools/db.mjs set <key> <duong.dan> <gt> Sửa 1 giá trị  (cần --apply)
//   node tools/db.mjs del <key>                  Xoá 1 key      (cần --apply)
//
// Mặc định chỉ XEM TRƯỚC. Thêm --apply mới ghi thật.
// Mọi lệnh ghi đều tự sao lưu vào tools/backups/ trước khi thực hiện.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BACKUP_DIR = path.join(ROOT, 'tools', 'backups')
const APPLY = process.argv.includes('--apply')
const [, , cmd, ...args] = process.argv.filter((a) => a !== '--apply')

const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
const URL_SB = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim()
const KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()

const sb = async (method, url, body) => {
  const res = await fetch(`${URL_SB}/rest/v1/${url}`, {
    method,
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

const kb = (o) => `${Math.round(JSON.stringify(o).length / 1024)} KB`

// Đọc theo đường dẫn kiểu "state.users.0.username"
const dig = (obj, duongDan) =>
  duongDan.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)

async function saoLuu(nhan) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const rows = await sb('GET', 'app_state?select=key,value')
  const f = path.join(BACKUP_DIR, `${nhan}-${Date.now()}.json`)
  fs.writeFileSync(f, JSON.stringify(rows, null, 2), 'utf8')
  console.log(`✓ Sao lưu -> tools/backups/${path.basename(f)}`)
  return rows
}

async function main() {
switch (cmd) {
  case 'keys': {
    const rows = await sb('GET', 'app_state?select=key,value')
    console.log(`\n${rows.length} key trên máy chủ:\n`)
    for (const r of rows) {
      const s = r.value?.state ?? {}
      const mang = Object.entries(s)
        .filter(([, v]) => Array.isArray(v))
        .map(([k, v]) => `${k}=${v.length}`)
      console.log(`  ${r.key.padEnd(22)} ${kb(r.value).padStart(8)}  ${mang.join(' ')}`)
    }
    break
  }

  case 'get': {
    const [key, duongDan] = args
    if (!key) return console.error('Thiếu tên key. Chạy: node tools/db.mjs keys')
    const rows = await sb('GET', `app_state?key=eq.${key}&select=value`)
    if (!rows.length) return console.error(`Không có key "${key}"`)
    const val = duongDan ? dig(rows[0].value, duongDan) : rows[0].value
    const out = JSON.stringify(val, null, 2)
    console.log(out.length > 4000 ? out.slice(0, 4000) + `\n... (còn ${out.length - 4000} ký tự)` : out)
    break
  }

  case 'find': {
    const [key, truong, giaTri] = args
    if (!giaTri) return console.error('Dùng: node tools/db.mjs find ql-vien-chuc ten HOA')
    const rows = await sb('GET', `app_state?key=eq.${key}&select=value`)
    const state = rows[0].value.state
    let thay = 0
    for (const [ten, mang] of Object.entries(state)) {
      if (!Array.isArray(mang)) continue
      mang.forEach((bg, i) => {
        const v = String(bg?.[truong] ?? '')
        if (v.toLowerCase().includes(giaTri.toLowerCase())) {
          console.log(`\n${ten}[${i}]  (đường dẫn: state.${ten}.${i})`)
          console.log(JSON.stringify(bg, null, 2).slice(0, 700))
          thay++
        }
      })
    }
    console.log(`\nTìm thấy ${thay} bản ghi.`)
    break
  }

  case 'backup':
    await saoLuu('thucong')
    break

  case 'restore': {
    const [file] = args
    if (!file) return console.error('Thiếu tên file backup')
    const duong = path.isAbsolute(file) ? file : path.join(ROOT, file)
    const rows = JSON.parse(fs.readFileSync(duong, 'utf8'))
    console.log(`Khôi phục ${rows.length} key từ ${path.basename(duong)}:`)
    rows.forEach((r) => console.log(`  ${r.key.padEnd(22)} ${kb(r.value)}`))
    if (!APPLY) { console.log('\n(Xem trước — thêm --apply để ghi thật)'); break }
    await saoLuu('truoc-khi-restore')
    for (const r of rows) {
      await sb('PATCH', `app_state?key=eq.${r.key}`, { value: r.value, updated_at: new Date().toISOString() })
      console.log(`  ✓ ${r.key}`)
    }
    console.log('\n✓ Xong. Xoá localStorage trình duyệt rồi tải lại trang.')
    break
  }

  case 'set': {
    const [key, duongDan, giaTriMoi] = args
    if (giaTriMoi === undefined) return console.error('Dùng: node tools/db.mjs set ql-users state.users.0.active false')
    const rows = await sb('GET', `app_state?key=eq.${key}&select=value`)
    if (!rows.length) return console.error(`Không có key "${key}"`)
    const value = rows[0].value

    const phan = duongDan.split('.')
    const cuoi = phan.pop()
    const cha = dig(value, phan.join('.'))
    if (cha == null) return console.error(`Không tìm thấy đường dẫn "${phan.join('.')}"`)

    let moi
    try { moi = JSON.parse(giaTriMoi) } catch { moi = giaTriMoi }

    console.log(`\n${key} -> ${duongDan}`)
    console.log(`  cũ  : ${JSON.stringify(cha[cuoi])}`)
    console.log(`  mới : ${JSON.stringify(moi)}`)
    if (!APPLY) { console.log('\n(Xem trước — thêm --apply để ghi thật)'); break }

    await saoLuu(`truoc-set-${key}`)
    cha[cuoi] = moi
    await sb('PATCH', `app_state?key=eq.${key}`, { value, updated_at: new Date().toISOString() })
    console.log('\n✓ Đã ghi. Xoá localStorage trình duyệt rồi tải lại trang.')
    break
  }

  case 'del': {
    const [key] = args
    if (!key) return console.error('Thiếu tên key')
    console.log(`Sẽ XOÁ hẳn key "${key}" khỏi máy chủ.`)
    if (!APPLY) { console.log('(Xem trước — thêm --apply để xoá thật)'); break }
    await saoLuu(`truoc-xoa-${key}`)
    await sb('DELETE', `app_state?key=eq.${key}`)
    console.log(`✓ Đã xoá "${key}".`)
    break
  }

  default:
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'))
}
}

main().catch((e) => { console.error('Lỗi:', e.message); process.exit(1) })
