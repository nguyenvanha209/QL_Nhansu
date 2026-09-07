import { useState, useMemo } from 'react'
import { Card, Table, Input, Select, Space, Typography, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useLuongStore } from '@/store/luongStore'
import { formatDatetime, matchSearch } from '@/utils/helpers'

const { Title } = Typography

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'green', UPDATE: 'blue', DELETE: 'red', VIEW: 'default',
  EXPORT: 'cyan', LOGIN: 'purple', APPROVE: 'success', REJECT: 'error',
}

export default function AuditLogPage() {
  const nhatKys = useLuongStore((s) => s.nhatKyThaoTacs)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState<string | undefined>()

  const data = useMemo(() => {
    return nhatKys
      .filter((n) => {
        if (filterAction && n.action !== filterAction) return false
        if (search) return matchSearch(`${n.userFullName} ${n.moTa} ${n.entity}`, search)
        return true
      })
  }, [nhatKys, filterAction, search])

  const cols = [
    { title: 'Thời gian', dataIndex: 'thoiGian', key: 'tg', width: 155, render: (v: string) => formatDatetime(v) },
    { title: 'Người thực hiện', dataIndex: 'userFullName', key: 'unf', ellipsis: true, width: 160 },
    { title: 'Hành động', dataIndex: 'action', key: 'act', width: 100, render: (v: string) => <Tag color={ACTION_COLORS[v] ?? 'default'}>{v}</Tag> },
    { title: 'Thực thể', dataIndex: 'entity', key: 'entity', width: 120 },
    { title: 'Mô tả', dataIndex: 'moTa', key: 'mota', ellipsis: true },
  ]

  return (
    <Card>
      <Title level={4} style={{ marginBottom: 16 }}>Nhật ký thao tác hệ thống</Title>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input prefix={<SearchOutlined />} placeholder="Tìm kiếm..." style={{ width: 260 }} value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
        <Select placeholder="Lọc hành động" style={{ width: 150 }} value={filterAction} onChange={setFilterAction} allowClear
          options={['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'APPROVE', 'REJECT', 'EXPORT'].map((v) => ({ value: v, label: v }))}
        />
      </Space>
      <Table dataSource={data} columns={cols} rowKey="id" size="small" scroll={{ x: 800 }}
        pagination={{ pageSize: 50, showTotal: (t) => `${t} bản ghi` }}
      />
    </Card>
  )
}
