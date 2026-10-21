import type { MinhChung } from '@/lib/minhChung'

export type TrangThaiDeXuat =
  | 'NHAP'
  | 'CHO_HIEU_TRUONG_DUYET'
  | 'CHO_XET_DUYET'
  | 'CHO_PHE_DUYET'
  | 'DA_PHE_DUYET'
  | 'TU_CHOI'
  | 'YEU_CAU_BO_SUNG'

export type LoaiDeXuat = 'NANG_BAC' | 'NANG_TRUOC_HAN' | 'DIEU_CHINH' | 'CHUYEN_NGACH' | 'PHU_CAP_THAM_NIEN' | 'PCTN_LAN_DAU'

/** Một mức trong quá trình hưởng phụ cấp thâm niên lần đầu (có thể truy lĩnh nhiều năm: 5%, 6%…) */
export interface DongQuaTrinhPctn {
  tyLe: number
  /** Mốc xét nâng thâm niên (ngày kỷ niệm) */
  mocXet: string
  /** Thời gian bắt đầu hưởng mức này */
  thoiGianHuong: string
}

/** Kế toán khai báo để xếp phụ cấp thâm niên nhà giáo lần đầu (theo hồ sơ: bằng cấp, QĐ tuyển dụng, quá trình BHXH) */
export interface KhaiPctnLanDau {
  ngayTuyenDung?: string
  trinhDo?: string
  ngayTotNghiep?: string
  /** Tháng năm bắt đầu tham gia giảng dạy, giáo dục có đóng BHXH bắt buộc - 'YYYY-MM' */
  batDauBhxh?: string
  thangTapSu: number
  /** Thời gian không tính khác (nghỉ không lương, ốm đau quá hạn, đi học quá hạn…) - số tháng */
  thangKhongTinhKhac: number
  lyDoKhongTinh?: string
  /** Ngày bắt đầu được hưởng (thường từ khi tuyển dụng) - mốc trước ngày này không được trả */
  huongTu?: string
  quaTrinh: DongQuaTrinhPctn[]
}

// Phiếu đề xuất phụ cấp thâm niên dùng các trường pctn*, phiếu nâng lương dùng bac*/heSo*
export interface ChiTietDeXuat {
  vienChucId: string
  chucDanhCuId: string
  bacCu: number
  heSoCu: number
  chucDanhMoiId: string
  bacMoi: number
  heSoMoi: number
  ngayHieuLuc: string
  lyDo: string
  ghiChu?: string
  // Phụ cấp thâm niên (%): mốc hưởng dùng chung trường ngayHieuLuc
  pctnCu?: number
  pctnMoi?: number
  /** Mốc hưởng bậc hiện tại (lúc lập phiếu) để người duyệt đối chiếu */
  ngayHieuLucCu?: string
  /** Ngày đến hạn nâng bậc theo niên hạn (lúc lập phiếu) - căn cứ kiểm tra nâng trước hạn */
  ngayDenHanCu?: string
  /** Minh chứng riêng của người này (VD giấy khen khi nâng bậc trước hạn) */
  minhChung?: MinhChung[]
  /**
   * Phụ cấp thâm niên vượt khung (%) - dòng của người đã ở bậc cuối trong phiếu nâng bậc thường xuyên:
   * giữ nguyên bậc, hưởng 5% (lần đầu) rồi mỗi năm +1% (TT 08/2013, TT 03/2021). Có tnvkMoi = dòng vượt khung.
   */
  tnvkCu?: number
  tnvkMoi?: number
  /** Phiếu xếp phụ cấp thâm niên lần đầu: phần kế toán khai báo; pctnMoi / ngayHieuLuc lấy theo mức cuối của quá trình */
  lanDau?: KhaiPctnLanDau
  /** Nâng bậc lương trước thời hạn: thành tích xuất sắc làm căn cứ (TT 08/2013, TT 03/2021) */
  thanhTich?: ThanhTichTruocHan
  /** Số tháng được nâng trước (theo Quy chế của trường, tối đa 12) */
  soThangTruocHan?: number
  /** Phòng VHXH thẩm định từng người - người không đồng ý không được ghi hồ sơ khi phê duyệt */
  thamDinh?: 'DONG_Y' | 'KHONG_DONG_Y'
  yKienThamDinh?: string
  /** Phiếu Điều chỉnh: các phụ cấp điều chỉnh mức (cũ → mới) - phê duyệt xong ghi vào hồ sơ phụ cấp */
  phuCaps?: DieuChinhPhuCap[]
}

/** Dòng phiếu có đổi phần lương (ngạch, bậc, hệ số, mốc hưởng) - phiếu Điều chỉnh chỉ đổi phụ cấp thì giữ nguyên bản lương */
export const coDoiLuong = (ct: ChiTietDeXuat) => ct.chucDanhMoiId !== ct.chucDanhCuId || ct.bacMoi !== ct.bacCu
  || Math.abs(Number(ct.heSoMoi) - Number(ct.heSoCu)) > 0.0005 || (ct.ngayHieuLuc || '') !== (ct.ngayHieuLucCu || '')

/** Phụ cấp có thay đổi thật (đổi loại trong họ hoặc đổi mức) */
export const coDoiPhuCap = (p: DieuChinhPhuCap) => p.loaiPhuCapId !== (p.loaiPhuCapCuId ?? p.loaiPhuCapId) || p.giaTriMoi !== (p.giaTriCu ?? 0)

/** Một phụ cấp điều chỉnh trong phiếu Điều chỉnh hệ số lương - phụ cấp */
export interface DieuChinhPhuCap {
  /** Loại phụ cấp mới (ưu đãi nghề: đổi mức = đổi loại PCUD_xx) */
  loaiPhuCapId: string
  /** Loại và mức đang hưởng lúc lập phiếu (trống = chưa hưởng) */
  loaiPhuCapCuId?: string
  giaTriCu?: number
  /** Mức mới theo đơn vị của loại (%, hệ số, đồng); 0 = thôi hưởng */
  giaTriMoi: number
  ngayHieuLuc: string
}

/** Thành tích xuất sắc làm căn cứ nâng bậc lương trước thời hạn */
export interface ThanhTichTruocHan {
  /** id mức trong bảng "Mức nâng trước hạn theo thành tích" (nếu chọn từ bảng) */
  mucId?: string
  /** Hình thức khen thưởng / danh hiệu, VD "Bằng khen của Chủ tịch UBND thành phố" */
  hinhThuc: string
  soQd?: string
  ngayQd?: string
  /** Cơ quan, người ký quyết định */
  coQuan?: string
  /** Nội dung thành tích (năm học, lĩnh vực…) */
  noiDung?: string
}

/** Hồ sơ chung của đợt xét nâng lương trước thời hạn */
export interface HoSoTruocHan {
  /** Tờ trình của trường */
  toTrinh?: MinhChung[]
  /** Biên bản họp Hội đồng xét nâng lương trước thời hạn của trường */
  bienBan?: MinhChung[]
  /** Quy chế nâng bậc lương trước thời hạn của trường */
  quyChe?: MinhChung[]
  /** Số người trong danh sách trả lương (xếp lương theo hệ số) lúc lập hồ sơ - căn cứ tỷ lệ 10% */
  soNguoiTraLuong?: number
}

/** Một mức trong bảng gợi ý "hình thức khen → số tháng nâng trước" (Phòng VHXH khai, trường sửa theo Quy chế) */
export interface MucNangTruocHan {
  id: string
  ten: string
  soThang: number
  thuTu: number
  active: boolean
}

/**
 * Gợi ý mặc định (Phòng VHXH sửa được): Thông tư 08/2013 không quy định số tháng theo hình thức khen - điểm e
 * khoản 1 Điều 3 giao Quy chế của từng đơn vị (tối đa 12 tháng). Đây chỉ là mức gợi ý phổ biến.
 */
export const MUC_NANG_TRUOC_HAN_MAC_DINH: MucNangTruocHan[] = [
  { id: 'mth_1', ten: 'Huân chương các loại; danh hiệu Chiến sĩ thi đua toàn quốc; Nhà giáo Nhân dân, Nhà giáo Ưu tú', soThang: 12, thuTu: 1, active: true },
  { id: 'mth_2', ten: 'Bằng khen của Thủ tướng Chính phủ; Chiến sĩ thi đua cấp tỉnh, thành phố', soThang: 9, thuTu: 2, active: true },
  { id: 'mth_3', ten: 'Bằng khen của Bộ trưởng, Chủ tịch UBND thành phố; Chiến sĩ thi đua cơ sở', soThang: 6, thuTu: 3, active: true },
  { id: 'mth_4', ten: 'Giấy khen của Chủ tịch UBND phường, Thủ trưởng đơn vị', soThang: 3, thuTu: 4, active: true },
]

/** Dòng phụ cấp thâm niên vượt khung (người ở bậc cuối) trong phiếu nâng bậc thường xuyên */
export const laDongVuotKhung = (r: Pick<ChiTietDeXuat, 'tnvkMoi'>) => r.tnvkMoi != null

export function laDeXuatPhuCapThamNien(loai: LoaiDeXuat): boolean {
  return loai === 'PHU_CAP_THAM_NIEN' || loai === 'PCTN_LAN_DAU'
}

export interface DeXuatLuong {
  id: string
  ma: string
  tieuDe: string
  donViId: string
  loai: LoaiDeXuat
  chiTiet: ChiTietDeXuat[]
  trangThai: TrangThaiDeXuat
  buocHienTai: 1 | 2 | 3 | 4

  nguoiDeXuatId: string
  ngayDeXuat: string
  ghiChuDeXuat?: string
  /** Minh chứng chung của phiếu (quyết định, biên bản xét, danh sách…) */
  minhChung?: MinhChung[]
  /** Nâng lương trước thời hạn: năm xét và hồ sơ chung (tờ trình, biên bản Hội đồng, quy chế) */
  namXet?: number
  hoSoTruocHan?: HoSoTruocHan

  nguoiDuyetHTId?: string
  ngayDuyetHT?: string
  ketQuaDuyetHT?: 'DONG_Y' | 'TU_CHOI' | 'YEU_CAU_BO_SUNG'
  ghiChuDuyetHT?: string

  nguoiXetDuyetId?: string
  ngayXetDuyet?: string
  ketQuaXetDuyet?: 'DONG_Y' | 'TU_CHOI' | 'YEU_CAU_BO_SUNG'
  ghiChuXetDuyet?: string

  nguoiPheDuyetId?: string
  ngayPheDuyet?: string
  ketQuaPheDuyet?: 'PHE_DUYET' | 'TU_CHOI'
  ghiChuPheDuyet?: string

  createdAt: string
  updatedAt: string
}

export const TRANG_THAI_LABELS: Record<TrangThaiDeXuat, string> = {
  NHAP: 'Bản nháp',
  CHO_HIEU_TRUONG_DUYET: 'Chờ Hiệu trưởng duyệt',
  CHO_XET_DUYET: 'Chờ VH-XH thẩm định',
  CHO_PHE_DUYET: 'Chờ lãnh đạo phê duyệt',
  DA_PHE_DUYET: 'Đã phê duyệt',
  TU_CHOI: 'Bị từ chối',
  YEU_CAU_BO_SUNG: 'Yêu cầu bổ sung',
}

export const TRANG_THAI_COLORS: Record<TrangThaiDeXuat, string> = {
  NHAP: 'default',
  CHO_HIEU_TRUONG_DUYET: 'cyan',
  CHO_XET_DUYET: 'processing',
  CHO_PHE_DUYET: 'warning',
  DA_PHE_DUYET: 'success',
  TU_CHOI: 'error',
  YEU_CAU_BO_SUNG: 'orange',
}

/** Loại phiếu bắt buộc có minh chứng khi trình */
export const LOAI_CAN_MINH_CHUNG: LoaiDeXuat[] = ['NANG_TRUOC_HAN', 'DIEU_CHINH', 'CHUYEN_NGACH', 'PCTN_LAN_DAU']

export const TEN_CHUC_NANG_DE_XUAT = 'Đề xuất điều chỉnh hệ số lương - phụ cấp'
export const TEN_CHUC_NANG_NANG_LUONG = 'Lập hồ sơ nâng lương - phụ cấp thâm niên'
/** Bốn loại hồ sơ theo niên hạn / thành tích - gom ở trang Lập hồ sơ nâng lương - phụ cấp thâm niên */
export const LOAI_HO_SO_NANG_LUONG: LoaiDeXuat[] = ['NANG_BAC', 'PHU_CAP_THAM_NIEN', 'PCTN_LAN_DAU', 'NANG_TRUOC_HAN']
/** Hai loại còn lại ở trang Đề xuất điều chỉnh hệ số lương - phụ cấp */
export const LOAI_DE_XUAT_DIEU_CHINH: LoaiDeXuat[] = ['CHUYEN_NGACH', 'DIEU_CHINH']
export const laHoSoNangLuong = (loai: LoaiDeXuat) => LOAI_HO_SO_NANG_LUONG.includes(loai)
/** Trang danh sách chứa phiếu loại này (nút Quay lại) */
export const trangDanhSachCuaLoai = (loai: LoaiDeXuat) => (laHoSoNangLuong(loai) ? `/ho-so-nang-luong?loai=${loai}` : '/de-xuat')

export const LOAI_DE_XUAT_LABELS: Record<LoaiDeXuat, string> = {
  NANG_BAC: 'Nâng bậc lương thường xuyên',
  PHU_CAP_THAM_NIEN: 'Nâng phụ cấp thâm niên',
  PCTN_LAN_DAU: 'Xếp phụ cấp thâm niên nhà giáo lần đầu',
  NANG_TRUOC_HAN: 'Nâng bậc lương trước thời hạn',
  CHUYEN_NGACH: 'Chuyển ngạch/chức danh',
  DIEU_CHINH: 'Điều chỉnh hệ số lương - phụ cấp',
}

/**
 * Nghiệp vụ từng loại phiếu - hiện ở trang danh sách và ngay dưới ô chọn loại trong form.
 * Hai loại theo niên hạn chọn người theo thời gian, không cần minh chứng;
 * ba loại còn lại phải nêu rõ cũ → mới (ngạch, bậc, hệ số, mốc hưởng) và đính kèm minh chứng.
 */
export const NGHIEP_VU_LOAI: Record<LoaiDeXuat, { chonNguoi: string; dieuChinh: string; minhChung?: string; tomTat: string; minhChungNgan?: string }> = {
  NANG_BAC: {
    chonNguoi: 'Theo niên hạn: chọn năm, đợt 6 tháng; bảng gợi ý liệt kê người đến hạn nâng bậc trong đợt.',
    dieuChinh: 'Giữ ngạch; lên 1 bậc theo bảng lương, hệ số tự điền; mốc hưởng mới = ngày đến hạn. Người ở bậc cuối giữ bậc, hưởng phụ cấp thâm niên vượt khung: 5% lần đầu (sau 36 tháng, loại B/C 24 tháng), mỗi năm sau +1%.',
    tomTat: 'Chọn theo đợt 6 tháng; +1 bậc, mốc = ngày đến hạn',
  },
  PHU_CAP_THAM_NIEN: {
    chonNguoi: 'Theo niên hạn: bảng gợi ý liệt kê CBQL, giáo viên đến ngày kỷ niệm mốc hưởng PCTN trong đợt.',
    dieuChinh: 'PCTN mới = mức cũ + 1% (chưa hưởng thì 5%); mốc hưởng mới = ngày kỷ niệm. Nhân viên không hưởng PCTN.',
    tomTat: 'Chọn theo ngày kỷ niệm mốc PCTN; +1%/năm',
  },
  PCTN_LAN_DAU: {
    chonNguoi: 'CBQL, giáo viên chưa hưởng phụ cấp thâm niên; bảng gợi ý liệt kê người dự kiến đủ 5 năm (60 tháng) giảng dạy có đóng BHXH bắt buộc đến hết kỳ.',
    dieuChinh: 'Khai tháng bắt đầu giảng dạy có đóng BHXH và thời gian không tính (tập sự, nghỉ không lương…); hệ thống tính ngày đủ 5 năm và gợi ý quá trình hưởng 5%, mỗi năm sau +1% (sửa được từng dòng). Phê duyệt xong ghi phụ cấp thâm niên và mốc xét nâng lần sau vào hồ sơ.',
    minhChung: 'Bản sao bằng cấp chuyên môn; quyết định tuyển dụng / hợp đồng lao động; quyết định lương đang hưởng; quá trình đóng BHXH và minh chứng (đính kèm riêng từng người).',
    tomTat: 'Khai BHXH, thời gian không tính; tính 5% khi đủ 60 tháng',
    minhChungNgan: 'Bằng, QĐ tuyển dụng, QĐ lương, quá trình BHXH',
  },
  NANG_TRUOC_HAN: {
    chonNguoi: 'Chọn từng người có thành tích được xét nâng trước hạn.',
    dieuChinh: 'Giữ ngạch; lên 1 bậc; mốc hưởng mới sớm hơn ngày đến hạn, tối đa 12 tháng.',
    minhChung: 'Quyết định công nhận thành tích / khen thưởng, biên bản xét nâng lương trước hạn.',
    tomTat: '+1 bậc; mốc sớm hơn hạn tối đa 12 tháng',
    minhChungNgan: 'QĐ khen thưởng, biên bản xét',
  },
  CHUYEN_NGACH: {
    chonNguoi: 'Chọn người được bổ nhiệm ngạch / chức danh nghề nghiệp mới.',
    dieuChinh: 'Chọn ngạch mới; hệ thống xếp vào bậc có hệ số bằng hoặc cao hơn gần nhất (chọn lại được); mốc hưởng mới = ngày bổ nhiệm theo quyết định.',
    minhChung: 'Quyết định bổ nhiệm, chuyển ngạch / thay đổi chức danh nghề nghiệp.',
    tomTat: 'Chọn ngạch mới; xếp bậc có hệ số bằng/cao hơn gần nhất',
    minhChungNgan: 'QĐ bổ nhiệm ngạch',
  },
  DIEU_CHINH: {
    chonNguoi: 'Chọn người cần điều chỉnh do sai sót xếp lương hoặc theo văn bản của cấp có thẩm quyền.',
    dieuChinh: 'Sửa được ngạch, bậc, hệ số, mốc hưởng cho đúng văn bản (không đổi thì để nguyên); hệ số lệch bảng lương sẽ có cảnh báo để người duyệt lưu ý. Cột Phụ cấp điều chỉnh: thêm phụ cấp cần đổi mức (chức vụ, ưu đãi, trách nhiệm, thâm niên…), ghi mức mới và ngày hưởng; mức 0 là thôi hưởng.',
    minhChung: 'Quyết định / văn bản làm căn cứ điều chỉnh.',
    tomTat: 'Sửa ngạch, bậc, hệ số, mốc hưởng; điều chỉnh mức các loại phụ cấp theo văn bản',
    minhChungNgan: 'Văn bản căn cứ',
  },
}
