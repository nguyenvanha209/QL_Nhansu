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
  return new Date(iso).toLocaleDateString('vi-VN')
}

export function formatDatetime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('vi-VN')
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
