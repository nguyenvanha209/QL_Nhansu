export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function matchSearch(text: string, query: string): boolean {
  if (!query) return true
  return normalize(text).includes(normalize(query))
}

export function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function splitHoTen(fullName: string): { ho: string; ten: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return { ho: '', ten: parts[0] ?? '' }
  return { ho: parts.slice(0, -1).join(' '), ten: parts[parts.length - 1] }
}

export function formatDatetime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('vi-VN')
}

export function toProperName(s: string): string {
  if (!s) return s
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Hôm nay'
  if (days === 1) return 'Hôm qua'
  if (days < 30) return `${days} ngày trước`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} tháng trước`
  return `${Math.floor(months / 12)} năm trước`
}
