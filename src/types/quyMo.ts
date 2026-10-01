export interface QuyMoKhoi {
  soLop: number
  soHocSinh: number
  /** Tiểu học, THCS: trong đó số lớp, số học sinh học 2 buổi/ngày */
  soLop2Buoi?: number
  soHocSinh2Buoi?: number
}

/** Phần người dùng khai báo của một bản quy mô */
export type NoiDungQuyMo = Pick<QuyMoTruong, 'khoi' | 'khoiDayTinThem' | 'dinhMucNhapTay' | 'kiemNhiemNhapTay' | 'soDiemTruong' | 'ghiChu'>

/** Một lần lưu quy mô: giữ nguyên nội dung để xem lại, so sánh và khôi phục khi dữ liệu bị mất hoặc ghi nhầm */
export interface QuyMoLichSu {
  id: string
  /** id của bản quy mô (`${donViId}__${namHoc}`) */
  quyMoId: string
  donViId: string
  namHoc: string
  thoiGian: string
  nguoiId?: string
  nguoiTen?: string
  noiDung: NoiDungQuyMo
  /** VD "Bản có sẵn trước khi có lịch sử" */
  ghiChuBan?: string
}

/** Quy mô trường lớp của một trường trong một năm học - trường tự khai báo */
export interface QuyMoTruong {
  /** `${donViId}__${namHoc}`: cố định để hai máy cùng khai báo không sinh hai bản ghi */
  id: string
  donViId: string
  /** Dạng '2026-2027' */
  namHoc: string
  /** Mã khối → số lớp, số học sinh (MN: NHA_TRE, MG3, MG4, MG5; TH: L1-L5; THCS: L6-L9) */
  khoi: Record<string, QuyMoKhoi>
  /** Tiểu học: khối 1, 2 trường có dạy Tin học (khối 3-5 bắt buộc theo chương trình) */
  khoiDayTinThem?: string[]
  /** Định mức trường tự điều chỉnh theo vị trí (mã vị trí → số người), khi có căn cứ riêng */
  dinhMucNhapTay?: Record<string, number>
  /**
   * THCS: số giáo viên kiêm nhiệm (dạy kiêm GDĐP, HĐTN-HN, chủ nhiệm, kiêm nhiệm khác) trường tự phân bổ
   * cho từng môn (mã môn → số người). Môn không ghi thì hệ thống chia phần còn lại theo tỷ lệ giờ đứng lớp.
   */
  kiemNhiemNhapTay?: Record<string, number>
  /** Mầm non: số phân hiệu (điểm trường) - căn cứ chỉ tiêu nhân viên thư viện */
  soDiemTruong?: number
  ghiChu?: string
  nguoiCapNhatId?: string
  nguoiCapNhat?: string
  createdAt: string
  updatedAt: string
}
