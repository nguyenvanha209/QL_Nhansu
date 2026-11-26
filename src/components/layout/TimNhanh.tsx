import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input, Modal, Typography } from 'antd'
import type { InputRef } from 'antd'
import { SearchOutlined, UserOutlined, AppstoreOutlined } from '@ant-design/icons'
import { useVienChucStore } from '@/store/vienChucStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { normalize } from '@/utils/helpers'

export interface MucTimNhanh {
  den: string
  ten: string
  nhom?: string
  icon?: ReactNode
}

interface KetQua {
  key: string
  den: string
  icon: ReactNode
  ten: string
  phu?: string
}

const TOI_DA_NGUOI = 8

/**
 * Tìm nhanh (Ctrl+K): gõ tên chức năng hoặc họ tên / mã viên chức từ bất kỳ trang nào, Enter để mở.
 * Chỉ tìm trong các chức năng tài khoản được dùng và hồ sơ trong phạm vi (trường mình hoặc toàn phường).
 */
export default function TimNhanh({ mo, dong, chucNangs, scopeDonViId }: {
  mo: boolean
  dong: () => void
  chucNangs: MucTimNhanh[]
  scopeDonViId: string | null
}) {
  const navigate = useNavigate()
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const donVis = useDanhMucStore((s) => s.donVis)
  const [tu, setTu] = useState('')
  const [chon, setChon] = useState(0)
  const oNhap = useRef<InputRef>(null)

  useEffect(() => {
    if (mo) { setTu(''); setChon(0); setTimeout(() => oNhap.current?.focus(), 50) }
  }, [mo])

  const ketQua = useMemo<KetQua[]>(() => {
    const q = normalize(tu.trim())
    const cn = chucNangs
      .filter((c) => !q || normalize(`${c.ten} ${c.nhom ?? ''}`).includes(q))
      .map((c) => ({ key: `cn:${c.den}`, den: c.den, icon: c.icon ?? <AppstoreOutlined />, ten: c.ten, phu: c.nhom }))
    if (q.length < 2) return cn
    const tenTruong = new Map(donVis.map((d) => [d.id, d.ten]))
    const nguoi = vienChucs
      .filter((v) => v.active && (!scopeDonViId || v.donViId === scopeDonViId)
        && (normalize(`${v.ho} ${v.ten}`).includes(q) || normalize(v.ma ?? '').includes(q)))
      .slice(0, TOI_DA_NGUOI)
      .map((v) => ({ key: `vc:${v.id}`, den: `/vien-chuc/${v.id}`, icon: <UserOutlined />, ten: `${v.ho} ${v.ten}`, phu: tenTruong.get(v.donViId) }))
    return [...nguoi, ...cn]
  }, [tu, chucNangs, vienChucs, donVis, scopeDonViId])

  useEffect(() => { setChon(0) }, [tu])

  const mo_ = (k?: KetQua) => {
    if (!k) return
    dong()
    navigate(k.den)
  }

  return (
    <Modal open={mo} onCancel={dong} footer={null} closable={false} width={560} styles={{ body: { padding: 0 } }} style={{ top: 80 }} destroyOnHidden>
      <div style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
        <Input
          ref={oNhap}
          size="large"
          variant="borderless"
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Gõ họ tên, mã hồ sơ hoặc tên chức năng"
          value={tu}
          onChange={(e) => setTu(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setChon((c) => Math.min(c + 1, ketQua.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setChon((c) => Math.max(c - 1, 0)) }
            if (e.key === 'Enter') { e.preventDefault(); mo_(ketQua[chon]) }
          }}
        />
      </div>
      <div style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
        {ketQua.length === 0 ? (
          <Typography.Text type="secondary" style={{ display: 'block', padding: '16px 12px' }}>Không tìm thấy kết quả phù hợp</Typography.Text>
        ) : ketQua.map((k, i) => (
          <div
            key={k.key}
            onMouseEnter={() => setChon(i)}
            onClick={() => mo_(k)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
              background: i === chon ? '#eff6ff' : undefined, color: i === chon ? '#1d4ed8' : undefined,
            }}
          >
            <span style={{ display: 'flex', fontSize: 15, color: i === chon ? '#1d4ed8' : '#64748b' }}>{k.icon}</span>
            <span style={{ flex: 1, minWidth: 0 }}>{k.ten}</span>
            {k.phu && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{k.phu}</Typography.Text>}
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 14px', borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#94a3b8' }}>
        ↑ ↓ để chọn · Enter để mở · Esc để đóng
      </div>
    </Modal>
  )
}
