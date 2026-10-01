import type { NoiDungQuyMo, QuyMoTruong } from '@/types/quyMo'
import { type CapHoc, CO_HAI_BUOI, KHOI, fmt, tongQuyMo } from './dinhMuc'

/** Lấy phần người dùng khai báo của một bản quy mô (bản sao độc lập, không dùng chung tham chiếu) */
export function layNoiDung(q: Pick<QuyMoTruong, 'khoi' | 'khoiDayTinThem' | 'dinhMucNhapTay' | 'kiemNhiemNhapTay' | 'soDiemTruong' | 'ghiChu'>): NoiDungQuyMo {
  return JSON.parse(JSON.stringify({
    khoi: q.khoi,
    khoiDayTinThem: q.khoiDayTinThem,
    dinhMucNhapTay: q.dinhMucNhapTay,
    kiemNhiemNhapTay: q.kiemNhiemNhapTay,
    soDiemTruong: q.soDiemTruong,
    ghiChu: q.ghiChu,
  })) as NoiDungQuyMo
}

export const giongNhau = (a: NoiDungQuyMo, b: NoiDungQuyMo) => JSON.stringify(a) === JSON.stringify(b)

/** VD "40 lớp, 1.353 học sinh; học 2 buổi: 40 lớp, 1.353 học sinh" */
export function tomTatNoiDung(nd: NoiDungQuyMo, cap: CapHoc): string {
  const t = tongQuyMo({ khoi: nd.khoi } as QuyMoTruong, cap)
  let kq = `${t.tongLop} lớp, ${t.tongHS.toLocaleString('vi-VN')} học sinh`
  if (CO_HAI_BUOI[cap]) kq += `; học 2 buổi: ${t.tongLop2Buoi} lớp, ${t.tongHS2Buoi.toLocaleString('vi-VN')} học sinh`
  return kq
}

type TruongKhoi = 'soLop' | 'soHocSinh' | 'soLop2Buoi' | 'soHocSinh2Buoi'
const TEN_TRUONG: Record<TruongKhoi, string> = { soLop: 'số lớp', soHocSinh: 'số học sinh', soLop2Buoi: 'lớp 2 buổi', soHocSinh2Buoi: 'học sinh 2 buổi' }

/** Những chỗ khác nhau giữa hai bản, dạng câu ngắn, để người dùng biết bản cũ khác bản hiện tại ở đâu */
export function soSanhNoiDung(truoc: NoiDungQuyMo | undefined, sau: NoiDungQuyMo, cap: CapHoc): string[] {
  if (!truoc) return []
  const ra: string[] = []
  for (const k of KHOI[cap]) {
    const a = truoc.khoi[k.ma], b = sau.khoi[k.ma]
    const truongs: TruongKhoi[] = ['soLop', 'soHocSinh', ...(CO_HAI_BUOI[cap] ? (['soLop2Buoi', 'soHocSinh2Buoi'] as const) : [])]
    const doi = truongs
      .filter((f) => (a?.[f] ?? 0) !== (b?.[f] ?? 0))
      .map((f) => `${TEN_TRUONG[f]} ${a?.[f] ?? 0} → ${b?.[f] ?? 0}`)
    if (doi.length) ra.push(`${k.ten}: ${doi.join(', ')}`)
  }
  const tin = (x?: string[]) => [...(x ?? [])].sort().join(',')
  if (tin(truoc.khoiDayTinThem) !== tin(sau.khoiDayTinThem)) {
    ra.push(`Tin học khối 1, 2: ${tin(truoc.khoiDayTinThem) || 'không'} → ${tin(sau.khoiDayTinThem) || 'không'}`)
  }
  const soMap = (m?: Record<string, number>) => Object.entries(m ?? {})
  const soSanhMap = (nhan: string, a?: Record<string, number>, b?: Record<string, number>) => {
    const ma = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])
    for (const key of [...ma].sort()) {
      if ((a?.[key]) !== (b?.[key])) ra.push(`${nhan} ${key}: ${a?.[key] == null ? '-' : fmt(a[key])} → ${b?.[key] == null ? '-' : fmt(b[key])}`)
    }
  }
  if (soMap(truoc.dinhMucNhapTay).length || soMap(sau.dinhMucNhapTay).length) soSanhMap('Điều chỉnh định mức', truoc.dinhMucNhapTay, sau.dinhMucNhapTay)
  if (soMap(truoc.kiemNhiemNhapTay).length || soMap(sau.kiemNhiemNhapTay).length) soSanhMap('Kiêm nhiệm điều chỉnh', truoc.kiemNhiemNhapTay, sau.kiemNhiemNhapTay)
  if ((truoc.soDiemTruong ?? 0) !== (sau.soDiemTruong ?? 0)) ra.push(`Số phân hiệu: ${truoc.soDiemTruong ?? '-'} → ${sau.soDiemTruong ?? '-'}`)
  if ((truoc.ghiChu ?? '').trim() !== (sau.ghiChu ?? '').trim()) ra.push('Ghi chú, căn cứ số liệu có thay đổi')
  return ra
}
