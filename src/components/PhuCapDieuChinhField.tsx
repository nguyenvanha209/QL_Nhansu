import { Button, DatePicker, InputNumber, Select, Space, Tooltip, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useLuongStore } from '@/store/luongStore'
import type { DieuChinhPhuCap } from '@/types/deXuat'
import { chonBanDangHuong, hienMucPhuCap, hoPhuCap } from '@/utils/phuCapDangHuong'
import { sapXepLoaiPhuCap } from '@/utils/phuCapThuTu'

const { Text } = Typography

/**
 * Phiếu Điều chỉnh: khai các phụ cấp cần đổi mức của một người. Chọn loại → lấy mức đang hưởng (cùng "họ" phụ cấp:
 * các mức ưu đãi nghề là một họ) làm mức cũ; ghi mức mới và ngày hưởng; mức 0 = thôi hưởng.
 */
export default function PhuCapDieuChinhField({ vienChucId, value, ngayMacDinh, onChange }: {
  vienChucId: string
  value?: DieuChinhPhuCap[]
  ngayMacDinh?: string
  onChange: (v: DieuChinhPhuCap[] | undefined) => void
}) {
  const loaiPhuCaps = useDanhMucStore((s) => s.loaiPhuCaps)
  const phuCapVienChucs = useLuongStore((s) => s.phuCapVienChucs)
  const ds = value ?? []
  const loaiTheoId = new Map(loaiPhuCaps.map((l) => [l.id, l]))
  const dangHuong = (loaiId: string) => {
    const ho = hoPhuCap(loaiId, loaiPhuCaps)
    return chonBanDangHuong(phuCapVienChucs.filter((p) => p.vienChucId === vienChucId && p.isActive && hoPhuCap(p.loaiPhuCapId, loaiPhuCaps) === ho))
  }
  const daChon = new Set(ds.map((d) => hoPhuCap(d.loaiPhuCapId, loaiPhuCaps)))
  const doi = (i: number, patch: Partial<DieuChinhPhuCap>) => onChange(ds.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const them = (loaiId: string) => {
    const cu = dangHuong(loaiId)
    const l = loaiTheoId.get(loaiId)
    onChange([...ds, {
      loaiPhuCapId: loaiId, loaiPhuCapCuId: cu?.loaiPhuCapId, giaTriCu: cu?.giaTri,
      giaTriMoi: cu && cu.loaiPhuCapId === loaiId ? cu.giaTri : l?.giaTri || 0,
      ngayHieuLuc: ngayMacDinh || dayjs().format('YYYY-MM-DD'),
    }])
  }
  const tuyChon = sapXepLoaiPhuCap(loaiPhuCaps.filter((l) => l.active))
    .filter((l) => !daChon.has(hoPhuCap(l.id, loaiPhuCaps)))
    .map((l) => {
      const cu = dangHuong(l.id)
      return { value: l.id, label: `${l.ten}${cu ? ` (đang hưởng ${hienMucPhuCap(loaiTheoId.get(cu.loaiPhuCapId), cu.giaTri)})` : ''}` }
    })

  return (
    <Space orientation="vertical" size={6} style={{ width: '100%' }}>
      {ds.map((d, i) => {
        const l = loaiTheoId.get(d.loaiPhuCapId)
        const cungHo = loaiPhuCaps.filter((x) => x.active && hoPhuCap(x.id, loaiPhuCaps) === hoPhuCap(d.loaiPhuCapId, loaiPhuCaps))
        const donVi = l?.loaiCongThuc === 'TIEN_MAT' ? 'đ' : l?.loaiCongThuc === 'HE_SO' ? undefined : '%'
        return (
          <div key={hoPhuCap(d.loaiPhuCapId, loaiPhuCaps)} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: 6 }}>
            <Space size={4} style={{ width: '100%', justifyContent: 'space-between' }}>
              {cungHo.length > 1
                ? <Select size="small" style={{ width: 210 }} value={d.loaiPhuCapId} popupMatchSelectWidth={320}
                    options={cungHo.map((x) => ({ value: x.id, label: x.ten }))}
                    onChange={(v: string) => doi(i, { loaiPhuCapId: v, giaTriMoi: loaiTheoId.get(v)?.giaTri || d.giaTriMoi })} />
                : <Text strong style={{ fontSize: 13 }}>{l?.ten ?? d.loaiPhuCapId}</Text>}
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange(ds.length > 1 ? ds.filter((_, j) => j !== i) : undefined)} />
            </Space>
            <Space size={4} wrap style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {d.giaTriCu != null ? hienMucPhuCap(loaiTheoId.get(d.loaiPhuCapCuId ?? d.loaiPhuCapId), d.giaTriCu) : 'chưa hưởng'} →
              </Text>
              <Tooltip title="Mức mới; ghi 0 nếu thôi hưởng">
                <InputNumber size="small" style={{ width: 96 }} min={0} step={l?.loaiCongThuc === 'HE_SO' ? 0.01 : 1} value={d.giaTriMoi}
                  suffix={donVi} decimalSeparator="," onChange={(v) => doi(i, { giaTriMoi: v ?? 0 })} />
              </Tooltip>
              <DatePicker size="small" format="DD/MM/YYYY" style={{ width: 118 }} value={d.ngayHieuLuc ? dayjs(d.ngayHieuLuc) : null}
                onChange={(v) => doi(i, { ngayHieuLuc: v ? v.format('YYYY-MM-DD') : '' })} placeholder="Hưởng từ" />
            </Space>
          </div>
        )
      })}
      <Select size="small" style={{ width: '100%' }} value={null} showSearch optionFilterProp="label" popupMatchSelectWidth={360}
        placeholder={<span><PlusOutlined /> Thêm phụ cấp cần điều chỉnh</span>} options={tuyChon} onChange={(v: string) => them(v)} />
    </Space>
  )
}
