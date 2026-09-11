import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Các phông chuẩn có sẵn của jsPDF (Helvetica, Times) là phông Type1 chỉ hỗ trợ
// bảng mã Latin-1, không có ký tự tiếng Việt như ế, ộ, ữ, ạ. Xuất ra thì dấu bị
// mất hoặc thành ký tự lạ.
//
// Nhúng Roboto (Apache 2.0, có đủ chữ Việt) mới hiển thị đúng. Phông nặng ~500KB
// nên chỉ tải khi người dùng thực sự bấm xuất, không kèm vào gói chính.

const TEN_PHONG = 'Roboto'
const PHONG = {
  normal: 'Roboto-Regular.ttf',
  bold: 'Roboto-Bold.ttf',
} as const

let daNap: Record<string, string> | null = null
let dangNap: Promise<Record<string, string>> | null = null

async function taiPhongBase64(): Promise<Record<string, string>> {
  if (daNap) return daNap
  if (dangNap) return dangNap

  dangNap = (async () => {
    const goc = `${import.meta.env.BASE_URL}fonts/`
    const ra: Record<string, string> = {}

    for (const [kieu, tep] of Object.entries(PHONG)) {
      const res = await fetch(goc + tep)
      if (!res.ok) throw new Error(`Không tải được phông ${tep} (HTTP ${res.status})`)
      const buf = await res.arrayBuffer()

      // Chuyển sang base64 theo từng đoạn — chuỗi 500KB đưa thẳng vào
      // String.fromCharCode sẽ tràn ngăn xếp.
      let nhiPhan = ''
      const bytes = new Uint8Array(buf)
      const DOAN = 0x8000
      for (let i = 0; i < bytes.length; i += DOAN) {
        nhiPhan += String.fromCharCode(...bytes.subarray(i, i + DOAN))
      }
      ra[kieu] = btoa(nhiPhan)
    }

    daNap = ra
    return ra
  })()

  try {
    return await dangNap
  } finally {
    dangNap = null
  }
}

async function chuanBiPhong(doc: jsPDF): Promise<boolean> {
  try {
    const b64 = await taiPhongBase64()
    for (const [kieu, tep] of Object.entries(PHONG)) {
      doc.addFileToVFS(tep, b64[kieu])
      doc.addFont(tep, TEN_PHONG, kieu)
    }
    doc.setFont(TEN_PHONG, 'normal')
    return true
  } catch (e) {
    // Không tải được phông thì vẫn xuất, chỉ là mất dấu — báo cho người dùng
    // biết thay vì im lặng đưa ra tệp hỏng.
    console.error('[PDF] Không nhúng được phông tiếng Việt:', e)
    return false
  }
}

export async function exportToPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  ghiChu?: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const coPhong = await chuanBiPhong(doc)
  const font = coPhong ? TEN_PHONG : 'helvetica'

  doc.setFont(font, 'bold')
  doc.setFontSize(14)
  doc.text(title, 14, 16)

  doc.setFont(font, 'normal')
  doc.setFontSize(9)
  doc.text(`Ngày xuất: ${new Date().toLocaleString('vi-VN')}`, 14, 22)
  if (ghiChu) doc.text(ghiChu, 14, 27)

  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((o) => (o === null || o === undefined ? '' : String(o)))),
    startY: ghiChu ? 32 : 28,
    styles: { font, fontSize: 8, cellPadding: 1.6, overflow: 'linebreak', valign: 'middle' },
    headStyles: { font, fontStyle: 'bold', fillColor: [24, 144, 255], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 10, right: 10 },
    tableWidth: 'auto',
    didDrawPage: (d) => {
      // Số trang ở chân mỗi trang, để bản in nhiều trang không bị lẫn
      const trang = doc.getNumberOfPages()
      doc.setFont(font, 'normal')
      doc.setFontSize(8)
      doc.text(
        `Trang ${d.pageNumber}/${trang}`,
        doc.internal.pageSize.getWidth() - 10,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'right' },
      )
    },
  })

  doc.save(`${filename}.pdf`)

  if (!coPhong) {
    throw new Error('Đã xuất PDF nhưng không tải được phông tiếng Việt nên dấu có thể bị mất.')
  }
}
