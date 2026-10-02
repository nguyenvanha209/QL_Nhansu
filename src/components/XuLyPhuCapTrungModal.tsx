import { useEffect, useState } from 'react'
import { Modal, Radio, Input, Typography, Alert, Space, App } from 'antd'
import dayjs from 'dayjs'
import type { PhuCapVienChuc } from '@/types/luong'
import { useLuongStore } from '@/store/luongStore'
import { useAuth } from '@/hooks/useAuth'
import { ngayKetThucKhiThay } from '@/utils/phuCapDangHuong'
import { formatDate } from '@/utils/helpers'

const { Text } = Typography

type CachXuLy = 'LICH_SU' | 'XOA'

interface Props {
  /** Bản quản trị chọn giữ lại; null = đóng hộp thoại */
  giu: PhuCapVienChuc | null
  /** Các bản khác cùng loại đang còn hiệu lực */
  banKhac: PhuCapVienChuc[]
  donViId?: string
  tenVienChuc: string
  /** Mô tả một bản ghi: loại, mức, từ ngày, nguồn */
  moTa: (p: PhuCapVienChuc) => string
  onClose: () => void
}

/**
 * Quản trị xử lý phụ cấp ghi trùng: giữ một bản, các bản còn lại hoặc chuyển vào lịch sử
 * (giai đoạn trước, có thật) hoặc xoá hẳn (nhập sai). Mặc định: bản cũ hơn → lịch sử, bản mới hơn → xoá.
 */
export default function XuLyPhuCapTrungModal({ giu, banKhac, donViId, tenVienChuc, moTa, onClose }: Props) {
  const { currentUser } = useAuth()
  const { message } = App.useApp()
  const [cach, setCach] = useState<Record<string, CachXuLy>>({})
  const [lyDo, setLyDo] = useState('')

  useEffect(() => {
    if (!giu) return
    setCach(Object.fromEntries(banKhac.map((p) => [p.id, (p.ngayHieuLuc ?? '') < (giu.ngayHieuLuc ?? '') ? 'LICH_SU' : 'XOA'])))
    setLyDo('')
  }, [giu?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const xacNhan = () => {
    if (!giu) return
    if (!lyDo.trim()) { message.warning('Nhập lý do xử lý để lưu vào lịch sử'); return }
    const st = useLuongStore.getState()
    const homNay = dayjs().format('YYYY-MM-DD')
    const daXoa: string[] = []
    const daDong: string[] = []
    for (const p of banKhac) {
      if (cach[p.id] === 'XOA') {
        st.xoaPhuCap(p.id)
        daXoa.push(moTa(p))
      } else {
        st.updatePhuCap(p.id, {
          isActive: false,
          ngayHetHan: ngayKetThucKhiThay(p.ngayHieuLuc, giu.ngayHieuLuc),
          ghiChu: [p.ghiChu, `Đóng do trùng - quản trị giữ bản từ ${formatDate(giu.ngayHieuLuc)}`].filter(Boolean).join('; '),
        })
        daDong.push(moTa(p))
      }
    }
    const giaTriCu = [
      ...daXoa.map((s) => `Xoá: ${s}`),
      ...daDong.map((s) => `Chuyển lịch sử: ${s}`),
    ].join(' | ')
    st.addLichSuBienDong({
      vienChucId: giu.vienChucId,
      loai: 'PHU_CAP',
      truongThayDoi: 'Xử lý phụ cấp ghi trùng',
      giaTriCu,
      giaTriMoi: `Giữ: ${moTa(giu)}. Lý do: ${lyDo.trim()}`,
      ngayThayDoi: homNay,
      nguoiThayDoiId: currentUser?.id ?? 'system',
    })
    st.addNhatKy({
      userId: currentUser?.id ?? 'system',
      userFullName: currentUser?.fullName ?? 'Hệ thống',
      action: daXoa.length ? 'DELETE' : 'UPDATE',
      entity: 'PhuCapVienChuc',
      entityId: giu.vienChucId,
      moTa: `Xử lý phụ cấp trùng của ${tenVienChuc}: giữ ${moTa(giu)}; ${giaTriCu}. Lý do: ${lyDo.trim()}`,
      thoiGian: new Date().toISOString(),
      donViId,
    })
    message.success('Đã xử lý bản trùng')
    onClose()
  }

  return (
    <Modal
      open={!!giu}
      title="Xử lý phụ cấp ghi trùng"
      okText="Xác nhận"
      cancelText="Huỷ"
      okButtonProps={{ danger: Object.values(cach).includes('XOA') }}
      onOk={xacNhan}
      onCancel={onClose}
      width={640}
      destroyOnHidden
    >
      {giu && (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">Giữ lại (tính lương):</Text>
            <div><Text strong>{moTa(giu)}</Text></div>
          </div>
          <div>
            <Text type="secondary">Các bản còn lại:</Text>
            {banKhac.map((p) => (
              <div key={p.id} style={{ padding: '8px 10px', border: '1px solid #f0f0f0', borderRadius: 6, marginTop: 6 }}>
                <div style={{ marginBottom: 4 }}>{moTa(p)}</div>
                <Radio.Group
                  value={cach[p.id]}
                  onChange={(e) => setCach((c) => ({ ...c, [p.id]: e.target.value }))}
                  options={[
                    { value: 'LICH_SU', label: 'Chuyển vào lịch sử (giai đoạn trước có thật)' },
                    { value: 'XOA', label: 'Xoá hẳn (nhập sai)' },
                  ]}
                />
              </div>
            ))}
          </div>
          <Input.TextArea
            rows={2}
            placeholder="Lý do (bắt buộc), ví dụ: kế toán nhập trùng, đối chiếu QĐ số ... thì mức đúng là ..."
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
          />
          {Object.values(cach).includes('XOA') && (
            <Alert type="warning" showIcon title="Bản bị xoá hẳn không khôi phục được trên phần mềm. Nội dung của nó vẫn được ghi trong lịch sử biến động và nhật ký." />
          )}
        </Space>
      )}
    </Modal>
  )
}
