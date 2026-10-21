// Bộ nhớ trên máy (thay cho gọi thẳng localStorage)
//
// localStorage chỉ có khoảng 5 MB mỗi trang trên trình duyệt điện thoại (iPhone: mọi trình duyệt dùng lõi
// WebKit; nhiều máy Android cũng vậy). Dữ liệu phần mềm đã vượt mức này nên trên điện thoại lệnh ghi báo
// QuotaExceededError → đăng nhập xong vẫn báo "Không tải được dữ liệu từ máy chủ".
//
// Lớp này đọc/ghi như localStorage nhưng khi hết chỗ:
// - dời các kho dữ liệu lớn (ql-*) khỏi localStorage sang bộ nhớ của phiên đang mở để giải phóng chỗ,
//   nhờ vậy các khoá nhỏ (phiên đăng nhập, mốc thao tác...) vẫn ghi được;
// - khoá nào vẫn không vừa thì giữ trong bộ nhớ phiên.
// Phần mềm vẫn chạy đầy đủ, mọi thay đổi vẫn ghi lên máy chủ; chỉ khác là lần mở sau phải tải lại dữ liệu
// từ máy chủ (vốn vẫn làm mỗi lần mở trang).

const boNhoPhien = new Map<string, string>()
let daHetCho = false

const laHetCho = (e: unknown) =>
  e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)

/** Kho dữ liệu lớn được phép dời sang bộ nhớ phiên khi hết chỗ (không dời phiên đăng nhập) */
const laKhoDuLieu = (k: string) => k.startsWith('ql-') && k !== 'ql-auth'

/**
 * Kho chỉ giữ trong bộ nhớ phiên, không lưu localStorage: nhật ký thao tác (tối đa 5.000 dòng, vài MB) chỉ để
 * xem ở trang Nhật ký, mỗi lần mở trang vẫn tải từ máy chủ. Bỏ khỏi localStorage để dành chỗ cho hồ sơ, lương.
 */
const CHI_BO_NHO = new Set(['ql-nhat-ky'])

function goi<T>(fn: () => T, macDinh: T): T {
  try {
    return fn()
  } catch {
    return macDinh
  }
}

/** Dời các kho dữ liệu lớn nhất khỏi localStorage sang bộ nhớ phiên */
function giaiPhongCho(): boolean {
  const ds = goi(() => Object.keys(localStorage), [] as string[])
    .filter(laKhoDuLieu)
    .map((k) => ({ k, v: goi(() => localStorage.getItem(k), null) }))
    .filter((x): x is { k: string; v: string } => x.v != null)
    .sort((a, b) => b.v.length - a.v.length)
  if (!ds.length) return false
  for (const { k, v } of ds) {
    boNhoPhien.set(k, v)
    goi(() => localStorage.removeItem(k), undefined)
  }
  return true
}

export const khoCucBo = {
  getItem(k: string): string | null {
    if (boNhoPhien.has(k)) return boNhoPhien.get(k)!
    return goi(() => localStorage.getItem(k), null)
  },

  setItem(k: string, v: string): void {
    if (CHI_BO_NHO.has(k)) {
      boNhoPhien.set(k, v)
      return
    }
    // Kho đã dời sang bộ nhớ phiên thì giữ luôn ở đó, khỏi thử ghi lại (tránh lỗi lặp lại mỗi lần lưu)
    if (boNhoPhien.has(k) && laKhoDuLieu(k)) {
      boNhoPhien.set(k, v)
      return
    }
    try {
      localStorage.setItem(k, v)
      boNhoPhien.delete(k)
      return
    } catch (e) {
      if (!laHetCho(e)) {
        // Trình duyệt chặn localStorage (chế độ riêng tư...) → giữ trong bộ nhớ phiên
        boNhoPhien.set(k, v)
        return
      }
    }
    if (!daHetCho) {
      daHetCho = true
      console.warn('[Bộ nhớ máy] localStorage hết chỗ - dữ liệu lớn giữ trong bộ nhớ phiên, mỗi lần mở trang tải lại từ máy chủ')
    }
    if (laKhoDuLieu(k)) {
      // Bản cũ của chính khoá này không còn đúng, bỏ đi để lần mở sau không đọc nhầm
      goi(() => localStorage.removeItem(k), undefined)
      boNhoPhien.set(k, v)
      giaiPhongCho()
      return
    }
    // Khoá nhỏ (phiên đăng nhập...): giải phóng chỗ rồi ghi lại
    giaiPhongCho()
    try {
      localStorage.setItem(k, v)
      boNhoPhien.delete(k)
    } catch {
      boNhoPhien.set(k, v)
    }
  },

  removeItem(k: string): void {
    boNhoPhien.delete(k)
    goi(() => localStorage.removeItem(k), undefined)
  },
}

/** Có đang phải giữ dữ liệu trong bộ nhớ phiên vì máy hết chỗ không */
export const dangThieuBoNho = () => daHetCho

// Máy đã lưu nhật ký vào localStorage từ trước: dọn ngay khi mở trang để giải phóng chỗ
for (const k of CHI_BO_NHO) goi(() => localStorage.removeItem(k), undefined)
