import { useState, useMemo } from 'react'
import {
  Card, Table, Input, Select, Space, Typography, Tag, Drawer, Descriptions,
  DatePicker, Button, Empty, Statistic, Row, Col,
} from 'antd'
import { SearchOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNhatKyStore } from '@/store/nhatKyStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { formatDatetime, matchSearch } from '@/utils/helpers'
import type { NhatKyThaoTac } from '@/types/luong'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

const NHAN_HANH_DONG: Record<string, { nhan: string; mau: string }> = {
  CREATE:     { nhan: 'Thêm mới',        mau: 'green' },
  UPDATE:     { nhan: 'Cập nhật',        mau: 'blue' },
  DELETE:     { nhan: 'Xóa',             mau: 'red' },
  VIEW:       { nhan: 'Xem',             mau: 'default' },
  EXPORT:     { nhan: 'Kết xuất',        mau: 'cyan' },
  LOGIN:      { nhan: 'Đăng nhập',       mau: 'purple' },
  LOGIN_FAIL: { nhan: 'Đăng nhập hỏng',  mau: 'volcano' },
  LOGOUT:     { nhan: 'Đăng xuất',       mau: 'default' },
  APPROVE:    { nhan: 'Phê duyệt',       mau: 'success' },
  REJECT:     { nhan: 'Từ chối',         mau: 'error' },
  PASSWORD:   { nhan: 'Đổi mật khẩu',    mau: 'gold' },
  PERMISSION: { nhan: 'Đổi quyền',       mau: 'magenta' },
}

const NHAN_DOI_TUONG: Record<string, string> = {
  User: 'Tài khoản',
  VienChuc: 'Hồ sơ viên chức',
  DeXuatLuong: 'Đề xuất lương',
  ChuyenCongTac: 'Chuyển công tác',
  HeSoLuong: 'Hệ số lương',
  PhuCap: 'Phụ cấp',
  DanhMuc: 'Danh mục',
}

export default function AuditLogPage() {
  const nhatKys = useNhatKyStore((s) => s.nhatKys)
  const donVis = useDanhMucStore((s) => s.donVis)

  const [search, setSearch] = useState('')
  const [locHanhDong, setLocHanhDong] = useState<string | undefined>()
  const [locDoiTuong, setLocDoiTuong] = useState<string | undefined>()
  const [locNguoi, setLocNguoi] = useState<string | undefined>()
  const [khoang, setKhoang] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [xemChiTiet, setXemChiTiet] = useState<NhatKyThaoTac | null>(null)

  const dsNguoi = useMemo(
    () => [...new Set(nhatKys.map((n) => n.userFullName).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')),
    [nhatKys],
  )

  const data = useMemo(() => {
    return nhatKys
      .filter((n) => {
        if (locHanhDong && n.action !== locHanhDong) return false
        if (locDoiTuong && n.entity !== locDoiTuong) return false
        if (locNguoi && n.userFullName !== locNguoi) return false
        if (khoang) {
          const t = dayjs(n.thoiGian)
          if (t.isBefore(khoang[0].startOf('day')) || t.isAfter(khoang[1].endOf('day'))) return false
        }
        if (search) return matchSearch(`${n.userFullName} ${n.moTa} ${n.entity}`, search)
        return true
      })
      .sort((a, b) => (b.thoiGian ?? '').localeCompare(a.thoiGian ?? ''))
  }, [nhatKys, locHanhDong, locDoiTuong, locNguoi, khoang, search])

  // Vài con số để nhìn ra ngay tình hình truy cập
  const thongKe = useMemo(() => {
    const homNay = dayjs().startOf('day')
    const trongNgay = nhatKys.filter((n) => dayjs(n.thoiGian).isAfter(homNay))
    return {
      tong: nhatKys.length,
      dangNhapHomNay: trongNgay.filter((n) => n.action === 'LOGIN').length,
      hongHomNay: trongNgay.filter((n) => n.action === 'LOGIN_FAIL').length,
      thaoTacHomNay: trongNgay.filter((n) => !['LOGIN', 'LOGOUT', 'LOGIN_FAIL'].includes(n.action)).length,
    }
  }, [nhatKys])

  const tenDonVi = (id?: string) => (id ? donVis.find((d) => d.id === id)?.ten ?? id : '—')

  const xuatCSV = () => {
    const dong = [
      ['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng', 'Đơn vị', 'Mô tả', 'Thiết bị'].join(','),
      ...data.map((n) => [
        formatDatetime(n.thoiGian),
        n.userFullName,
        NHAN_HANH_DONG[n.action]?.nhan ?? n.action,
        NHAN_DOI_TUONG[n.entity] ?? n.entity,
        tenDonVi(n.donViId),
        n.moTa,
        n.thietBi ?? '',
      ].map((o) => `"${String(o).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const blob = new Blob(['﻿' + dong], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `nhat-ky-thao-tac-${dayjs().format('YYYYMMDD-HHmm')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const cols = [
    {
      title: 'Thời gian', dataIndex: 'thoiGian', key: 'tg', width: 150,
      render: (v: string) => formatDatetime(v),
    },
    { title: 'Người thực hiện', dataIndex: 'userFullName', key: 'nguoi', width: 180, ellipsis: true },
    {
      title: 'Hành động', dataIndex: 'action', key: 'hd', width: 130,
      render: (v: string) => {
        const t = NHAN_HANH_DONG[v] ?? { nhan: v, mau: 'default' }
        return <Tag color={t.mau}>{t.nhan}</Tag>
      },
    },
    {
      title: 'Đối tượng', dataIndex: 'entity', key: 'dt', width: 145,
      render: (v: string) => NHAN_DOI_TUONG[v] ?? v,
    },
    { title: 'Nội dung', dataIndex: 'moTa', key: 'mota', ellipsis: true },
    {
      title: '', key: 'xem', width: 46, align: 'center' as const,
      render: (_: unknown, r: NhatKyThaoTac) => (
        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setXemChiTiet(r)} />
      ),
    },
  ]

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>Nhật ký thao tác hệ thống</Title>
        <Button icon={<DownloadOutlined />} onClick={xuatCSV} disabled={!data.length}>Xuất CSV</Button>
      </div>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Tổng bản ghi" value={thongKe.tong} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Đăng nhập hôm nay" value={thongKe.dangNhapHomNay} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Đăng nhập hỏng hôm nay" value={thongKe.hongHomNay} valueStyle={{ color: thongKe.hongHomNay ? '#cf1322' : undefined }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Thao tác hôm nay" value={thongKe.thaoTacHomNay} valueStyle={{ color: '#1677ff' }} /></Card></Col>
      </Row>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input prefix={<SearchOutlined />} placeholder="Tìm theo người, nội dung..." style={{ width: 240 }}
          value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
        <Select placeholder="Hành động" style={{ width: 165 }} value={locHanhDong} onChange={setLocHanhDong} allowClear
          options={Object.entries(NHAN_HANH_DONG).map(([k, v]) => ({ value: k, label: v.nhan }))} />
        <Select placeholder="Đối tượng" style={{ width: 165 }} value={locDoiTuong} onChange={setLocDoiTuong} allowClear
          options={Object.entries(NHAN_DOI_TUONG).map(([k, v]) => ({ value: k, label: v }))} />
        <Select placeholder="Người thực hiện" style={{ width: 200 }} value={locNguoi} onChange={setLocNguoi} allowClear showSearch
          options={dsNguoi.map((v) => ({ value: v, label: v }))} />
        <RangePicker format="DD/MM/YYYY" value={khoang} onChange={(v) => setKhoang(v as never)} />
      </Space>

      <Table dataSource={data} columns={cols} rowKey="id" size="small" scroll={{ x: 900 }}
        pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [20, 50, 100, 200], showTotal: (t) => `${t} bản ghi` }}
      />

      <Drawer
        title="Chi tiết thao tác"
        open={!!xemChiTiet}
        onClose={() => setXemChiTiet(null)}
        width={560}
      >
        {xemChiTiet && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Thời gian">{formatDatetime(xemChiTiet.thoiGian)}</Descriptions.Item>
              <Descriptions.Item label="Người thực hiện">{xemChiTiet.userFullName}</Descriptions.Item>
              <Descriptions.Item label="Hành động">
                <Tag color={NHAN_HANH_DONG[xemChiTiet.action]?.mau ?? 'default'}>
                  {NHAN_HANH_DONG[xemChiTiet.action]?.nhan ?? xemChiTiet.action}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Đối tượng">
                {NHAN_DOI_TUONG[xemChiTiet.entity] ?? xemChiTiet.entity}
              </Descriptions.Item>
              <Descriptions.Item label="Đơn vị">{tenDonVi(xemChiTiet.donViId)}</Descriptions.Item>
              <Descriptions.Item label="Nội dung">{xemChiTiet.moTa}</Descriptions.Item>
              <Descriptions.Item label="Thiết bị">{xemChiTiet.thietBi ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Mã bản ghi">
                <Text code style={{ fontSize: 11 }}>{xemChiTiet.entityId ?? '—'}</Text>
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>Các trường đã thay đổi</Title>
            {xemChiTiet.chiTiet?.length ? (
              <Table
                size="small"
                pagination={false}
                rowKey={(r) => r.truong}
                dataSource={xemChiTiet.chiTiet}
                columns={[
                  { title: 'Trường', dataIndex: 'truong', key: 't', width: 150 },
                  { title: 'Trước', dataIndex: 'truoc', key: 'a', render: (v: string) => <Text delete type="secondary">{v}</Text> },
                  { title: 'Sau', dataIndex: 'sau', key: 'b', render: (v: string) => <Text strong style={{ color: '#389e0d' }}>{v}</Text> },
                ]}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Thao tác này không ghi chi tiết từng trường"
              />
            )}
          </>
        )}
      </Drawer>
    </Card>
  )
}
