import { useMemo, useState } from 'react'
import { Button, Card, Col, Row, Select, Space, Table, Typography } from 'antd'
import { FileExcelOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useBoNhiem } from '@/hooks/useBoNhiem'
import { useDanhMucStore } from '@/store/danhMucStore'
import { CHUC_VU_LABELS, HINH_THUC_BO_NHIEM_LABELS } from '@/types/vienChuc'
import { formatDate } from '@/utils/helpers'
import { exportToExcel } from '@/utils/exportExcel'
import { MOC_CHUAN_BI_THANG, MOC_DEN_HAN_NGAY, MUC_NHAC_BO_NHIEM, NAM_XET_KEO_DAI, moTaConLai } from '@/utils/boNhiem'
import type { MucNhacBoNhiem, TinhTrangBoNhiem } from '@/utils/boNhiem'
import { TagKeoDai, TagMucBoNhiem } from '@/components/BoNhiemTags'

const { Title, Text } = Typography

type BoLoc = 'CAN_NHAC' | 'KEO_DAI' | 'TAT_CA' | MucNhacBoNhiem

/** Ô thống kê bấm được để lọc */
const O_LOC: { key: BoLoc; ten: string; mau: string; moTa: string }[] = [
  { key: 'QUA_HAN', ten: 'Quá hạn', mau: MUC_NHAC_BO_NHIEM.QUA_HAN.mau, moTa: 'Hết nhiệm kỳ, chưa có QĐ mới' },
  { key: 'DEN_HAN', ten: `Còn dưới ${MOC_DEN_HAN_NGAY} ngày`, mau: MUC_NHAC_BO_NHIEM.DEN_HAN.mau, moTa: 'Hạn hoàn thành quy trình' },
  { key: 'CHUAN_BI', ten: `Còn dưới ${MOC_CHUAN_BI_THANG} tháng`, mau: MUC_NHAC_BO_NHIEM.CHUAN_BI.mau, moTa: 'Bắt đầu chuẩn bị hồ sơ' },
  { key: 'KEO_DAI', ten: 'Xem xét kéo dài', mau: '#722ed1', moTa: `Dưới ${NAM_XET_KEO_DAI} năm đến tuổi nghỉ hưu` },
  { key: 'CHUA_NHAP', ten: 'Chưa nhập QĐ', mau: '#64748b', moTa: 'Trường cần bổ sung' },
  { key: 'TAT_CA', ten: 'Tất cả HT, P.HT', mau: '#2563eb', moTa: 'Toàn bộ cán bộ quản lý' },
]

export default function TheoDoiBoNhiemPage() {
  const navigate = useNavigate()
  const { scopeDonViId } = useAuth()
  const { tatCa } = useBoNhiem(scopeDonViId)
  const donVis = useDanhMucStore((s) => s.donVis)
  const tenDv = useMemo(() => new Map(donVis.map((d) => [d.id, d.ten])), [donVis])
  const [params, setParams] = useSearchParams()
  const loc = (params.get('loc') as BoLoc) || 'CAN_NHAC'
  const [donViId, setDonViId] = useState<string>()

  const khop = (t: TinhTrangBoNhiem, l: BoLoc) =>
    l === 'TAT_CA' ? true
      : l === 'CAN_NHAC' ? ['QUA_HAN', 'DEN_HAN', 'CHUAN_BI'].includes(t.muc)
      : l === 'KEO_DAI' ? t.xemXetKeoDai
      : t.muc === l
  const trongTruong = tatCa.filter((t) => !donViId || t.vc.donViId === donViId)
  const ds = trongTruong.filter((t) => khop(t, loc))
  const datLoc = (l: BoLoc) => setParams(l === 'CAN_NHAC' ? {} : { loc: l }, { replace: true })

  const xuatExcel = () => exportToExcel(ds.map((t, i) => ({
    'STT': i + 1,
    'Trường': tenDv.get(t.vc.donViId) ?? '',
    'Họ và tên': `${t.vc.ho} ${t.vc.ten}`,
    'Chức vụ': CHUC_VU_LABELS[t.vc.chucVu ?? ''] ?? t.vc.chucVu ?? '',
    'Hình thức': t.bn ? HINH_THUC_BO_NHIEM_LABELS[t.bn.hinhThuc] : '',
    'Số QĐ': t.bn?.soQuyetDinh ?? '',
    'Ngày QĐ': formatDate(t.bn?.ngayQuyetDinh),
    'Cơ quan ra QĐ': t.bn?.coQuanQuyetDinh ?? '',
    'Nhiệm kỳ từ': formatDate(t.bn?.ngayBatDau),
    'Hết nhiệm kỳ': formatDate(t.bn?.ngayHetNhiemKy),
    'Còn lại': moTaConLai(t.soNgayCon),
    'Tình trạng': MUC_NHAC_BO_NHIEM[t.muc].ten,
    'Ngày nghỉ hưu': formatDate(t.ngayNghiHuu),
    'Xem xét kéo dài': t.xemXetKeoDai ? 'Có' : '',
  })), 'TheoDoiBoNhiem', 'Bổ nhiệm')

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <div>
          <Title level={4} style={{ margin: 0 }}>Theo dõi bổ nhiệm cán bộ quản lý</Title>
          <Text type="secondary">
            Hiệu trưởng, Phó Hiệu trưởng - nhắc khi còn {MOC_CHUAN_BI_THANG} tháng (chuẩn bị hồ sơ) và {MOC_DEN_HAN_NGAY} ngày (hạn hoàn thành quy trình bổ nhiệm lại) trước khi hết nhiệm kỳ.
          </Text>
        </div>
        <Space wrap>
          {!scopeDonViId && (
            <Select
              allowClear placeholder="Tất cả trường" style={{ width: 260 }} value={donViId} onChange={setDonViId}
              showSearch optionFilterProp="label"
              options={donVis.filter((d) => d.active).map((d) => ({ value: d.id, label: d.ten }))}
            />
          )}
          <Button icon={<FileExcelOutlined />} onClick={xuatExcel} disabled={!ds.length}>Xuất Excel</Button>
        </Space>
      </Space>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {O_LOC.map((o) => {
          const so = trongTruong.filter((t) => khop(t, o.key)).length
          const chon = loc === o.key
          return (
            <Col key={o.key} flex="1 1 160px">
              <Card
                size="small" hoverable onClick={() => datLoc(chon ? 'CAN_NHAC' : o.key)}
                style={{ borderTop: `3px solid ${o.mau}`, background: chon ? '#f0f5ff' : undefined, outline: chon ? `2px solid ${o.mau}` : undefined }}
              >
                <div style={{ fontSize: 14, color: '#475569' }}>{o.ten}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: so ? o.mau : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{so}</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>{o.moTa}</div>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Card size="small" title={
        <span>
          {loc === 'CAN_NHAC' ? 'Cần nhắc việc (quá hạn, dưới 90 ngày, dưới 6 tháng)' : O_LOC.find((o) => o.key === loc)?.ten}
          <Text type="secondary" style={{ fontWeight: 400 }}> - {ds.length} người</Text>
        </span>
      } extra={loc !== 'CAN_NHAC' && <a onClick={() => datLoc('CAN_NHAC')}>Về danh sách cần nhắc</a>}>
        <Table<TinhTrangBoNhiem>
          size="small"
          rowKey={(t) => t.vc.id}
          dataSource={ds}
          pagination={{ pageSize: 50, hideOnSinglePage: true }}
          scroll={{ x: 1450 }}
          locale={{ emptyText: loc === 'CAN_NHAC' ? 'Không có trường hợp nào đến mốc nhắc' : 'Không có' }}
          columns={[
            ...(scopeDonViId ? [] : [{ title: 'Trường', key: 'dv', width: 230, render: (_: unknown, t: TinhTrangBoNhiem) => tenDv.get(t.vc.donViId) ?? '' }]),
            {
              title: 'Họ và tên', key: 'ht', width: 210,
              render: (_: unknown, t: TinhTrangBoNhiem) => <a onClick={() => navigate(`/vien-chuc/${t.vc.id}?tab=bo-nhiem`)}>{t.vc.ho} {t.vc.ten}</a>,
            },
            { title: 'Chức vụ', key: 'cv', width: 150, render: (_: unknown, t: TinhTrangBoNhiem) => CHUC_VU_LABELS[t.vc.chucVu ?? ''] ?? t.vc.chucVu },
            {
              title: 'Quyết định', key: 'qd', width: 230,
              render: (_: unknown, t: TinhTrangBoNhiem) => t.bn ? (
                <div>
                  <div>{t.bn.soQuyetDinh} - {formatDate(t.bn.ngayQuyetDinh)}</div>
                  <Text type="secondary" style={{ fontSize: 13 }}>{HINH_THUC_BO_NHIEM_LABELS[t.bn.hinhThuc]}</Text>
                </div>
              ) : <Text type="secondary">-</Text>,
            },
            { title: 'Nhiệm kỳ từ', key: 'bd', width: 115, render: (_: unknown, t: TinhTrangBoNhiem) => formatDate(t.bn?.ngayBatDau) },
            {
              title: 'Hết nhiệm kỳ', key: 'het', width: 125,
              sorter: (a: TinhTrangBoNhiem, b: TinhTrangBoNhiem) => (a.bn?.ngayHetNhiemKy ?? '9').localeCompare(b.bn?.ngayHetNhiemKy ?? '9'),
              render: (_: unknown, t: TinhTrangBoNhiem) => <b>{formatDate(t.bn?.ngayHetNhiemKy)}</b>,
            },
            {
              title: 'Còn lại', key: 'con', width: 115,
              render: (_: unknown, t: TinhTrangBoNhiem) => <span style={{ color: t.soNgayCon != null && t.soNgayCon <= MOC_DEN_HAN_NGAY ? '#cf1322' : undefined, fontWeight: 600 }}>{moTaConLai(t.soNgayCon)}</span>,
            },
            {
              title: 'Tình trạng', key: 'muc', width: 230,
              render: (_: unknown, t: TinhTrangBoNhiem) => (
                <Space size={4} wrap>
                  <TagMucBoNhiem muc={t.muc} />
                  {t.xemXetKeoDai && <TagKeoDai ngayNghiHuu={t.ngayNghiHuu} />}
                </Space>
              ),
            },
            { title: 'Ngày nghỉ hưu', key: 'nh', width: 125, render: (_: unknown, t: TinhTrangBoNhiem) => formatDate(t.ngayNghiHuu) },
          ]}
        />
      </Card>
    </div>
  )
}
