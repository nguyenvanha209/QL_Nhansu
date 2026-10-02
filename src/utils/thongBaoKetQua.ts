import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import type { DeXuatLuong } from '@/types/deXuat'
import type { VienChuc } from '@/types/vienChuc'
import { CHUC_VU_LABELS } from '@/types/vienChuc'
import type { DonVi } from '@/types/donVi'
import type { ChucDanhNgheNghiep } from '@/types/danhMuc'
import type { HeSoLuong } from '@/types/luong'
import {
  type CapHocTB, type DongThongBao, type KyXet, type LoaiThongBaoKQ, type ThongBaoKetQua,
  LOAI_THONG_BAO_KQ, TEN_CAP_TB, khoangKy, tenKy,
} from '@/types/thongBao'
import { CONG_VIEC_LABELS, nhomCoBan } from './nhomViTri'
import { formatDate } from './helpers'

const LA_CAP = (l?: string): l is CapHocTB => l === 'MAM_NON' || l === 'TIEU_HOC' || l === 'THCS'

export const tenNganTruong = (ten: string) =>
  ten.replace(/^Trường\s+/i, '').replace(/^(Mầm non|Tiểu học|THCS|Trung học cơ sở)\s+/i, '').trim()

const tenCapNgan: Record<CapHocTB, string> = { MAM_NON: 'MN', TIEU_HOC: 'TH', THCS: 'THCS' }

/** Phiếu đã qua thẩm định của Phòng VH-XH (chờ hoặc đã được lãnh đạo phê duyệt) mới được đưa vào thông báo */
const PHIEU_DUA_VAO: DeXuatLuong['trangThai'][] = ['CHO_PHE_DUYET', 'DA_PHE_DUYET']

interface NguonDuLieu {
  deXuats: DeXuatLuong[]
  vienChucs: VienChuc[]
  donVis: DonVi[]
  chucDanhs: ChucDanhNgheNghiep[]
  heSoLuongs: HeSoLuong[]
  /** Các thông báo khác (kỳ khác) cùng loại - để không đưa trùng người đã có trong thông báo trước */
  thongBaoKhac: ThongBaoKetQua[]
}

// Giáo viên hạng I (mầm non V.07.02.24, tiểu học V.07.03.27, THCS V.07.04.30): quyết định do UBND phường ban hành
const MA_GV_HANG_I = new Set(['V.07.02.24', 'V.07.03.27', 'V.07.04.30'])
const laGvHangI = (cd?: Pick<ChucDanhNgheNghiep, 'ma' | 'ten' | 'nhom'>) =>
  !!cd && (MA_GV_HANG_I.has(cd.ma.replace(/\s+/g, '')) || (cd.nhom === 'GIAO_VIEN' && /hạng\s+I(?![IV])/i.test(cd.ten)))

const truMotNam = (d?: string) => (d ? dayjs(d).subtract(1, 'year').format('YYYY-MM-DD') : undefined)

/** Tổng hợp danh sách một loại thông báo trong một kỳ từ các phiếu đề xuất đã thẩm định */
export function tongHopDanhSach(loai: LoaiThongBaoKQ, nam: number, ky: KyXet, nguon: NguonDuLieu): DongThongBao[] {
  const { tu, den } = khoangKy(ky, nam)
  const daCo = new Set(nguon.thongBaoKhac.filter((t) => t.loai === loai).flatMap((t) => t.dong.map((d) => d.key)))
  const vcTheoId = new Map(nguon.vienChucs.map((v) => [v.id, v]))
  const dvTheoId = new Map(nguon.donVis.map((d) => [d.id, d]))
  const cdTheoId = new Map(nguon.chucDanhs.map((c) => [c.id, c]))
  const ra: DongThongBao[] = []

  for (const dx of nguon.deXuats) {
    if (!PHIEU_DUA_VAO.includes(dx.trangThai)) continue
    const dungLoai = loai === 'NANG_LUONG_TX' ? dx.loai === 'NANG_BAC' : dx.loai === 'PHU_CAP_THAM_NIEN'
    if (!dungLoai) continue
    const dv = dvTheoId.get(dx.donViId)
    if (!dv || !LA_CAP(dv.loai)) continue

    for (const ct of dx.chiTiet) {
      const key = `${dx.id}__${ct.vienChucId}`
      if (daCo.has(key) || !ct.ngayHieuLuc) continue
      const lanDau = !(ct.pctnCu && ct.pctnCu > 0)
      if (loai === 'PCTN_LAN_DAU' && !lanDau) continue
      if (loai === 'PCTN_NANG' && lanDau) continue
      // Lần đầu có thể truy lĩnh từ trước (mốc hưởng cũ hơn kỳ); hai loại còn lại theo mốc hưởng trong kỳ
      if (ct.ngayHieuLuc > den) continue
      if (loai !== 'PCTN_LAN_DAU' && ct.ngayHieuLuc < tu) continue

      const vc = vcTheoId.get(ct.vienChucId)
      const cd = cdTheoId.get(ct.chucDanhMoiId || ct.chucDanhCuId || vc?.chucDanhId || '')
      const nhom = vc ? nhomCoBan(vc, cd?.nhom) : 'GIAO_VIEN'
      const laCBQL = vc?.chucVu === 'HT' || vc?.chucVu === 'P.HT'
      const chucVu = vc?.chucVu && CHUC_VU_LABELS[vc.chucVu] && laCBQL
        ? CHUC_VU_LABELS[vc.chucVu]
        : nhom === 'NHAN_VIEN' ? (vc?.congViec ? CONG_VIEC_LABELS[vc.congViec] : 'Nhân viên') : 'Giáo viên'
      const hs = nguon.heSoLuongs.find((h) => h.vienChucId === ct.vienChucId && h.isActive)

      const dong: DongThongBao = {
        key, deXuatId: dx.id, deXuatMa: dx.ma, daPheDuyet: dx.trangThai === 'DA_PHE_DUYET',
        vienChucId: ct.vienChucId, donViId: dv.id, donViTen: dv.ten, donViNgan: tenNganTruong(dv.ten), cap: dv.loai as CapHocTB,
        hoTen: vc ? `${vc.ho} ${vc.ten}`.trim() : ct.vienChucId,
        ngaySinh: vc?.ngaySinh, chucVu, laCBQL, nhom,
        chucDanhTen: cd?.ten ?? '', maChucDanh: cd?.ma ?? '',
        // Hiệu trưởng, Phó hiệu trưởng và giáo viên hạng I do UBND phường ra quyết định; còn lại Hiệu trưởng ra quyết định
        ghiChu: laCBQL || laGvHangI(cd) ? 'UBND phường ra QĐ' : undefined,
      }
      if (loai === 'NANG_LUONG_TX') {
        const vuotKhung = ct.tnvkMoi != null
        Object.assign(dong, {
          laVuotKhung: vuotKhung,
          bacCu: ct.bacCu, heSoCu: ct.heSoCu, tnvkCuPct: ct.tnvkCu || undefined,
          // Dòng vượt khung đã hưởng: mốc cũ là lần nâng vượt khung trước (cách 1 năm); lần đầu thì là mốc bậc cuối
          mocCu: vuotKhung && (ct.tnvkCu ?? 0) > 0 ? truMotNam(ct.ngayHieuLuc) : ct.ngayHieuLucCu,
          baoLuu: hs?.heSoBaoLuu || undefined,
          bacMoi: ct.bacMoi, heSoMoi: ct.heSoMoi, tnvkMoiPct: ct.tnvkMoi, mocMoi: ct.ngayHieuLuc,
        })
      } else {
        Object.assign(dong, {
          pctnCu: ct.pctnCu ?? 0, pctnMoi: ct.pctnMoi ?? 0,
          mocCu: lanDau ? undefined : truMotNam(ct.ngayHieuLuc), mocMoi: ct.ngayHieuLuc,
          ngayTuyenDung: vc?.ngayVaoBienChe,
          trinhDo: vc?.trinhDoChuyenMon,
          thangBatDauBhxh: vc?.ngayVaoNganh ? dayjs(vc.ngayVaoNganh).format('MM/YYYY') : undefined,
        })
      }
      ra.push(dong)
    }
  }
  return sapXepDong(ra)
}

/** Theo cấp học → trường → CBQL trước (HT, Phó HT), giáo viên, nhân viên → tên */
export function sapXepDong(ds: DongThongBao[]): DongThongBao[] {
  const thuTuNhom = { CBQL: 0, GIAO_VIEN: 1, NHAN_VIEN: 2 }
  const ten = (h: string) => h.split(' ').at(-1) ?? h
  return [...ds].sort((a, b) =>
    TEN_CAP_TB[a.cap].thuTu - TEN_CAP_TB[b.cap].thuTu
    || a.donViNgan.localeCompare(b.donViNgan, 'vi', { numeric: true })
    || (a.laCBQL === b.laCBQL ? 0 : a.laCBQL ? -1 : 1)
    || (a.chucVu === 'Hiệu trưởng' ? -1 : b.chucVu === 'Hiệu trưởng' ? 1 : 0)
    || thuTuNhom[a.nhom] - thuTuNhom[b.nhom]
    || ten(a.hoTen).localeCompare(ten(b.hoTen), 'vi')
    || a.hoTen.localeCompare(b.hoTen, 'vi'))
}

export function demTheoNhom(ds: DongThongBao[]) {
  return {
    tong: ds.length,
    cbql: ds.filter((d) => d.laCBQL).length,
    gv: ds.filter((d) => !d.laCBQL && d.nhom !== 'NHAN_VIEN').length,
    nv: ds.filter((d) => !d.laCBQL && d.nhom === 'NHAN_VIEN').length,
  }
}

const hs = (n?: number) => (n == null ? '' : Number(n.toFixed(3)))
const pct = (n?: number) => (n ? `${n}%` : '')
const tnvkHs = (heSo?: number, p?: number) => (heSo && p ? Number((heSo * p / 100).toFixed(3)) : '')
const ngay = (d?: string) => (d ? formatDate(d) : '')
const soTb = (tb: ThongBaoKetQua) => tb.soThongBao || '....'
const ngayTbChu = (tb: ThongBaoKetQua) => (tb.ngayThongBao ? formatDate(tb.ngayThongBao) : '..../..../.....')

/** Tiêu đề và cột từng loại, đúng thứ tự của mẫu danh sách kèm thông báo */
function cauTrucBang(loai: LoaiThongBaoKQ, cap: CapHocTB): { tieuDe: (string | null)[][]; merges: XLSX.Range[]; dong: (d: DongThongBao, i: number) => (string | number)[]; soCot: number } {
  const m = (r1: number, c1: number, r2: number, c2: number): XLSX.Range => ({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })
  if (loai === 'NANG_LUONG_TX') {
    return {
      soCot: 21,
      tieuDe: [
        ['STT', 'Họ và tên', 'Ngày sinh', 'Chức vụ', TEN_CAP_TB[cap].cot, 'Lương đang hưởng', null, null, null, null, null, null, null, 'Nâng bậc lương năm ' , null, null, null, null, null, null, 'Ghi chú'],
        [null, null, null, null, null, 'Mã chức danh nghề nghiệp', 'Bậc', 'Hệ số lương', 'Phụ cấp thâm niên vượt khung', null, 'Tổng hệ số lương', 'Thời điểm tính nâng bậc lương hoặc phụ cấp TNVK', 'Hệ số chênh lệch bảo lưu', 'Bậc', 'Hệ số lương', 'Phụ cấp thâm niên vượt khung', null, 'Tổng hệ số lương', 'Hệ số chênh lệch bảo lưu', 'Thời gian hưởng và mốc tính nâng bậc lương hoặc phụ cấp TNVK', null],
        [null, null, null, null, null, null, null, null, '%', 'Hệ số', null, null, null, null, null, '%', 'Hệ số', null, null, null, null],
        ['A', 'B', 'C', 'D', 'E', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16'],
      ],
      merges: [m(0, 0, 2, 0), m(0, 1, 2, 1), m(0, 2, 2, 2), m(0, 3, 2, 3), m(0, 4, 2, 4), m(0, 5, 0, 12), m(0, 13, 0, 19), m(0, 20, 2, 20),
        m(1, 5, 2, 5), m(1, 6, 2, 6), m(1, 7, 2, 7), m(1, 8, 1, 9), m(1, 10, 2, 10), m(1, 11, 2, 11), m(1, 12, 2, 12),
        m(1, 13, 2, 13), m(1, 14, 2, 14), m(1, 15, 1, 16), m(1, 17, 2, 17), m(1, 18, 2, 18), m(1, 19, 2, 19)],
      dong: (d, i) => {
        const tnCu = tnvkHs(d.heSoCu, d.tnvkCuPct)
        const tnMoi = tnvkHs(d.heSoMoi, d.tnvkMoiPct)
        return [i + 1, d.hoTen, ngay(d.ngaySinh), d.chucVu, d.donViNgan, d.maChucDanh, d.bacCu ?? '', hs(d.heSoCu), pct(d.tnvkCuPct), tnCu,
          hs((d.heSoCu ?? 0) + (Number(tnCu) || 0)), ngay(d.mocCu), d.baoLuu ? hs(d.baoLuu) : '',
          d.bacMoi ?? '', hs(d.heSoMoi), pct(d.tnvkMoiPct), tnMoi, hs((d.heSoMoi ?? 0) + (Number(tnMoi) || 0)), d.baoLuu ? hs(d.baoLuu) : '',
          ngay(d.mocMoi), d.ghiChu ?? '']
      },
    }
  }
  if (loai === 'PCTN_LAN_DAU') {
    return {
      soCot: 14,
      tieuDe: [
        ['TT', 'Họ và tên', 'Ngày, tháng, năm sinh', 'Chức danh, đơn vị công tác', 'Ngày, tháng, năm tuyển dụng là viên chức', 'Trình độ chuyên môn', null, 'Tháng năm bắt đầu tham gia giảng dạy, giáo dục có đóng BHXH bắt buộc', 'Xếp phụ cấp thâm niên nhà giáo', null, null, null, null, 'Ghi chú'],
        [null, null, null, null, null, 'Trình độ', 'Ngày, tháng, năm tốt nghiệp', null, 'Chức danh nghề nghiệp', 'Mã số', 'Tỷ lệ % phụ cấp nhà giáo được hưởng', 'Mốc xét nâng thâm niên lần sau', 'Thời gian hưởng', null],
      ],
      merges: [m(0, 0, 1, 0), m(0, 1, 1, 1), m(0, 2, 1, 2), m(0, 3, 1, 3), m(0, 4, 1, 4), m(0, 5, 0, 6), m(0, 7, 1, 7), m(0, 8, 0, 12), m(0, 13, 1, 13)],
      dong: (d, i) => [i + 1, d.hoTen, ngay(d.ngaySinh), `${d.chucVu} Trường ${tenCapNgan[d.cap]} ${d.donViNgan}`, ngay(d.ngayTuyenDung),
        d.trinhDo ?? '', ngay(d.ngayTotNghiep), d.thangBatDauBhxh ?? '', d.chucDanhTen, d.maChucDanh, pct(d.pctnMoi), ngay(d.mocMoi), ngay(d.mocMoi), d.ghiChu ?? ''],
    }
  }
  return {
    soCot: 12,
    tieuDe: [
      ['TT', 'Họ và tên', 'Ngày, tháng, năm sinh', 'Chức vụ, chức danh', 'Đơn vị công tác', 'Phụ cấp thâm niên nhà giáo đang hưởng', null, null, null, 'Nâng phụ cấp thâm niên nhà giáo', null, 'Ghi chú'],
      [null, null, null, null, null, 'Chức danh nghề nghiệp', 'Mã', 'Tỷ lệ % PC đang hưởng', 'Thời điểm tính PC đang hưởng', 'Tỷ lệ % PC nâng (mới)', 'Thời điểm tính PC nâng (mới)', null],
    ],
    merges: [m(0, 0, 1, 0), m(0, 1, 1, 1), m(0, 2, 1, 2), m(0, 3, 1, 3), m(0, 4, 1, 4), m(0, 5, 0, 8), m(0, 9, 0, 10), m(0, 11, 1, 11)],
    dong: (d, i) => [i + 1, d.hoTen, ngay(d.ngaySinh), d.chucVu, `${tenCapNgan[d.cap]} ${d.donViNgan}`, d.chucDanhTen, d.maChucDanh,
      pct(d.pctnCu), ngay(d.mocCu), pct(d.pctnMoi), ngay(d.mocMoi), d.ghiChu ?? ''],
  }
}

/** Xuất danh sách kèm thông báo theo mẫu: mỗi cấp học một trang tính. `chiCap` để trường chỉ lấy cấp của mình. */
export function xuatExcelThongBao(tb: ThongBaoKetQua, chiCap?: CapHocTB) {
  const wb = XLSX.utils.book_new()
  const loaiInfo = LOAI_THONG_BAO_KQ[tb.loai]
  const capCo = (['MAM_NON', 'TIEU_HOC', 'THCS'] as CapHocTB[]).filter((c) => (!chiCap || c === chiCap) && tb.dong.some((d) => d.cap === c))
  for (const cap of capCo) {
    const ds = tb.dong.filter((d) => d.cap === cap)
    const bang = cauTrucBang(tb.loai, cap)
    const tieuDeDs = tb.loai === 'PCTN_LAN_DAU' ? `${loaiInfo.tieuDeDs} - Năm ${tb.nam}` : `${loaiInfo.tieuDeDs} ${tenKy(tb.ky, tb.nam)}`
    const dau: (string | number | null)[][] = [
      ['ỦY BAN NHÂN DÂN', null, null, null, null, 'DANH SÁCH'],
      ['PHƯỜNG GIA VIÊN', null, null, null, null, tieuDeDs],
      [null, null, null, null, null, `- ${TEN_CAP_TB[cap].danhSach} -`],
      [null, null, null, null, null, `(Kèm theo Thông báo số ${soTb(tb)}/TB-UBND ngày ${ngayTbChu(tb)} của UBND phường Gia Viên)`],
      [],
    ]
    const tieuDe = bang.tieuDe.map((r) => r.map((c) => (c === 'Nâng bậc lương năm ' ? `Nâng bậc lương năm ${tb.nam}` : c === 'Nâng phụ cấp thâm niên nhà giáo' ? `Nâng phụ cấp thâm niên nhà giáo ${tenKy(tb.ky, tb.nam).replace('6 tháng ', '')}` : c)))
    const aoa = [...dau, ...tieuDe, ...ds.map(bang.dong), [], [`Tổng số: ${String(ds.length).padStart(2, '0')} người`]]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    const lech = dau.length
    ws['!merges'] = [
      ...bang.merges.map((r) => ({ s: { r: r.s.r + lech, c: r.s.c }, e: { r: r.e.r + lech, c: r.e.c } })),
      ...[0, 1, 2, 3].map((r) => ({ s: { r, c: 5 }, e: { r, c: bang.soCot - 1 } })),
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    ]
    ws['!cols'] = Array.from({ length: bang.soCot }, (_, c) => ({ wch: c === 1 ? 24 : c === 0 ? 5 : 11 }))
    XLSX.utils.book_append_sheet(wb, ws, tenCapNgan[cap] === 'MN' ? 'Mầm non' : tenCapNgan[cap] === 'TH' ? 'Tiểu học' : 'THCS')
  }
  if (!capCo.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Không có viên chức trong danh sách']]), 'Danh sách')
  const so = (tb.soThongBao || 'nhap').replace(/[\\/:*?"<>|]/g, '-')
  XLSX.writeFile(wb, `DS-TB-${so}-${loaiInfo.tenNgan.replace(/\s+/g, '-')}-${tb.ky}-${tb.nam}${chiCap ? `-${tenCapNgan[chiCap]}` : ''}.xlsx`)
}

const CAN_CU_CHUNG = [
  'Căn cứ Luật Tổ chức Chính quyền địa phương số 72/2025/QH15 ngày 16/06/2025;',
  'Căn cứ Luật Viên chức số 129/2025/QH15 ngày 10/12/2025;',
]
const CAN_CU_QD_HP = 'Căn cứ Quyết định số 62/2022/QĐ-UBND ngày 02/11/2022 của Uỷ ban nhân dân thành phố Hải Phòng về việc ban hành quy định một số nội dung về quản lý tổ chức bộ máy, quản lý viên chức và lao động hợp đồng trong các đơn vị sự nghiệp công lập thuộc thành phố Hải Phòng, Quyết định số 36/2024/QĐ-UBND ngày 31/10/2024 của Uỷ ban nhân dân thành phố Hải Phòng sửa đổi, bổ sung một số điều của Quy định ban hành kèm theo Quyết định số 62/2022/QĐ-UBND;'

/** Nội dung thông báo theo mẫu, điền sẵn số liệu - các đoạn văn trả về để vừa xem trước vừa xuất Word */
export function noiDungThongBao(tb: ThongBaoKetQua): { tieuDe: string; canCu: string[]; doan: string[] } {
  const d = demTheoNhom(tb.dong)
  const ky = tenKy(tb.ky, tb.nam)
  if (tb.loai === 'NANG_LUONG_TX') {
    return {
      tieuDe: `Viên chức đủ điều kiện nâng bậc lương thường xuyên ${ky}`,
      canCu: [...CAN_CU_CHUNG,
        'Căn cứ Nghị định số 204/2004/NĐ-CP ngày 14/12/2004 của Chính phủ về chế độ tiền lương đối với cán bộ, công chức, viên chức; Căn cứ Thông tư số 08/2013/TT-BNV ngày 31/7/2013 của Bộ Nội vụ hướng dẫn thực hiện chế độ nâng bậc lương thường xuyên và nâng bậc lương trước thời hạn đối với cán bộ, công chức, viên chức và người lao động; Thông tư 03/2021/TT-BNV ngày 29/6/2021 của Bộ Nội vụ sửa đổi, bổ sung chế độ nâng bậc lương thường xuyên, nâng bậc lương trước thời hạn và chế độ phụ cấp thâm niên vượt khung đối với cán bộ, công chức, viên chức và người lao động;',
        CAN_CU_QD_HP],
      doan: [
        `Xét đề nghị của Thủ trưởng các đơn vị sự nghiệp công lập, sau khi xem xét hồ sơ và đối chiếu với quy định, UBND phường Gia Viên thông báo viên chức đủ điều kiện nâng bậc lương thường xuyên ${ky}, cụ thể như sau:`,
        `Số viên chức đủ điều kiện nâng bậc lương thường xuyên ${ky} là ${d.tong} người (Trong đó: Cán bộ quản lý: ${d.cbql} người, Giáo viên: ${d.gv} người, Nhân viên: ${d.nv} người).`,
        '(Có danh sách kèm theo Thông báo này)',
        'Căn cứ Thông báo này, UBND phường yêu cầu:',
        '1. Thủ trưởng các đơn vị sự nghiệp công lập ban hành Quyết định nâng bậc lương thường xuyên đối với viên chức theo thẩm quyền và gửi Quyết định về UBND phường (qua Phòng Văn hóa - Xã hội) để tổng hợp, theo dõi.',
        '2. Phòng Văn hóa - Xã hội phường tham mưu, giúp Chủ tịch UBND phường ban hành Quyết định nâng bậc lương thường xuyên đối với viên chức quản lý theo thẩm quyền.',
        'UBND phường thông báo để các đơn vị, cá nhân biết, thực hiện./.',
      ],
    }
  }
  if (tb.loai === 'PCTN_LAN_DAU') {
    return {
      tieuDe: `Về việc thực hiện chế độ phụ cấp thâm niên nhà giáo lần đầu năm ${tb.nam}`,
      canCu: [...CAN_CU_CHUNG, 'Căn cứ Nghị định số 77/2021/NĐ-CP ngày 01/8/2021 của Chính phủ quy định chế độ phụ cấp thâm niên nhà giáo;', CAN_CU_QD_HP],
      doan: [
        `Xét đề nghị của Hiệu trưởng các trường mầm non, tiểu học, THCS thuộc phường về hưởng phụ cấp thâm niên nhà giáo lần đầu đối với viên chức giáo viên và kết quả thẩm định hồ sơ của Phòng Văn hóa - Xã hội, UBND phường Gia Viên thông báo để Hiệu trưởng các trường mầm non, tiểu học, THCS thuộc phường ban hành quyết định thực hiện chế độ phụ cấp thâm niên nhà giáo lần đầu đối với ${d.tong} viên chức giáo viên (có danh sách cụ thể kèm theo).`,
        'UBND phường thông báo để Hiệu trưởng các trường mầm non, tiểu học, THCS thuộc phường có cơ sở thực hiện. (Gửi 01 bản Quyết định về Phòng Văn hóa - Xã hội phường để tổng hợp hồ sơ, báo cáo UBND phường)./.',
      ],
    }
  }
  return {
    tieuDe: `Viên chức đủ điều kiện nâng phụ cấp thâm niên nhà giáo ${ky.replace('6 tháng', '06 tháng')}`,
    canCu: [...CAN_CU_CHUNG, 'Căn cứ Nghị định số 77/2021/NĐ-CP ngày 01/8/2021 của Chính phủ quy định chế độ phụ cấp thâm niên nhà giáo;', CAN_CU_QD_HP],
    doan: [
      `Xét đề nghị của Hiệu trưởng các trường mầm non, tiểu học, THCS thuộc phường và kết quả thẩm định hồ sơ của Phòng Văn hóa - Xã hội, UBND phường Gia Viên thông báo viên chức đủ điều kiện nâng phụ cấp thâm niên nhà giáo ${ky.replace('6 tháng', '06 tháng')}, cụ thể như sau:`,
      `Số viên chức đủ điều kiện nâng phụ cấp thâm niên nhà giáo ${ky.replace('6 tháng', '06 tháng')}: ${d.tong} người (Trong đó: Cán bộ quản lý: ${d.cbql} người, giáo viên: ${d.gv} người).`,
      '(có danh sách cụ thể kèm theo).',
      'Căn cứ Thông báo này, UBND phường yêu cầu:',
      '1. Thủ trưởng các đơn vị sự nghiệp công lập thuộc phường ban hành Quyết định nâng phụ cấp thâm niên nhà giáo đối với viên chức theo thẩm quyền và gửi quyết định về UBND phường (qua Phòng Văn hóa - Xã hội) để tổng hợp, theo dõi.',
      '2. Phòng Văn hóa - Xã hội phường tham mưu, giúp Chủ tịch UBND phường ban hành Quyết định nâng phụ cấp thâm niên nhà giáo đối với viên chức quản lý theo thẩm quyền.',
      'UBND phường thông báo để các đơn vị, cá nhân có liên quan biết, thực hiện./.',
    ],
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Tải thông báo dạng Word (.doc) theo mẫu thể thức - mở bằng Word để chỉnh, ký số */
export function taiWordThongBao(tb: ThongBaoKetQua) {
  const nd = noiDungThongBao(tb)
  const ngayTb = tb.ngayThongBao ? dayjs(tb.ngayThongBao) : undefined
  const ngayChu = ngayTb ? `Gia Viên, ngày ${ngayTb.format('DD')} tháng ${ngayTb.month() + 1} năm ${ngayTb.year()}` : 'Gia Viên, ngày ..... tháng ..... năm .........'
  const p = (t: string) => `<p style="text-indent:1cm;text-align:justify;margin:0 0 6pt 0">${esc(t)}</p>`
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8">
<style>@page{size:21cm 29.7cm;margin:2cm 1.5cm 2cm 3cm} body{font-family:'Times New Roman';font-size:14pt;line-height:1.3} td{font-family:'Times New Roman';font-size:13pt;vertical-align:top}</style></head><body>
<table width="100%" style="border-collapse:collapse"><tr>
<td width="40%" style="text-align:center"><b>ỦY BAN NHÂN DÂN<br>PHƯỜNG GIA VIÊN</b><br>______<br>Số: ${esc(soTb(tb))}/TB-UBND</td>
<td width="60%" style="text-align:center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>Độc lập - Tự do - Hạnh phúc</b><br>_______________<br><i>${esc(ngayChu)}</i></td></tr></table>
<p style="text-align:center;margin:18pt 0 0 0"><b>THÔNG BÁO</b></p>
<p style="text-align:center;margin:0 0 12pt 0"><b>${esc(nd.tieuDe)}</b></p>
${nd.canCu.map(p).join('')}${nd.doan.map(p).join('')}
<table width="100%" style="border-collapse:collapse;margin-top:12pt"><tr>
<td width="50%" style="font-size:12pt"><b><i>Nơi nhận:</i></b><br>- CT, các PCT UBND phường;<br>- Các phòng: VHXH, KT;<br>- Các trường học công lập;<br>- Lưu: VT.</td>
<td width="50%" style="text-align:center"><b>TM. ỦY BAN NHÂN DÂN<br>CHỦ TỊCH</b><br><br><br><br><br><b>${esc(tb.nguoiKy || '')}</b></td></tr></table>
</body></html>`
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `TB-${(tb.soThongBao || 'nhap').replace(/[\\/:*?"<>|]/g, '-')}-${LOAI_THONG_BAO_KQ[tb.loai].tenNgan.replace(/\s+/g, '-')}-${tb.ky}-${tb.nam}.doc`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
