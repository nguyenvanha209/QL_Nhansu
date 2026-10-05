import { trangTuDanhSach, xuatExcelA4 } from './excelA4'

/** Xuất danh sách ra Excel khổ A4 (kẻ khung, lề 1,5 - 1 - 1 - 1 cm, vừa chiều ngang trang) */
export function exportToExcel(data: Record<string, any>[], filename: string, sheetName = 'Dữ liệu', tieuDe?: string[]) {
  return xuatExcelA4(filename, [trangTuDanhSach(data, sheetName, { tieuDe })]).catch((e) => {
    console.error('[xuat excel]', e)
    alert('Không xuất được file Excel. Tải lại trang rồi thử lại.')
  })
}
