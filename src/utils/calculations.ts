export function getDaysUntilReview(ngayNangLuongTiepTheo: string): number {
  const d = new Date(ngayNangLuongTiepTheo)
  const now = new Date()
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getReviewUrgencyColor(days: number): string {
  if (days < 0) return 'red'
  if (days <= 30) return 'red'
  if (days <= 90) return 'orange'
  if (days <= 180) return 'gold'
  return 'green'
}
