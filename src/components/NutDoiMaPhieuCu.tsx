import { useMemo } from 'react'
import { App, Button, Table } from 'antd'
import { SwapOutlined } from '@ant-design/icons'
import { useDeXuatStore, TIEN_TO_MA, maNganDonVi } from '@/store/deXuatStore'
import { useTruyLinhStore } from '@/store/truyLinhStore'
import { useThongBaoStore } from '@/store/thongBaoStore'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useAuth } from '@/hooks/useAuth'
import { LOAI_DE_XUAT_LABELS } from '@/types/deXuat'
import type { DeXuatLuong } from '@/types/deXuat'
import { logAction } from '@/utils/auditLogger'

/**
 * Đổi mã phiếu cũ (DX-năm-số, đánh chung mọi loại nên trùng giữa các đơn vị) sang quy tắc mới
 * <tiền tố loại>-<mã đơn vị>-<năm>-<số>; số nối tiếp theo thứ tự tạo phiếu, sau số lớn nhất đã có của loại, đơn vị, năm đó.
 */
export function tinhMaMoiChoPhieuCu(ds: DeXuatLuong[]): Map<string, string> {
  const doi = new Map<string, string>()
  const daCo = new Set(ds.filter((d) => !d.ma?.startsWith('DX-')).map((d) => d.ma))
  const cu = ds.filter((d) => d.ma?.startsWith('DX-')).sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.ma.localeCompare(b.ma))
  for (const d of cu) {
    const nam = (d.createdAt ?? '').slice(0, 4) || d.ma.slice(3, 7)
    const dau = `${TIEN_TO_MA[d.loai] ?? 'DX'}-${maNganDonVi(d.donViId)}-${nam}-`
    let so = [...daCo].reduce((m, x) => (x?.startsWith(dau) ? Math.max(m, parseInt(x.slice(dau.length), 10) || 0) : m), 0) + 1
    while (daCo.has(`${dau}${String(so).padStart(3, '0')}`)) so++
    const moi = `${dau}${String(so).padStart(3, '0')}`
    daCo.add(moi)
    doi.set(d.id, moi)
  }
  return doi
}

/** Thay mã phiếu đã chụp trong bảng truy lĩnh, thông báo kết quả (các dòng có deXuatId) */
function thayMaTrong<T>(x: T, doi: Map<string, string>): { gt: T; so: number } {
  let so = 0
  const di = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(di)
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      const moi: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(o)) moi[k] = di(val)
      if (typeof o.deXuatId === 'string' && typeof o.deXuatMa === 'string' && doi.has(o.deXuatId)) { moi.deXuatMa = doi.get(o.deXuatId); so++ }
      return moi
    }
    return v
  }
  return { gt: di(x) as T, so }
}

export default function NutDoiMaPhieuCu() {
  const { modal, message } = App.useApp()
  const { currentUser, isAdmin, isVHXH } = useAuth()
  const deXuats = useDeXuatStore((s) => s.deXuats)
  const donVis = useDanhMucStore((s) => s.donVis)
  const doi = useMemo(() => tinhMaMoiChoPhieuCu(deXuats), [deXuats, donVis]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!(isAdmin || isVHXH) || !doi.size || !currentUser) return null

  const tenDv = (id: string) => donVis.find((d) => d.id === id)?.ten ?? ''
  const dong = deXuats.filter((d) => doi.has(d.id)).map((d) => ({ id: d.id, cu: d.ma, moi: doi.get(d.id)!, loai: LOAI_DE_XUAT_LABELS[d.loai], dv: tenDv(d.donViId) }))

  const thucHien = () => {
    const ds = useDeXuatStore.getState().deXuats
    const m = tinhMaMoiChoPhieuCu(ds)
    useDeXuatStore.getState().setDeXuats(ds.map((d) => (m.has(d.id) ? { ...d, ma: m.get(d.id)!, updatedAt: new Date().toISOString() } : d)))
    const tl = thayMaTrong(useTruyLinhStore.getState().bangs, m)
    if (tl.so) useTruyLinhStore.getState().setBangs(tl.gt)
    const tb = thayMaTrong(useThongBaoStore.getState().thongBaos, m)
    if (tb.so) useThongBaoStore.getState().setThongBaos(tb.gt)
    logAction(currentUser.id, currentUser.fullName, 'UPDATE', 'DeXuatLuong', 'doi-ma',
      `Đổi mã ${m.size} phiếu cũ sang quy tắc mới (loại - đơn vị - năm - số): ${[...m.entries()].map(([id, ma]) => `${ds.find((d) => d.id === id)?.ma} → ${ma}`).join('; ')}`,
    )
    message.success(`Đã đổi mã ${m.size} phiếu${tl.so || tb.so ? `, cập nhật ${tl.so + tb.so} dòng truy lĩnh / thông báo` : ''}`)
  }

  return (
    <Button size="small" icon={<SwapOutlined />} onClick={() => modal.confirm({
      title: `Đổi mã ${doi.size} phiếu cũ sang quy tắc mới?`,
      width: 760,
      content: (
        <>
          <div style={{ marginBottom: 8 }}>Mã mới: loại phiếu - mã đơn vị - năm - số thứ tự (theo thứ tự lập phiếu). Mã trong bảng truy lĩnh, thông báo kết quả đổi theo.</div>
          <Table size="small" bordered pagination={false} rowKey="id" dataSource={dong} scroll={{ y: 320 }}
            columns={[
              { title: 'Mã cũ', dataIndex: 'cu', width: 120 },
              { title: 'Mã mới', dataIndex: 'moi', width: 170, render: (v: string) => <b>{v}</b> },
              { title: 'Loại', dataIndex: 'loai', width: 170 },
              { title: 'Đơn vị', dataIndex: 'dv' },
            ]} />
        </>
      ),
      okText: 'Đổi mã',
      cancelText: 'Để sau',
      onOk: thucHien,
    })}>Đổi mã {doi.size} phiếu cũ theo quy tắc mới</Button>
  )
}
