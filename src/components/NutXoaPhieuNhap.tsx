import { App, Button, Popconfirm } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'
import { useDeXuatStore } from '@/store/deXuatStore'
import type { DeXuatLuong } from '@/types/deXuat'

/** Người được xoá phiếu nháp: người có quyền lập phiếu của trường đó (hoặc quản trị); phiếu đã trình thì không */
export function duocXoaPhieu(dx: DeXuatLuong, ctx: { hasPermission: (r: any, a: any) => boolean; laQuanTri: boolean; scopeDonViId?: string | null }) {
  return dx.trangThai === 'NHAP' && ctx.hasPermission('deXuat', 'write') && (ctx.laQuanTri || dx.donViId === ctx.scopeDonViId)
}

/** Nút Xoá phiếu Bản nháp (chưa trình Hiệu trưởng), có hỏi xác nhận */
export default function NutXoaPhieuNhap({ dx, nho, sauKhiXoa }: { dx: DeXuatLuong; nho?: boolean; sauKhiXoa?: () => void }) {
  const { message } = App.useApp()
  const { currentUser, hasPermission, laQuanTri, scopeDonViId } = useAuth()
  if (!currentUser || !duocXoaPhieu(dx, { hasPermission, laQuanTri, scopeDonViId })) return null
  const xoa = () => {
    if (useDeXuatStore.getState().xoaDeXuatNhap(dx.id, currentUser.id, currentUser.fullName)) {
      message.success(`Đã xoá phiếu nháp ${dx.ma}`)
      sauKhiXoa?.()
    } else message.error('Phiếu đã trình hoặc không còn - không xoá được')
  }
  return (
    <Popconfirm
      title={`Xoá phiếu nháp ${dx.ma}?`}
      description={<>{dx.tieuDe}<br />{dx.chiTiet.length} người - xoá xong không khôi phục được.</>}
      okText="Xoá phiếu" okButtonProps={{ danger: true }} cancelText="Không"
      onConfirm={xoa}
    >
      <Button size={nho ? 'small' : undefined} danger icon={<DeleteOutlined />}>{nho ? null : 'Xoá phiếu'}</Button>
    </Popconfirm>
  )
}
