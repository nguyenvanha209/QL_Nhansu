import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  Card, Typography, Select, Table, Tag, Tabs, InputNumber, Button, Space, Alert, App, Input,
  Statistic, Row, Col, Tooltip, Empty, Segmented, Badge, Checkbox,
} from 'antd'
import {
  SaveOutlined, DownloadOutlined, ArrowLeftOutlined, BulbOutlined, SearchOutlined, UndoOutlined,
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import { useAuth } from '@/hooks/useAuth'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { duocTinhSoLieu } from '@/types/vienChuc'
import type { VienChuc } from '@/types/vienChuc'
import type { DonVi } from '@/types/donVi'
import type { QuyMoTruong } from '@/types/quyMo'
import { HANG_TRUONG_LABELS, getHangTruong } from '@/utils/hangTruong'
import { logAction } from '@/utils/auditLogger'
import { exportToExcel } from '@/utils/exportExcel'
import { formatDatetime } from '@/utils/helpers'
import {
  type CapHoc, type DongDinhMuc, type KetQuaDinhMuc, type DongPhanBoKiem, type TongNhom,
  laCapHoc, TEN_CAP, THU_TU_CAP, KHOI, NHOM_DINH_MUC, MON_GIANG_DAY, CO_HAI_BUOI, KHOI_TIN_TU_CHON,
  namHocHienHanh, dsNamHoc, idQuyMo, tinhDinhMuc, tongQuyMo, goiYMonDay, tenMonDay, fmt, lamTron1, nhomNguoi,
} from '@/utils/dinhMuc'

const { Title, Text } = Typography

const NGUONG_HANG: Record<CapHoc, string> = {
  MAM_NON: 'Hạng I từ 9 nhóm, lớp; hạng II từ 6 đến 8; hạng III từ 5 trở xuống',
  TIEU_HOC: 'Hạng I từ 28 lớp; hạng II từ 18 đến 27; hạng III dưới 18',
  THCS: 'Hạng I từ 28 lớp; hạng II từ 18 đến 27; hạng III dưới 18',
}

type TruongKhoi = 'soLop' | 'soHocSinh' | 'soLop2Buoi' | 'soHocSinh2Buoi'

const quyMoTrong = (donViId: string, namHoc: string): QuyMoTruong => ({
  id: idQuyMo(donViId, namHoc), donViId, namHoc, khoi: {}, createdAt: '', updatedAt: '',
})

// So sánh phần người dùng nhập, bỏ qua thứ tự khóa và thông tin người cập nhật
function vanTay(q: QuyMoTruong | undefined, cap: CapHoc): string {
  if (!q) return vanTay(quyMoTrong('', ''), cap)
  return JSON.stringify({
    k: KHOI[cap].map((k) => {
      const o = q.khoi[k.ma]
      return [o?.soLop ?? 0, o?.soHocSinh ?? 0, ...(CO_HAI_BUOI[cap] ? [o?.soLop2Buoi ?? 0, o?.soHocSinh2Buoi ?? 0] : [])]
    }),
    b: cap === 'TIEU_HOC' ? [...(q.khoiDayTinThem ?? [])].sort() : [],
    t: Object.entries(q.dinhMucNhapTay ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    kn: cap === 'THCS' ? Object.entries(q.kiemNhiemNhapTay ?? {}).sort(([a], [b]) => a.localeCompare(b)) : [],
    d: cap === 'MAM_NON' ? q.soDiemTruong ?? 0 : 0,
    g: (q.ghiChu ?? '').trim(),
  })
}

function ChenhLech({ v }: { v: number | null }) {
  if (v == null) return <Text type="secondary">-</Text>
  const r = lamTron1(v)
  if (r === 0) return <Tag color="success" style={{ marginInlineEnd: 0 }}>Đủ</Tag>
  return (
    <Tooltip title={r > 0 ? 'Thừa so với định mức' : 'Thiếu so với định mức'}>
      <Tag color={r > 0 ? 'warning' : 'error'} style={{ marginInlineEnd: 0, fontVariantNumeric: 'tabular-nums' }}>
        {r > 0 ? '+' : '−'}{fmt(Math.abs(r))}
      </Tag>
    </Tooltip>
  )
}

function useTenChucDanh() {
  const chucDanhs = useDanhMucStore((s) => s.chucDanhs)
  return useMemo(() => {
    const m = new Map(chucDanhs.map((c) => [c.id, c]))
    return {
      lay: (id?: string) => (id ? m.get(id) : undefined),
      ma: (id?: string) => (id ? m.get(id)?.ma : undefined),
    }
  }, [chucDanhs])
}

export default function QuyMoDinhMucPage() {
  const { scopeDonViId } = useAuth()
  const donVis = useDanhMucStore((s) => s.donVis)
  const [namHoc, setNamHoc] = useState(namHocHienHanh)
  const [chon, setChon] = useState<string | undefined>()

  const truongs = useMemo(
    () => donVis
      .filter((d) => d.active && laCapHoc(d.loai))
      .sort((a, b) => THU_TU_CAP[a.loai as CapHoc] - THU_TU_CAP[b.loai as CapHoc] || a.ten.localeCompare(b.ten, 'vi')),
    [donVis],
  )
  const donViId = scopeDonViId ?? chon
  const donVi = truongs.find((d) => d.id === donViId)
  const hienHanh = namHocHienHanh()

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Định mức viên chức và Cơ cấu VTVL</Title>
          <Text type="secondary">
            Khai báo số lớp, số học sinh từng khối; tính định mức theo TT 19/2023/TT-BGDĐT (mầm non) và TT 20/2023/TT-BGDĐT (tiểu học, THCS)
          </Text>
        </div>
        <Space wrap>
          <Select
            value={namHoc}
            onChange={setNamHoc}
            style={{ width: 230 }}
            options={dsNamHoc().map((n) => ({ value: n, label: `Năm học ${n}${n === hienHanh ? ' (hiện hành)' : ''}` }))}
          />
          {!scopeDonViId && (
            <Select
              value={chon}
              onChange={setChon}
              allowClear
              placeholder="Tổng hợp toàn phường"
              style={{ width: 240 }}
              showSearch
              optionFilterProp="label"
              options={truongs.map((d) => ({ value: d.id, label: d.ten }))}
            />
          )}
        </Space>
      </div>

      {donVi ? (
        <ChiTietTruong
          key={`${donVi.id}-${namHoc}`}
          donVi={donVi}
          namHoc={namHoc}
          onBack={scopeDonViId ? undefined : () => setChon(undefined)}
        />
      ) : scopeDonViId ? (
        <Empty description="Đơn vị của tài khoản không phải trường mầm non, tiểu học hoặc THCS" />
      ) : (
        <TongHopPhuong truongs={truongs} namHoc={namHoc} onChon={setChon} />
      )}
    </Card>
  )
}

// ───────────────────────────── Tổng hợp toàn phường ─────────────────────────────

function TongHopPhuong({ truongs, namHoc, onChon }: { truongs: DonVi[]; namHoc: string; onChon: (id: string) => void }) {
  const quyMos = useDanhMucStore((s) => s.quyMoTruongs)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const cd = useTenChucDanh()

  const rows = useMemo(() => truongs.map((dv) => {
    const cap = dv.loai as CapHoc
    const qm = quyMos.find((q) => q.id === idQuyMo(dv.id, namHoc))
    const kq = qm ? tinhDinhMuc(cap, qm, vienChucs.filter((v) => v.donViId === dv.id), cd.lay) : undefined
    return { key: dv.id, dv, cap, qm, kq }
  }), [truongs, quyMos, vienChucs, namHoc, cd])

  const daKhai = rows.filter((r) => r.kq)
  const tong = (f: (k: KetQuaDinhMuc) => number) => daKhai.reduce((s, r) => s + f(r.kq!), 0)

  const xuat = () => exportToExcel(rows.map((r, i) => ({
    'STT': i + 1,
    'Trường': r.dv.ten,
    'Cấp học': TEN_CAP[r.cap],
    'Số lớp': r.kq?.tongLop ?? '',
    'Số học sinh': r.kq?.tongHS ?? '',
    'Bình quân HS/lớp': r.kq ? lamTron1(r.kq.binhQuan) : '',
    'Hạng trường': r.kq ? HANG_TRUONG_LABELS[r.kq.hang] : '',
    'Định mức giáo viên': r.kq ? lamTron1(r.kq.gvDinhMuc) : '',
    'Giáo viên có mặt': r.kq?.gvCoMat ?? '',
    'Thừa(+)/thiếu(-) giáo viên': r.kq ? lamTron1(r.kq.gvCoMat - r.kq.gvDinhMuc) : '',
    'Định mức toàn trường (I-III)': r.kq ? lamTron1(r.kq.tongDinhMuc) : '',
    'Có mặt tương ứng': r.kq?.coMatCoDinhMuc ?? '',
    'Thừa(+)/thiếu(-) toàn trường': r.kq ? lamTron1(r.kq.coMatCoDinhMuc - r.kq.tongDinhMuc) : '',
    'Giáo viên chưa phân môn': r.kq?.chuaPhanMon ?? '',
    'Kiêm nhiệm THCS (cần / đã phân bổ)': r.kq?.phanBoKiem ? `${lamTron1(r.kq.phanBoKiem.tong)} / ${lamTron1(r.kq.phanBoKiem.daPhanBo)}${r.kq.phanBoKiem.khop ? '' : ' (lệch)'}` : '',
    'Cập nhật': r.qm ? `${formatDatetime(r.qm.updatedAt)} - ${r.qm.nguoiCapNhat ?? ''}` : 'Chưa khai báo',
  })), `Dinh-muc-toan-phuong-${namHoc}`, 'Tổng hợp')

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title={`Đã khai báo quy mô năm học ${namHoc}: ${daKhai.length}/${rows.length} trường`}
        description="Bấm tên trường để xem chi tiết định mức từng vị trí. Số có mặt đếm theo hồ sơ đang công tác; nhân viên bảo vệ, nấu ăn, phục vụ, lao công không tính định mức."
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Button icon={<DownloadOutlined />} onClick={xuat}>Xuất Excel</Button>
      </div>
      <Table
        size="small"
        bordered
        pagination={false}
        dataSource={rows}
        scroll={{ x: 1150 }}
        columns={[
          { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
          {
            title: 'Trường', key: 'ten', width: 200,
            render: (_: unknown, r: (typeof rows)[number]) => <Button type="link" style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => onChon(r.dv.id)}>{r.dv.ten}</Button>,
          },
          { title: 'Số lớp', key: 'lop', width: 70, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq?.tongLop ?? '-' },
          { title: 'Học sinh', key: 'hs', width: 85, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq ? r.kq.tongHS.toLocaleString('vi-VN') : '-' },
          { title: 'BQ HS/lớp', key: 'bq', width: 80, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq ? fmt(r.kq.binhQuan) : '-' },
          { title: 'Hạng', key: 'hang', width: 85, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq ? <Tag color="blue">{HANG_TRUONG_LABELS[r.kq.hang]}</Tag> : '-' },
          {
            title: 'Giáo viên',
            children: [
              { title: 'Định mức', key: 'gvdm', width: 80, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq ? fmt(r.kq.gvDinhMuc) : '-' },
              { title: 'Có mặt', key: 'gvcm', width: 70, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq?.gvCoMat ?? '-' },
              { title: 'Thừa/thiếu', key: 'gvcl', width: 85, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq ? <ChenhLech v={r.kq.gvCoMat - r.kq.gvDinhMuc} /> : '-' },
            ],
          },
          {
            title: 'Toàn trường (vị trí có định mức)',
            children: [
              { title: 'Định mức', key: 'dm', width: 80, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq ? fmt(r.kq.tongDinhMuc) : '-' },
              { title: 'Có mặt', key: 'cm', width: 70, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq?.coMatCoDinhMuc ?? '-' },
              { title: 'Thừa/thiếu', key: 'cl', width: 85, align: 'center' as const, render: (_: unknown, r: (typeof rows)[number]) => r.kq ? <ChenhLech v={r.kq.coMatCoDinhMuc - r.kq.tongDinhMuc} /> : '-' },
            ],
          },
          {
            title: 'Khai báo', key: 'kb', width: 170,
            render: (_: unknown, r: (typeof rows)[number]) => {
              if (!r.qm) return <Tag color="default">Chưa khai báo</Tag>
              return (
                <Space orientation="vertical" size={0}>
                  <Text style={{ fontSize: 12 }}>{formatDatetime(r.qm.updatedAt)}</Text>
                  {r.cap === 'TIEU_HOC' && r.kq!.tongLop2Buoi === 0 && <Tag color="error" style={{ marginTop: 2 }}>Chưa nhập lớp 2 buổi</Tag>}
                  {r.kq!.chuaPhanMon > 0 && <Tag color="warning" style={{ marginTop: 2 }}>{r.kq!.chuaPhanMon} GV chưa phân môn</Tag>}
                  {r.kq!.phanBoKiem && !r.kq!.phanBoKiem.khop && (
                    <Tag color="error" style={{ marginTop: 2 }}>
                      Kiêm nhiệm {r.kq!.phanBoKiem.conLai > 0 ? `thiếu ${fmt(r.kq!.phanBoKiem.conLai)}` : `vượt ${fmt(-r.kq!.phanBoKiem.conLai)}`}
                    </Tag>
                  )}
                  {r.kq!.phanBoKiem?.khop && r.kq!.phanBoKiem.soMonDieuChinh > 0 && <Tag color="purple" style={{ marginTop: 2 }}>Trường chỉnh kiêm nhiệm {r.kq!.phanBoKiem.soMonDieuChinh} môn</Tag>}
                </Space>
              )
            },
          },
        ]}
        summary={() => daKhai.length > 0 && (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
            <Table.Summary.Cell index={0} colSpan={2}>Toàn phường ({daKhai.length} trường đã khai báo)</Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="center">{tong((k) => k.tongLop)}</Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="center">{tong((k) => k.tongHS).toLocaleString('vi-VN')}</Table.Summary.Cell>
            <Table.Summary.Cell index={4} />
            <Table.Summary.Cell index={5} />
            <Table.Summary.Cell index={6} align="center">{fmt(tong((k) => k.gvDinhMuc))}</Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="center">{tong((k) => k.gvCoMat)}</Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="center"><ChenhLech v={tong((k) => k.gvCoMat - k.gvDinhMuc)} /></Table.Summary.Cell>
            <Table.Summary.Cell index={9} align="center">{fmt(tong((k) => k.tongDinhMuc))}</Table.Summary.Cell>
            <Table.Summary.Cell index={10} align="center">{tong((k) => k.coMatCoDinhMuc)}</Table.Summary.Cell>
            <Table.Summary.Cell index={11} align="center"><ChenhLech v={tong((k) => k.coMatCoDinhMuc - k.tongDinhMuc)} /></Table.Summary.Cell>
            <Table.Summary.Cell index={12} />
          </Table.Summary.Row>
        )}
      />
    </>
  )
}

// ───────────────────────────── Chi tiết một trường ─────────────────────────────

function ChiTietTruong({ donVi, namHoc, onBack }: { donVi: DonVi; namHoc: string; onBack?: () => void }) {
  const { message, modal } = App.useApp()
  const { currentUser, hasPermission, scopeDonViId } = useAuth()
  const cap = donVi.loai as CapHoc
  const id = idQuyMo(donVi.id, namHoc)
  const quyMoDaLuu = useDanhMucStore((s) => s.quyMoTruongs.find((q) => q.id === id))
  const luuQuyMo = useDanhMucStore((s) => s.luuQuyMo)
  const updateDonVi = useDanhMucStore((s) => s.updateDonVi)
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  const cd = useTenChucDanh()
  const nhanSu = useMemo(() => vienChucs.filter((v) => v.donViId === donVi.id), [vienChucs, donVi.id])

  const dungTruong = !scopeDonViId || scopeDonViId === donVi.id
  const coTheSua = hasPermission('quyMo', 'write') && dungTruong
  const coTheSuaMon = hasPermission('vienChuc', 'write') && dungTruong

  const [goc, setGoc] = useState(quyMoDaLuu)
  const [nhap, setNhap] = useState<QuyMoTruong>(() => quyMoDaLuu ?? quyMoTrong(donVi.id, namHoc))
  const daDoi = vanTay(nhap, cap) !== vanTay(quyMoDaLuu, cap)

  // Bản mới từ máy khác: chưa sửa gì thì nạp luôn bản mới
  useEffect(() => {
    if (quyMoDaLuu?.updatedAt === goc?.updatedAt) return
    if (vanTay(nhap, cap) === vanTay(goc, cap)) setNhap(quyMoDaLuu ?? quyMoTrong(donVi.id, namHoc))
    setGoc(quyMoDaLuu)
  }, [quyMoDaLuu])

  const kq = useMemo(() => tinhDinhMuc(cap, nhap, nhanSu, cd.lay), [cap, nhap, nhanSu, cd])
  const hienHanh = namHoc === namHocHienHanh()

  const datKhoi = (ma: string, truong: TruongKhoi, v: number | null) =>
    setNhap((q) => {
      const moi = { ...(q.khoi[ma] ?? { soLop: 0, soHocSinh: 0 }), [truong]: v ?? 0 }
      // Số học 2 buổi không vượt tổng của khối
      if (moi.soLop2Buoi != null && moi.soLop2Buoi > moi.soLop) moi.soLop2Buoi = moi.soLop
      if (moi.soHocSinh2Buoi != null && moi.soHocSinh2Buoi > moi.soHocSinh) moi.soHocSinh2Buoi = moi.soHocSinh
      return { ...q, khoi: { ...q.khoi, [ma]: moi } }
    })

  const datNhapTay = (ma: string, v: number | null) =>
    setNhap((q) => {
      const t = { ...(q.dinhMucNhapTay ?? {}) }
      if (v == null) delete t[ma]
      else t[ma] = v
      return { ...q, dinhMucNhapTay: t }
    })

  // THCS: trường điều chỉnh số giáo viên kiêm nhiệm phân bổ cho một môn; bỏ trống = theo gợi ý
  const datKiem = (ma: string | null, v: number | null) =>
    setNhap((q) => {
      if (ma == null) {
        // Dùng lại toàn bộ gợi ý: bỏ mọi điều chỉnh theo môn
        const t = { ...(q.dinhMucNhapTay ?? {}) }
        for (const m of MON_GIANG_DAY.THCS) if (m.ma !== 'TONG_PHU_TRACH') delete t[m.ma]
        return { ...q, kiemNhiemNhapTay: {}, dinhMucNhapTay: t }
      }
      const k = { ...(q.kiemNhiemNhapTay ?? {}) }
      if (v == null) delete k[ma]
      else k[ma] = v
      // Bản cũ nhập thẳng định mức môn → bỏ để không chồng hai kiểu điều chỉnh
      const t = { ...(q.dinhMucNhapTay ?? {}) }
      delete t[ma]
      return { ...q, kiemNhiemNhapTay: k, dinhMucNhapTay: t }
    })

  const luu = () => {
    if (!currentUser) return
    const { tongLop, tongHS } = tongQuyMo(nhap, cap)
    const hangMoi = getHangTruong(cap, tongLop)
    const hangCu = donVi.soLop ? getHangTruong(cap, donVi.soLop) : undefined
    const capNhatSoLop = hienHanh && tongLop > 0 && tongLop !== donVi.soLop

    const thucHien = () => {
      const khoi: QuyMoTruong['khoi'] = {}
      for (const k of KHOI[cap]) {
        const o = nhap.khoi[k.ma]
        khoi[k.ma] = {
          soLop: o?.soLop ?? 0,
          soHocSinh: o?.soHocSinh ?? 0,
          ...(CO_HAI_BUOI[cap] ? {
            soLop2Buoi: Math.min(o?.soLop2Buoi ?? 0, o?.soLop ?? 0),
            soHocSinh2Buoi: Math.min(o?.soHocSinh2Buoi ?? 0, o?.soHocSinh ?? 0),
          } : {}),
        }
      }
      const nhapTay = nhap.dinhMucNhapTay && Object.keys(nhap.dinhMucNhapTay).length ? nhap.dinhMucNhapTay : undefined
      const kiemTay = cap === 'THCS' && nhap.kiemNhiemNhapTay && Object.keys(nhap.kiemNhiemNhapTay).length ? nhap.kiemNhiemNhapTay : undefined
      const tinThem = cap === 'TIEU_HOC' ? (nhap.khoiDayTinThem ?? []).filter((k) => KHOI_TIN_TU_CHON.includes(k)) : []
      luuQuyMo({
        id, donViId: donVi.id, namHoc, khoi,
        khoiDayTinThem: tinThem.length ? tinThem : undefined,
        dinhMucNhapTay: nhapTay,
        kiemNhiemNhapTay: kiemTay,
        soDiemTruong: cap === 'MAM_NON' ? nhap.soDiemTruong || undefined : undefined,
        ghiChu: nhap.ghiChu?.trim() || undefined,
        nguoiCapNhatId: currentUser.id,
        nguoiCapNhat: currentUser.fullName,
      })
      if (capNhatSoLop) updateDonVi(donVi.id, { soLop: tongLop })
      logAction(currentUser.id, currentUser.fullName, 'UPDATE', 'DanhMuc', {
        entityId: id,
        donViId: donVi.id,
        moTa: `Khai báo quy mô năm học ${namHoc} - ${donVi.ten}: ${tongLop} lớp, ${tongHS} học sinh`
          + (capNhatSoLop ? `; số lớp xếp hạng ${donVi.soLop ?? 'chưa có'} → ${tongLop}` : ''),
      })
      message.success(capNhatSoLop ? 'Đã lưu quy mô và cập nhật số lớp xếp hạng trường' : 'Đã lưu quy mô trường lớp')
    }

    if (capNhatSoLop && hangCu && hangCu !== hangMoi) {
      modal.confirm({
        title: `Hạng trường đổi từ ${HANG_TRUONG_LABELS[hangCu]} sang ${HANG_TRUONG_LABELS[hangMoi]}`,
        content: (
          <div>
            <p>Số lớp xếp hạng của {donVi.ten} đổi từ {donVi.soLop} thành {tongLop}.</p>
            <p style={{ marginBottom: 0 }}>
              Hạng trường là căn cứ phụ cấp chức vụ (TT 33/2005/TT-BGDĐT) và số phó hiệu trưởng.
              Phụ cấp đang hưởng <b>không tự thay đổi</b>; khi chỉnh sửa hồ sơ hiệu trưởng, phó hiệu trưởng,
              hệ thống sẽ đề xuất mức theo hạng mới.
            </p>
          </div>
        ),
        okText: 'Lưu',
        cancelText: 'Hủy',
        onOk: thucHien,
      })
    } else thucHien()
  }

  const items = [
    { key: 'quyMo', label: 'Khai báo quy mô', children: <TheQuyMo cap={cap} nhap={nhap} kq={kq} coTheSua={coTheSua} hienHanh={hienHanh} namHoc={namHoc} donVi={donVi} datKhoi={datKhoi} setNhap={setNhap} /> },
    { key: 'dinhMuc', label: 'Định mức & cơ cấu VTVL', children: <TheDinhMuc kq={kq} nhap={nhap} coTheSua={coTheSua} datNhapTay={datNhapTay} datKiem={datKiem} daDoi={daDoi} /> },
    {
      key: 'phanMon',
      label: <Badge count={kq.chuaPhanMon} size="small" offset={[8, -2]}>Phân công môn giảng dạy</Badge>,
      children: <ThePhanMon cap={cap} nhanSu={nhanSu} kq={kq} coTheSua={coTheSuaMon} donVi={donVi} />,
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Space wrap>
          {onBack && <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Toàn phường</Button>}
          <Text strong style={{ fontSize: 16 }}>{donVi.ten}</Text>
          <Tag>{TEN_CAP[cap]}</Tag>
          {quyMoDaLuu
            ? <Text type="secondary" style={{ fontSize: 12 }}>Cập nhật {formatDatetime(quyMoDaLuu.updatedAt)} - {quyMoDaLuu.nguoiCapNhat}</Text>
            : <Tag color="warning">Chưa khai báo năm học {namHoc}</Tag>}
        </Space>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => xuatExcelTruong(donVi, namHoc, cap, nhap, kq)} disabled={!kq.tongLop}>
            Xuất Excel
          </Button>
          {coTheSua && (
            <>
              {daDoi && <Button icon={<UndoOutlined />} onClick={() => setNhap(quyMoDaLuu ?? quyMoTrong(donVi.id, namHoc))}>Hoàn tác</Button>}
              <Button type="primary" icon={<SaveOutlined />} onClick={luu} disabled={!daDoi || !kq.tongLop}>
                Lưu quy mô
              </Button>
            </>
          )}
        </Space>
      </div>
      {daDoi && <Alert type="warning" showIcon style={{ marginBottom: 8 }} title="Có thay đổi chưa lưu - số liệu định mức đang tính theo bản đang nhập" />}
      <Tabs items={items} />
    </>
  )
}

// ───────────────────────────── Thẻ: Khai báo quy mô ─────────────────────────────

function TheQuyMo({ cap, nhap, kq, coTheSua, hienHanh, namHoc, donVi, datKhoi, setNhap }: {
  cap: CapHoc; nhap: QuyMoTruong; kq: KetQuaDinhMuc; coTheSua: boolean; hienHanh: boolean; namHoc: string; donVi: DonVi
  datKhoi: (ma: string, truong: TruongKhoi, v: number | null) => void
  setNhap: Dispatch<SetStateAction<QuyMoTruong>>
}) {
  const haiBuoi = CO_HAI_BUOI[cap]
  type DongKhoi = { key: string; ten: string; soLop: number; soHocSinh: number; soLop2Buoi: number; soHocSinh2Buoi: number }
  const dongs: DongKhoi[] = KHOI[cap].map((k) => {
    const x = nhap.khoi[k.ma]
    return { key: k.ma, ten: k.ten, soLop: x?.soLop ?? 0, soHocSinh: x?.soHocSinh ?? 0, soLop2Buoi: x?.soLop2Buoi ?? 0, soHocSinh2Buoi: x?.soHocSinh2Buoi ?? 0 }
  })
  const o = (r: DongKhoi, truong: TruongKhoi) => {
    const v = r[truong]
    // Số học 2 buổi không vượt tổng của khối
    const max = truong === 'soLop2Buoi' ? r.soLop : truong === 'soHocSinh2Buoi' ? r.soHocSinh : truong === 'soLop' ? 99 : 9999
    return coTheSua
      ? <InputNumber value={v} min={0} max={max} precision={0} onChange={(x) => datKhoi(r.key, truong, x)} style={{ width: 88 }} />
      : <Text>{v.toLocaleString('vi-VN')}</Text>
  }
  const cot = (title: string, key: TruongKhoi) => ({
    title, key, width: 104, align: 'center' as const, render: (_: unknown, r: DongKhoi) => o(r, key),
  })

  return (
    <Row gutter={[24, 16]}>
      <Col xs={24} xl={haiBuoi ? 16 : 14}>
        <Table
          size="small"
          bordered
          pagination={false}
          dataSource={dongs}
          scroll={{ x: haiBuoi ? 620 : undefined }}
          columns={[
            { title: cap === 'MAM_NON' ? 'Nhóm, lớp' : 'Khối', dataIndex: 'ten', key: 'ten', width: 90 },
            ...(haiBuoi
              ? [
                  { title: 'Tổng số', children: [cot('Số lớp', 'soLop'), cot('Số học sinh', 'soHocSinh')] },
                  { title: 'Trong đó học 2 buổi/ngày', children: [cot('Số lớp', 'soLop2Buoi'), cot('Số học sinh', 'soHocSinh2Buoi')] },
                ]
              : [cot('Số nhóm, lớp', 'soLop'), cot('Số trẻ', 'soHocSinh')]),
            { title: 'Bình quân/lớp', key: 'bq', width: 90, align: 'center' as const, render: (_: unknown, r: DongKhoi) => r.soLop ? fmt(r.soHocSinh / r.soLop) : '-' },
          ]}
          summary={() => (
            <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
              <Table.Summary.Cell index={0}>Tổng</Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="center">{kq.tongLop}</Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="center">{kq.tongHS.toLocaleString('vi-VN')}</Table.Summary.Cell>
              {haiBuoi && <Table.Summary.Cell index={3} align="center">{kq.tongLop2Buoi}</Table.Summary.Cell>}
              {haiBuoi && <Table.Summary.Cell index={4} align="center">{kq.tongHS2Buoi.toLocaleString('vi-VN')}</Table.Summary.Cell>}
              <Table.Summary.Cell index={haiBuoi ? 5 : 3} align="center">{kq.tongLop ? fmt(kq.binhQuan) : '-'}</Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
        {haiBuoi && kq.tongLop > 0 && (
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Học 1 buổi/ngày: {kq.tongLop - kq.tongLop2Buoi} lớp, {(kq.tongHS - kq.tongHS2Buoi).toLocaleString('vi-VN')} học sinh.
            {cap === 'TIEU_HOC' && ' Định mức giáo viên: lớp 1 buổi 1,2 GV/lớp, lớp 2 buổi 1,5 GV/lớp.'}
          </Text>
        )}
        {cap === 'TIEU_HOC' && kq.tongLop > 0 && kq.tongLop2Buoi === 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 8 }}
            title="Chưa nhập số lớp học 2 buổi/ngày - định mức đang tính toàn bộ là lớp 1 buổi (1,2 giáo viên/lớp)"
          />
        )}
        {cap === 'MAM_NON' && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text>Số phân hiệu (điểm trường):</Text>
            {coTheSua
              ? <InputNumber value={nhap.soDiemTruong} min={1} max={20} precision={0} placeholder="1" onChange={(v) => setNhap((q) => ({ ...q, soDiemTruong: v ?? undefined }))} style={{ width: 88 }} />
              : <Text strong>{nhap.soDiemTruong ?? 1}</Text>}
            <Text type="secondary" style={{ fontSize: 12 }}>
              Căn cứ chỉ tiêu nhân viên thư viện: 01 người/phân hiệu, tối đa 03. Để trống tính là 01.
            </Text>
          </div>
        )}
        {cap === 'TIEU_HOC' && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text>Trường có dạy Tin học ở:</Text>
            <Checkbox.Group
              disabled={!coTheSua}
              value={nhap.khoiDayTinThem ?? []}
              onChange={(v) => setNhap((q) => ({ ...q, khoiDayTinThem: v as string[] }))}
              options={KHOI_TIN_TU_CHON.map((k) => ({ value: k, label: `Khối ${k.slice(1)}` }))}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Khối 3-5 bắt buộc theo chương trình GDPT 2018; khối 1, 2 tính thêm 1 tiết/tuần nếu trường có dạy.
            </Text>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Text strong>Ghi chú, căn cứ số liệu</Text>
          {coTheSua
            ? <Input.TextArea rows={2} value={nhap.ghiChu} onChange={(e) => setNhap((q) => ({ ...q, ghiChu: e.target.value }))} placeholder="VD: Theo kế hoạch tuyển sinh năm học 2026-2027 đã được phê duyệt" style={{ marginTop: 6 }} />
            : <div style={{ marginTop: 4 }}><Text type="secondary">{nhap.ghiChu || '-'}</Text></div>}
        </div>
      </Col>
      <Col xs={24} xl={haiBuoi ? 8 : 10}>
        <Row gutter={[12, 12]}>
          <Col span={12}><Card size="small"><Statistic title="Tổng số lớp" value={kq.tongLop} /></Card></Col>
          <Col span={12}><Card size="small"><Statistic title={cap === 'MAM_NON' ? 'Tổng số trẻ' : 'Tổng học sinh'} value={kq.tongHS} groupSeparator="." /></Card></Col>
          <Col span={12}><Card size="small"><Statistic title="Bình quân/lớp" value={kq.tongLop ? lamTron1(kq.binhQuan) : 0} precision={1} decimalSeparator="," /></Card></Col>
          <Col span={12}><Card size="small"><Statistic title="Hạng trường" value={kq.tongLop ? HANG_TRUONG_LABELS[kq.hang] : '-'} /></Card></Col>
        </Row>
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          title="Căn cứ xếp hạng trường"
          description={
            <div style={{ fontSize: 13 }}>
              <div>{NGUONG_HANG[cap]} (TT 19/2023, TT 20/2023). Hạng trường quyết định số phó hiệu trưởng và phụ cấp chức vụ (TT 33/2005).</div>
              <div style={{ marginTop: 6 }}>
                {hienHanh
                  ? <>Đây là năm học hiện hành: khi lưu, tổng số lớp sẽ thành số lớp xếp hạng của trường (hiện ghi {donVi.soLop ?? 'chưa có'} lớp - {donVi.soLop ? HANG_TRUONG_LABELS[getHangTruong(cap, donVi.soLop)] : 'chưa xếp hạng'}).</>
                  : <>Năm học {namHoc} chỉ dùng để tính định mức, không thay đổi hạng trường hiện tại.</>}
              </div>
            </div>
          }
        />
      </Col>
    </Row>
  )
}

// ───────────────────────────── Thẻ: Định mức & cơ cấu ─────────────────────────────

type DongBang =
  | (DongDinhMuc & { key: string; loai: 'dong'; stt: number })
  | { key: string; loai: 'nhom'; ten: string }
  | (TongNhom & { key: string; loai: 'tong' })

const SO_LA_MA = ['I', 'II', 'III', 'IV']

function TheDinhMuc({ kq, nhap, coTheSua, datNhapTay, datKiem, daDoi }: {
  kq: KetQuaDinhMuc; nhap: QuyMoTruong; coTheSua: boolean; datNhapTay: (ma: string, v: number | null) => void
  datKiem: (ma: string | null, v: number | null) => void; daDoi: boolean
}) {
  if (!kq.tongLop) {
    return <Empty description={`Chưa có số lớp - khai báo quy mô ở thẻ "Khai báo quy mô" để tính định mức`} />
  }

  const data: DongBang[] = []
  for (const n of NHOM_DINH_MUC) {
    const ds = kq.dong.filter((d) => d.nhom === n.key)
    if (!ds.length) continue
    data.push({ key: `nhom-${n.key}`, loai: 'nhom', ten: n.ten })
    ds.forEach((d, i) => data.push({ ...d, key: d.ma, loai: 'dong', stt: i + 1 }))
    const t = kq.tongNhom.find((x) => x.nhom === n.key)
    if (t) data.push({ ...t, key: `tong-${n.key}`, loai: 'tong' })
  }

  const SO_COT = 10
  const an = (r: DongBang) => (r.loai === 'nhom' ? { colSpan: 0 } : {})
  const laDong = (r: DongBang): r is Extract<DongBang, { loai: 'dong' }> => r.loai === 'dong'
  const laTong = (r: DongBang): r is Extract<DongBang, { loai: 'tong' }> => r.loai === 'tong'
  const soNhom = (nhom: string) => SO_LA_MA[NHOM_DINH_MUC.findIndex((n) => n.key === nhom)] ?? ''
  const tt = kq.toanTruong
  const nhomIV = kq.tongNhom.find((t) => !t.apDungDinhMuc)
  const ngoai = kq.tongNhom.reduce((s, t) => s + t.coMatNgoai, 0)

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title={`Định mức giáo viên: ${fmt(kq.gvDinhMuc)} - có mặt ${kq.gvCoMat}`}
        description={<ul style={{ margin: 0, paddingLeft: 18 }}>{kq.dienGiai.map((s) => <li key={s}>{s}</li>)}</ul>}
      />
      {kq.cap === 'TIEU_HOC' && kq.tongLop2Buoi === 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title="Chưa nhập số lớp học 2 buổi/ngày - định mức giáo viên đang tính toàn bộ là lớp 1 buổi (1,2 GV/lớp), thấp hơn thực tế"
          description='Nhập cột "Trong đó học 2 buổi/ngày" ở thẻ "Khai báo quy mô" (lớp 2 buổi tính 1,5 GV/lớp).'
        />
      )}
      {kq.chuaPhanMon > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={`${kq.chuaPhanMon} giáo viên chưa phân công môn - chưa đối chiếu được định mức theo từng môn`} description='Vào thẻ "Phân công môn giảng dạy" để gán môn (có nút gợi ý tự động theo nhiệm vụ chính).' />
      )}
      {kq.phanBoKiem && <BangPhanBoKiem kq={kq} coTheSua={coTheSua} datKiem={datKiem} />}
      <Table<DongBang>
        size="small"
        bordered
        pagination={false}
        dataSource={data}
        scroll={{ x: 1100 }}
        rowClassName={(r) => (r.loai === 'nhom' ? 'dm-nhom' : r.loai === 'tong' ? 'dm-tong' : '')}
        columns={[
          {
            title: 'STT', key: 'stt', width: 50, align: 'center',
            onCell: (r) => (r.loai === 'nhom' ? { colSpan: SO_COT, style: { textAlign: 'left' } } : r.loai === 'tong' ? { colSpan: 2 } : {}),
            render: (_, r) => (r.loai === 'nhom'
              ? <Text strong style={{ color: '#1e3a8a' }}>{r.ten}</Text>
              : r.loai === 'tong' ? <Text strong>Cộng nhóm {soNhom(r.nhom)}</Text> : r.stt),
          },
          {
            title: 'Vị trí việc làm', key: 'ten', width: 250, onCell: (r) => (r.loai === 'nhom' || r.loai === 'tong' ? { colSpan: 0 } : {}),
            render: (_, r) => laDong(r) && (r.dongPhu ? <Text type="warning">{r.ten}</Text> : r.ten),
          },
          {
            title: 'Căn cứ tính', key: 'cc', width: 260, onCell: an,
            render: (_, r) => {
              if (laTong(r)) {
                if (!r.apDungDinhMuc) return <Text type="secondary" style={{ fontSize: 12 }}>Không so sánh định mức</Text>
                return r.coMatNgoai > 0
                  ? <Text type="secondary" style={{ fontSize: 12 }}>{r.coMatNgoai} người ở vị trí chưa có định mức - không đưa vào so sánh</Text>
                  : null
              }
              return laDong(r) && <Text type="secondary" style={{ fontSize: 12 }}>{r.canCu}</Text>
            },
          },
          {
            title: 'Định mức theo quy định', key: 'dmt', width: 95, align: 'center', onCell: an,
            render: (_, r) => {
              if (laTong(r)) return r.apDungDinhMuc ? <Text strong>{fmt(r.dinhMucTinh)}</Text> : null
              return laDong(r) && (r.nhom === 'PHUC_VU' ? <Text type="secondary" style={{ fontSize: 12 }}>Không áp dụng</Text> : fmt(r.dinhMucTinh))
            },
          },
          {
            title: <Tooltip title="Trường nhập khi có căn cứ riêng (VD điểm trường lẻ, học sinh khuyết tật). Để trống thì dùng định mức theo quy định.">Điều chỉnh</Tooltip>,
            key: 'tay', width: 100, align: 'center', onCell: an,
            render: (_, r) => {
              if (!laDong(r) || r.nhom === 'PHUC_VU' || r.dongPhu) return null
              if (r.phanBoKiem) {
                const k = kq.phanBoKiem?.dong.find((d) => d.ma === r.ma)
                return (
                  <Tooltip title='Môn THCS điều chỉnh ở bảng "Phân bổ giáo viên kiêm nhiệm" phía trên'>
                    <Text type="secondary" style={{ fontSize: 12 }}>{k?.nhapTay != null ? `KN ${fmt(k.nhapTay)}` : 'Theo phân bổ'}</Text>
                  </Tooltip>
                )
              }
              if (!coTheSua) return r.dinhMucNhapTay != null ? fmt(r.dinhMucNhapTay) : ''
              return (
                <InputNumber
                  size="small"
                  value={nhap.dinhMucNhapTay?.[r.ma]}
                  min={0}
                  max={r.toiDa ?? 200}
                  step={1}
                  precision={1}
                  placeholder="-"
                  onChange={(v) => datNhapTay(r.ma, v)}
                  style={{ width: 80 }}
                />
              )
            },
          },
          {
            title: 'Định mức áp dụng', key: 'dm', width: 90, align: 'center', onCell: an,
            render: (_, r) => laTong(r) ? (r.apDungDinhMuc ? <Text strong>{fmt(r.dinhMuc)}</Text> : null) : laDong(r) && r.nhom !== 'PHUC_VU' && (
              <Text strong>{fmt(r.dinhMuc)}{(r.dinhMucNhapTay != null || (r.phanBoKiem && kq.phanBoKiem?.dong.find((d) => d.ma === r.ma)?.nhapTay != null)) && <Tag color="purple" style={{ marginInlineStart: 4, fontSize: 10, lineHeight: '14px', padding: '0 3px' }}>tay</Tag>}</Text>
            ),
          },
          {
            title: 'Có mặt',
            children: [
              { title: 'Viên chức', key: 'vc', width: 75, align: 'center', onCell: an, render: (_, r) => laTong(r) ? <Text strong>{r.coMatVC}</Text> : laDong(r) && (r.coMatVC || '') },
              { title: 'Hợp đồng', key: 'hd', width: 75, align: 'center', onCell: an, render: (_, r) => laTong(r) ? <Text strong>{r.coMatHD}</Text> : laDong(r) && (r.coMatHD || '') },
              { title: 'Tổng', key: 'cm', width: 65, align: 'center', onCell: an, render: (_, r) => (laTong(r) || laDong(r)) && <Text strong>{r.coMat}</Text> },
            ],
          },
          {
            title: 'Thừa (+) / Thiếu (−)', key: 'cl', width: 95, align: 'center', onCell: an,
            render: (_, r) => (laTong(r) || laDong(r)) && (r.nhom === 'PHUC_VU' ? null : <ChenhLech v={r.chenhLech} />),
          },
        ]}
        summary={() => (
          <>
            <Table.Summary.Row style={{ background: '#e0e7ff', fontWeight: 600 }}>
              <Table.Summary.Cell index={0} colSpan={2}>Tổng toàn trường - nhóm I-III (so với định mức)</Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  {kq.tongNhom.filter((t) => t.apDungDinhMuc).map((t) => `Nhóm ${soNhom(t.nhom)}: ${fmt(t.dinhMuc)}`).join(' + ')}
                  {ngoai > 0 && `; ${ngoai} người ở vị trí chưa có định mức không đưa vào so sánh`}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="center">{fmt(kq.tongNhom.filter((t) => t.apDungDinhMuc).reduce((s, t) => s + t.dinhMucTinh, 0))}</Table.Summary.Cell>
              <Table.Summary.Cell index={4} />
              <Table.Summary.Cell index={5} align="center">{fmt(kq.tongDinhMuc)}</Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="center">{kq.tongNhom.filter((t) => t.apDungDinhMuc).reduce((s, t) => s + t.coMatVC, 0)}</Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="center">{kq.tongNhom.filter((t) => t.apDungDinhMuc).reduce((s, t) => s + t.coMatHD, 0)}</Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="center">{kq.tongNhom.filter((t) => t.apDungDinhMuc).reduce((s, t) => s + t.coMat, 0)}</Table.Summary.Cell>
              <Table.Summary.Cell index={9} align="center"><ChenhLech v={kq.coMatCoDinhMuc - kq.tongDinhMuc} /></Table.Summary.Cell>
            </Table.Summary.Row>
            <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
              <Table.Summary.Cell index={0} colSpan={2}>Tổng lao động toàn trường (I-IV)</Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                  {nhomIV ? `Gồm ${nhomIV.coMat} người nhóm IV (không tính định mức)` : ''}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} colSpan={3} />
              <Table.Summary.Cell index={6} align="center">{tt.coMatVC}</Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="center">{tt.coMatHD}</Table.Summary.Cell>
              <Table.Summary.Cell index={8} align="center">{tt.coMat}</Table.Summary.Cell>
              <Table.Summary.Cell index={9} />
            </Table.Summary.Row>
          </>
        )}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        Có mặt đếm theo hồ sơ đang công tác tại trường: cán bộ quản lý theo chức vụ, giáo viên theo môn được phân công,
        nhân viên theo "Công việc cụ thể". Viên chức gồm biên chế và tập sự; còn lại tính là hợp đồng.
        {daDoi && ' Số liệu đang tính theo bản chưa lưu.'}
      </Text>
      <style>{'.dm-nhom > td { background: #eff6ff !important; } .dm-tong > td { background: #f1f5f9 !important; border-bottom: 2px solid #cbd5e1 !important; }'}</style>
    </>
  )
}

// ───────────────────────────── THCS: phân bổ giáo viên kiêm nhiệm ─────────────────────────────

function TrangThaiPhanBo({ conLai }: { conLai: number }) {
  if (Math.abs(conLai) < 0.05) return <Tag color="success" style={{ marginInlineEnd: 0 }}>Khớp tổng</Tag>
  return conLai > 0
    ? <Tag color="error" style={{ marginInlineEnd: 0 }}>Còn thiếu {fmt(conLai)}</Tag>
    : <Tag color="error" style={{ marginInlineEnd: 0 }}>Vượt {fmt(-conLai)}</Tag>
}

function BangPhanBoKiem({ kq, coTheSua, datKiem }: {
  kq: KetQuaDinhMuc; coTheSua: boolean; datKiem: (ma: string | null, v: number | null) => void
}) {
  const pb = kq.phanBoKiem!
  const coMat = (ma: string) => kq.dong.find((d) => d.ma === ma)?.coMat ?? 0
  const tongDungLop = pb.dong.reduce((s, d) => s + d.dungLop, 0)
  const tongMon = pb.dong.reduce((s, d) => s + d.dinhMuc, 0)
  const tongCoMat = pb.dong.reduce((s, d) => s + coMat(d.ma), 0)
  const tatCaDaChinh = pb.soMonDieuChinh === pb.dong.length

  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      title={<Space wrap><span>Phân bổ giáo viên kiêm nhiệm theo môn</span><TrangThaiPhanBo conLai={pb.conLai} /></Space>}
      extra={coTheSua && pb.soMonDieuChinh > 0 && (
        <Button size="small" icon={<UndoOutlined />} onClick={() => datKiem(null, null)}>Dùng toàn bộ gợi ý</Button>
      )}
    >
      <Row gutter={[16, 8]} style={{ marginBottom: 8 }}>
        <Col xs={12} md={5}><Statistic title="Cần phân bổ" value={fmt(pb.tong)} styles={{ content: { fontSize: 20 } }} /></Col>
        <Col xs={12} md={5}><Statistic title="Đã phân bổ" value={fmt(pb.daPhanBo)} styles={{ content: { fontSize: 20, color: pb.khop ? '#16a34a' : '#dc2626' } }} /></Col>
        <Col xs={24} md={14}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Cần phân bổ = định mức giáo viên − đứng lớp các môn ({fmt(tongDungLop)}) − Tổng phụ trách (1), gồm:
            dạy kiêm GDĐP, HĐTN-HN {fmt(pb.kiemDay)}; chủ nhiệm {fmt(pb.chuNhiem)}; kiêm nhiệm khác {fmt(pb.khac)}.
            Hệ thống gợi ý chia theo tỷ lệ giờ đứng lớp; môn trường để trống tự nhận phần còn lại theo cùng tỷ lệ.
          </Text>
        </Col>
      </Row>
      {!pb.khop && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 8 }}
          title={pb.conLai > 0
            ? `Tổng phân bổ còn thiếu ${fmt(pb.conLai)} giáo viên so với số cần phân bổ`
            : `Tổng phân bổ vượt ${fmt(-pb.conLai)} giáo viên so với số cần phân bổ`}
          description={tatCaDaChinh
            ? 'Trường đã điều chỉnh tất cả các môn - sửa lại cho khớp, hoặc để trống một số môn để hệ thống tự cân đối phần còn lại.'
            : 'Số trường điều chỉnh đã vượt tổng cần phân bổ - giảm số ở các môn đã điều chỉnh.'}
        />
      )}
      <Table<DongPhanBoKiem>
        size="small"
        bordered
        pagination={false}
        rowKey="ma"
        dataSource={pb.dong}
        scroll={{ x: 820 }}
        columns={[
          { title: 'Môn', dataIndex: 'ten', key: 'ten', width: 110 },
          { title: 'Tiết/tuần', key: 'tiet', width: 75, align: 'center', render: (_, d) => fmt(d.tietTuan) },
          { title: 'Đứng lớp', key: 'dl', width: 80, align: 'center', render: (_, d) => fmt(d.dungLop) },
          {
            title: 'Giáo viên kiêm nhiệm',
            children: [
              { title: 'Gợi ý', key: 'gy', width: 70, align: 'center', render: (_, d) => <Text type="secondary">{fmt(d.goiY)}</Text> },
              {
                title: <Tooltip title="Để trống thì hệ thống tự chia phần còn lại">Trường điều chỉnh</Tooltip>,
                key: 'tay', width: 110, align: 'center',
                render: (_, d) => coTheSua
                  ? (
                    <InputNumber
                      size="small"
                      value={d.nhapTay}
                      min={0}
                      max={50}
                      step={0.5}
                      precision={1}
                      placeholder={fmt(d.goiY)}
                      onChange={(v) => datKiem(d.ma, v)}
                      style={{ width: 80 }}
                    />
                  )
                  : (d.nhapTay != null ? fmt(d.nhapTay) : ''),
              },
              {
                title: 'Áp dụng', key: 'ad', width: 75, align: 'center',
                render: (_, d) => <Text strong={d.nhapTay != null}>{fmt(d.apDung)}</Text>,
              },
            ],
          },
          { title: 'Định mức môn', key: 'dm', width: 85, align: 'center', render: (_, d) => <Text strong>{fmt(d.dinhMuc)}</Text> },
          { title: 'Có mặt', key: 'cm', width: 65, align: 'center', render: (_, d) => coMat(d.ma) },
          { title: 'Thừa/thiếu', key: 'cl', width: 85, align: 'center', render: (_, d) => <ChenhLech v={coMat(d.ma) - d.dinhMuc} /> },
        ]}
        summary={() => (
          <Table.Summary.Row style={{ background: '#f8fafc', fontWeight: 600 }}>
            <Table.Summary.Cell index={0}>Tổng</Table.Summary.Cell>
            <Table.Summary.Cell index={1} align="center">{fmt(pb.dong.reduce((s, d) => s + d.tietTuan, 0))}</Table.Summary.Cell>
            <Table.Summary.Cell index={2} align="center">{fmt(tongDungLop)}</Table.Summary.Cell>
            <Table.Summary.Cell index={3} align="center">{fmt(pb.tong)}</Table.Summary.Cell>
            <Table.Summary.Cell index={4} align="center">{pb.soMonDieuChinh ? `${pb.soMonDieuChinh} môn` : ''}</Table.Summary.Cell>
            <Table.Summary.Cell index={5} align="center"><Space size={4} wrap>{fmt(pb.daPhanBo)}<TrangThaiPhanBo conLai={pb.conLai} /></Space></Table.Summary.Cell>
            <Table.Summary.Cell index={6} align="center">{fmt(tongMon)}</Table.Summary.Cell>
            <Table.Summary.Cell index={7} align="center">{tongCoMat}</Table.Summary.Cell>
            <Table.Summary.Cell index={8} align="center"><ChenhLech v={tongCoMat - tongMon} /></Table.Summary.Cell>
          </Table.Summary.Row>
        )}
      />
      <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
        Đối chiếu: định mức các môn {fmt(tongMon)} + Tổng phụ trách 1 = {fmt(tongMon + 1)}; định mức giáo viên toàn trường {fmt(kq.gvDinhMuc)}.
      </Text>
    </Card>
  )
}

// ───────────────────────────── Thẻ: Phân công môn giảng dạy ─────────────────────────────

function ThePhanMon({ cap, nhanSu, kq, coTheSua, donVi }: {
  cap: CapHoc; nhanSu: VienChuc[]; kq: KetQuaDinhMuc; coTheSua: boolean; donVi: DonVi
}) {
  const { message, modal } = App.useApp()
  const { currentUser } = useAuth()
  const updateVienChuc = useVienChucStore((s) => s.updateVienChuc)
  const capNhatNhieu = useVienChucStore((s) => s.capNhatNhieu)
  const cd = useTenChucDanh()
  const [tim, setTim] = useState('')
  const [loc, setLoc] = useState<'tat-ca' | 'chua'>('tat-ca')

  const dsMon = MON_GIANG_DAY[cap]
  const hopLe = (ma?: string) => !!ma && dsMon.some((m) => m.ma === ma)

  const giaoViens = useMemo(
    () => nhanSu
      .filter((v) => duocTinhSoLieu(v) && nhomNguoi(v, cd.lay(v.chucDanhId)?.nhom) === 'GIAO_VIEN')
      .sort((a, b) => a.ten.localeCompare(b.ten, 'vi') || a.ho.localeCompare(b.ho, 'vi')),
    [nhanSu, cd],
  )

  if (cap === 'MAM_NON') {
    return <Alert type="info" showIcon title="Giáo viên mầm non không phân môn" description="Định mức giáo viên mầm non tính chung theo số nhóm trẻ, lớp mẫu giáo (TT 19/2023/TT-BGDĐT)." />
  }

  const chuaPhan = giaoViens.filter((v) => !hopLe(v.monDay))
  const goiY = chuaPhan.map((v) => ({ v, ma: goiYMonDay(v, cap) })).filter((x): x is { v: VienChuc; ma: string } => !!x.ma)
  const q = tim.trim().toLowerCase()
  const hienThi = giaoViens
    .filter((v) => loc === 'tat-ca' || !hopLe(v.monDay))
    .filter((v) => !q || `${v.ho} ${v.ten} ${v.nhiemVuChinh ?? ''} ${v.trinhDoChuyenMon ?? ''}`.toLowerCase().includes(q))

  const apDungGoiY = () => {
    if (!currentUser || !goiY.length) return
    const demMon = new Map<string, number>()
    for (const g of goiY) demMon.set(g.ma, (demMon.get(g.ma) ?? 0) + 1)
    modal.confirm({
      title: `Điền môn gợi ý cho ${goiY.length} giáo viên chưa phân công?`,
      width: 520,
      content: (
        <div>
          <p>Gợi ý dựa trên "Nhiệm vụ chính", nếu trống thì theo "Trình độ chuyên môn". Kiểm tra lại sau khi điền.</p>
          <Space wrap size={[6, 6]}>
            {[...demMon].map(([ma, n]) => <Tag key={ma}>{tenMonDay(ma)}: {n}</Tag>)}
          </Space>
          {chuaPhan.length > goiY.length && (
            <p style={{ marginTop: 10, marginBottom: 0 }}>
              <Text type="secondary">{chuaPhan.length - goiY.length} giáo viên không đủ thông tin để gợi ý - cần chọn tay.</Text>
            </p>
          )}
        </div>
      ),
      okText: 'Điền gợi ý',
      cancelText: 'Hủy',
      onOk: () => {
        capNhatNhieu(
          goiY.map((g) => ({ id: g.v.id, patch: { monDay: g.ma } })),
          currentUser.id,
          currentUser.fullName,
          `Phân công môn giảng dạy theo gợi ý cho ${goiY.length} giáo viên - ${donVi.ten}`,
          donVi.id,
        )
        message.success(`Đã điền môn cho ${goiY.length} giáo viên`)
      },
    })
  }

  const gvDong = kq.dong.filter((d) => d.laGiaoVien && !d.dongPhu)

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
          Đã phân công {giaoViens.length - chuaPhan.length}/{giaoViens.length} giáo viên. Có mặt / định mức theo môn:
        </Text>
        <Space wrap size={[6, 6]}>
          {gvDong.map((d) => {
            const cl = d.chenhLech == null ? 0 : lamTron1(d.chenhLech)
            return (
              <Tag key={d.ma} color={cl < 0 ? 'error' : cl > 0 ? 'warning' : 'success'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {tenMonDay(d.ma) ?? d.ten}: {d.coMat} / {fmt(d.dinhMuc)}
              </Tag>
            )
          })}
        </Space>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Input prefix={<SearchOutlined />} placeholder="Tìm tên, nhiệm vụ, trình độ" allowClear value={tim} onChange={(e) => setTim(e.target.value)} style={{ width: 260 }} />
        <Segmented
          value={loc}
          onChange={(v) => setLoc(v as 'tat-ca' | 'chua')}
          options={[{ value: 'tat-ca', label: `Tất cả (${giaoViens.length})` }, { value: 'chua', label: `Chưa phân công (${chuaPhan.length})` }]}
        />
        {coTheSua && goiY.length > 0 && (
          <Button icon={<BulbOutlined />} onClick={apDungGoiY}>Gợi ý môn cho {goiY.length} giáo viên</Button>
        )}
      </div>
      <Table
        size="small"
        rowKey="id"
        dataSource={hienThi}
        pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
        scroll={{ x: 900 }}
        columns={[
          { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: unknown, __: VienChuc, i: number) => i + 1 },
          { title: 'Họ và tên', key: 'ten', width: 200, render: (_: unknown, v: VienChuc) => `${v.ho} ${v.ten}` },
          { title: 'Mã ngạch', key: 'ngach', width: 100, render: (_: unknown, v: VienChuc) => <Text type="secondary" style={{ fontSize: 12 }}>{cd.ma(v.chucDanhId) ?? '-'}</Text> },
          { title: 'Nhiệm vụ chính', dataIndex: 'nhiemVuChinh', key: 'nv', width: 180, ellipsis: true },
          { title: 'Trình độ chuyên môn', dataIndex: 'trinhDoChuyenMon', key: 'td', width: 180, ellipsis: true },
          {
            title: 'Môn giảng dạy', key: 'mon', width: 200,
            render: (_: unknown, v: VienChuc) => {
              const goiYMon = !hopLe(v.monDay) ? goiYMonDay(v, cap) : undefined
              if (!coTheSua) return hopLe(v.monDay) ? tenMonDay(v.monDay) : <Tag color="warning">Chưa phân công</Tag>
              return (
                <Space size={4}>
                  <Select
                    size="small"
                    value={hopLe(v.monDay) ? v.monDay : undefined}
                    placeholder="Chọn môn"
                    allowClear
                    style={{ width: 130 }}
                    status={hopLe(v.monDay) ? undefined : 'warning'}
                    options={dsMon.map((m) => ({ value: m.ma, label: m.ten }))}
                    onChange={(ma?: string) => currentUser && updateVienChuc(v.id, { monDay: ma }, currentUser.id, currentUser.fullName)}
                  />
                  {goiYMon && (
                    <Tooltip title="Áp dụng môn gợi ý">
                      <Tag color="blue" style={{ cursor: 'pointer', marginInlineEnd: 0 }} onClick={() => currentUser && updateVienChuc(v.id, { monDay: goiYMon }, currentUser.id, currentUser.fullName)}>
                        {tenMonDay(goiYMon)}?
                      </Tag>
                    </Tooltip>
                  )}
                </Space>
              )
            },
          },
        ]}
      />
    </>
  )
}

// ───────────────────────────── Xuất Excel một trường ─────────────────────────────

function xuatExcelTruong(donVi: DonVi, namHoc: string, cap: CapHoc, nhap: QuyMoTruong, kq: KetQuaDinhMuc) {
  const so = (n: number | null) => (n == null ? '' : lamTron1(n))
  const aoa: (string | number)[][] = [
    ['UBND PHƯỜNG GIA VIÊN'],
    [donVi.ten.toUpperCase()],
    [],
    [`ĐỊNH MỨC VIÊN CHỨC VÀ CƠ CẤU VỊ TRÍ VIỆC LÀM NĂM HỌC ${namHoc}`],
    [cap === 'MAM_NON' ? 'Căn cứ Thông tư 19/2023/TT-BGDĐT' : 'Căn cứ Thông tư 20/2023/TT-BGDĐT'],
    [],
    ['I. QUY MÔ TRƯỜNG LỚP'],
  ]
  const haiBuoi = CO_HAI_BUOI[cap]
  aoa.push(haiBuoi
    ? ['Khối', 'Số lớp', 'Số học sinh', 'Số lớp học 2 buổi/ngày', 'Số HS học 2 buổi/ngày', 'Bình quân/lớp']
    : ['Nhóm, lớp', 'Số lớp', 'Số trẻ', 'Bình quân/lớp'])
  for (const k of KHOI[cap]) {
    const o = nhap.khoi[k.ma]
    const lop = o?.soLop ?? 0
    const hs = o?.soHocSinh ?? 0
    const bq = lop ? lamTron1(hs / lop) : ''
    aoa.push(haiBuoi
      ? [k.ten, lop, hs, Math.min(o?.soLop2Buoi ?? 0, lop), Math.min(o?.soHocSinh2Buoi ?? 0, hs), bq]
      : [k.ten, lop, hs, bq])
  }
  aoa.push(haiBuoi
    ? ['Tổng', kq.tongLop, kq.tongHS, kq.tongLop2Buoi, kq.tongHS2Buoi, lamTron1(kq.binhQuan)]
    : ['Tổng', kq.tongLop, kq.tongHS, lamTron1(kq.binhQuan)])
  if (cap === 'TIEU_HOC') {
    const tin = (nhap.khoiDayTinThem ?? []).map((k) => k.slice(1)).sort()
    aoa.push(['Khối dạy Tin học', tin.length ? `${tin.join(', ')}, 3, 4, 5` : '3, 4, 5'])
  }
  aoa.push(['Hạng trường', HANG_TRUONG_LABELS[kq.hang]], [], ['II. CÁCH TÍNH ĐỊNH MỨC GIÁO VIÊN'], ...kq.dienGiai.map((s) => [s]), [])
  if (kq.phanBoKiem) {
    const pb = kq.phanBoKiem
    aoa.push(['PHÂN BỔ GIÁO VIÊN KIÊM NHIỆM THEO MÔN'])
    aoa.push(['Môn', 'Tiết/tuần', 'Đứng lớp', 'Kiêm nhiệm gợi ý', 'Trường điều chỉnh', 'Kiêm nhiệm áp dụng', 'Định mức môn'])
    for (const d of pb.dong) aoa.push([d.ten, lamTron1(d.tietTuan), lamTron1(d.dungLop), lamTron1(d.goiY), d.nhapTay != null ? lamTron1(d.nhapTay) : '', lamTron1(d.apDung), lamTron1(d.dinhMuc)])
    aoa.push(['Tổng', '', lamTron1(pb.dong.reduce((s, d) => s + d.dungLop, 0)), lamTron1(pb.tong), '', lamTron1(pb.daPhanBo), lamTron1(pb.dong.reduce((s, d) => s + d.dinhMuc, 0))])
    aoa.push([pb.khop ? 'Tổng phân bổ khớp số cần phân bổ' : `Tổng phân bổ ${pb.conLai > 0 ? 'còn thiếu' : 'vượt'} ${lamTron1(Math.abs(pb.conLai))} giáo viên`], [])
  }
  aoa.push(['III. ĐỊNH MỨC VIÊN CHỨC VÀ CƠ CẤU THEO VỊ TRÍ VIỆC LÀM'])
  aoa.push(['STT', 'Vị trí việc làm', 'Căn cứ tính', 'Định mức', 'Có mặt - Viên chức', 'Có mặt - Hợp đồng', 'Có mặt - Tổng', 'Thừa (+)/Thiếu (-)'])
  for (const n of NHOM_DINH_MUC) {
    const ds = kq.dong.filter((d) => d.nhom === n.key)
    if (!ds.length) continue
    aoa.push(['', n.ten])
    ds.forEach((d, i) => aoa.push([
      i + 1, d.ten, d.canCu, d.nhom === 'PHUC_VU' ? 'Không áp dụng' : so(d.dinhMuc),
      d.coMatVC, d.coMatHD, d.coMat, d.nhom === 'PHUC_VU' ? '' : so(d.chenhLech),
    ]))
    const t = kq.tongNhom.find((x) => x.nhom === n.key)
    if (t) {
      aoa.push([
        '', `Cộng nhóm ${SO_LA_MA[NHOM_DINH_MUC.indexOf(n)]}`,
        !t.apDungDinhMuc ? 'Không so sánh định mức' : t.coMatNgoai ? `${t.coMatNgoai} người ở vị trí chưa có định mức - không so sánh` : '',
        t.apDungDinhMuc ? lamTron1(t.dinhMuc) : '', t.coMatVC, t.coMatHD, t.coMat, t.chenhLech == null ? '' : lamTron1(t.chenhLech),
      ])
    }
  }
  const coDm = kq.tongNhom.filter((t) => t.apDungDinhMuc)
  aoa.push(['', 'Tổng toàn trường - nhóm I-III (so với định mức)', '', lamTron1(kq.tongDinhMuc),
    coDm.reduce((s, t) => s + t.coMatVC, 0), coDm.reduce((s, t) => s + t.coMatHD, 0), coDm.reduce((s, t) => s + t.coMat, 0), lamTron1(kq.coMatCoDinhMuc - kq.tongDinhMuc)])
  aoa.push(['', 'Tổng lao động toàn trường (I-IV)', '', '', kq.toanTruong.coMatVC, kq.toanTruong.coMatHD, kq.toanTruong.coMat, ''])
  if (nhap.ghiChu) aoa.push([], ['Ghi chú:', nhap.ghiChu])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [{ wch: 6 }, { wch: 48 }, { wch: 46 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Định mức')
  XLSX.writeFile(wb, `Dinh-muc-${donVi.ma || donVi.id}-${namHoc}.xlsx`)
}
