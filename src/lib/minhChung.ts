import { supabase } from '@/lib/supabase'

// Minh chứng đính kèm phiếu đề xuất — lưu ở Supabase Storage (bucket riêng tư "minh-chung").
// - Mỗi file tối đa 3 MB; chỉ nhận PDF, JPG, PNG.
// - Ảnh được thu nhỏ, nén JPEG ngay trên trình duyệt trước khi tải lên (ảnh điện thoại 3–6 MB → vài trăm KB).
// - Tên file trên máy chủ là mã băm nội dung → cùng một quyết định đính kèm nhiều nơi chỉ lưu một bản.
// - File không bao giờ bị xoá/ghi đè từ phần mềm; gỡ khỏi phiếu chỉ bỏ liên kết.

export const BUCKET_MINH_CHUNG = 'minh-chung'
export const MINH_CHUNG_TOI_DA = 3 * 1024 * 1024
const LOAI_CHO_PHEP: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}
const CANH_DAI_ANH = 1600

export interface MinhChung {
  /** Đường dẫn trong bucket (theo mã băm nội dung) */
  path: string
  /** Tên file gốc để hiển thị */
  ten: string
  kichThuoc: number
  loai: string
  taiLenLuc: string
  taiLenBoi: string
}

export const dinhDangDungLuong = (byte: number) =>
  byte >= 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(byte / 1024))} KB`

async function nenAnh(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Không đọc được ảnh'))
      i.src = url
    })
    const tiLe = Math.min(1, CANH_DAI_ANH / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * tiLe)
    canvas.height = Math.round(img.height * tiLe)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff' // PNG trong suốt → nền trắng khi đổi sang JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (!blob) throw new Error('Không nén được ảnh')
    return blob.size < file.size ? blob : file
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function maBam(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Kiểm tra, nén (nếu là ảnh) và tải file lên. Ném lỗi kèm thông báo tiếng Việt khi không đạt. */
export async function taiLenMinhChung(file: File, taiLenBoi: string): Promise<MinhChung> {
  if (!supabase) throw new Error('Chưa kết nối máy chủ lưu trữ — không tải được minh chứng')
  if (!LOAI_CHO_PHEP[file.type]) throw new Error(`"${file.name}": chỉ nhận file PDF, JPG hoặc PNG`)

  const laAnh = file.type.startsWith('image/')
  const noiDung: Blob = laAnh ? await nenAnh(file) : file
  if (noiDung.size > MINH_CHUNG_TOI_DA) {
    throw new Error(laAnh
      ? `"${file.name}": ảnh sau khi nén vẫn ${dinhDangDungLuong(noiDung.size)}, vượt 3 MB`
      : `"${file.name}" nặng ${dinhDangDungLuong(noiDung.size)}, vượt 3 MB — scan lại đen trắng hoặc xám, 150–200 dpi`)
  }

  const loai = laAnh && noiDung !== file ? 'image/jpeg' : file.type
  const path = `${await maBam(noiDung)}.${LOAI_CHO_PHEP[loai]}`
  const { error } = await supabase.storage.from(BUCKET_MINH_CHUNG).upload(path, noiDung, { contentType: loai, upsert: false })
  // Đã có đúng file này trên máy chủ (cùng nội dung) → dùng lại, không lưu trùng
  if (error && !/exists|duplicate/i.test(error.message)) {
    throw new Error(/bucket not found/i.test(error.message)
      ? 'Máy chủ chưa có kho lưu minh chứng (bucket "minh-chung") — liên hệ quản trị'
      : `Tải lên "${file.name}" không thành công: ${error.message}`)
  }
  return { path, ten: file.name, kichThuoc: noiDung.size, loai, taiLenLuc: new Date().toISOString(), taiLenBoi }
}

/** Link xem/tải tạm thời (1 giờ) — bucket riêng tư nên không có link công khai */
export async function linkMinhChung(mc: MinhChung, taiVe = false): Promise<string> {
  if (!supabase) throw new Error('Chưa kết nối máy chủ lưu trữ')
  const { data, error } = await supabase.storage
    .from(BUCKET_MINH_CHUNG)
    .createSignedUrl(mc.path, 3600, taiVe ? { download: mc.ten } : undefined)
  if (error || !data) throw new Error(`Không mở được "${mc.ten}": ${error?.message ?? 'lỗi không rõ'}`)
  return data.signedUrl
}
