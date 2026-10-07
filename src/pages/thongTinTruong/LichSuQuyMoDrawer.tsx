import { Drawer, Alert, Empty, Table, Space, Tag, Typography, Button } from 'antd'
import type { QuyMoLichSu, NoiDungQuyMo } from '@/types/quyMo'
import { soSanhNoiDung, tomTatNoiDung } from '@/utils/quyMoLichSu'
import { formatDatetime } from '@/utils/helpers'
import type { CapHoc } from '@/utils/dinhMuc'

const { Text } = Typography

/** Lịch sử các lần lưu một bản quy mô (dùng ở trang Thông tin trường và trang Định mức) */
export default function LichSuQuyMoDrawer({ open, onClose, lichSu, cap, coTheSua, onNap, ghiChuNap }: {
  open: boolean; onClose: () => void; lichSu: QuyMoLichSu[]; cap: CapHoc; coTheSua: boolean; onNap: (nd: NoiDungQuyMo) => void
  /** Phần nào của bản cũ được nạp lại ở trang này */
  ghiChuNap: string
}) {
  // lichSu đã sắp mới nhất trước; bản liền trước của dòng i là dòng i + 1
  return (
    <Drawer title="Lịch sử khai báo quy mô" size={760} open={open} onClose={onClose}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Mỗi lần lưu quy mô hoặc điều chỉnh định mức để lại một bản (tối đa 30 bản gần nhất)."
        description={`Bản nào khai nhầm hoặc bị mất số liệu, bấm "Nạp vào form" để lấy lại rồi kiểm tra và Lưu. ${ghiChuNap}`}
      />
      {lichSu.length === 0 ? (
        <Empty description="Chưa có lịch sử. Bản đầu tiên sẽ xuất hiện sau lần lưu tiếp theo." />
      ) : (
        <Table<QuyMoLichSu>
          size="small"
          bordered
          rowKey="id"
          pagination={false}
          dataSource={lichSu}
          columns={[
            {
              title: 'Thời điểm', key: 'tg', width: 140,
              render: (_, l, i) => (
                <Space orientation="vertical" size={0}>
                  <Text>{formatDatetime(l.thoiGian)}</Text>
                  {i === 0 && <Tag color="blue" style={{ marginTop: 2 }}>Bản hiện tại</Tag>}
                  {l.ghiChuBan && <Text type="secondary" style={{ fontSize: 12 }}>{l.ghiChuBan}</Text>}
                </Space>
              ),
            },
            { title: 'Người lưu', key: 'ng', width: 140, render: (_, l) => l.nguoiTen ?? '-' },
            {
              title: 'Nội dung', key: 'nd',
              render: (_, l, i) => {
                const doi = soSanhNoiDung(lichSu[i + 1]?.noiDung, l.noiDung, cap)
                return (
                  <Space orientation="vertical" size={2}>
                    <Text strong>{tomTatNoiDung(l.noiDung, cap)}</Text>
                    {doi.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: '#64748b' }}>
                        {doi.slice(0, 8).map((d) => <li key={d}>{d}</li>)}
                        {doi.length > 8 && <li>và {doi.length - 8} thay đổi khác</li>}
                      </ul>
                    )}
                  </Space>
                )
              },
            },
            {
              title: '', key: 'ac', width: 120, align: 'center',
              render: (_, l, i) => coTheSua && i > 0
                ? <Button size="small" onClick={() => onNap(l.noiDung)}>Nạp vào form</Button>
                : null,
            },
          ]}
        />
      )}
    </Drawer>
  )
}
