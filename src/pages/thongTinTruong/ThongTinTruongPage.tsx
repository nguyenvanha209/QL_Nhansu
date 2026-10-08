import { useEffect, useMemo, useState } from 'react'
import {
  Card, Typography, Select, Table, Tag, InputNumber, Button, Space, Alert, App, Input,
  Statistic, Row, Col, Empty, Badge, Checkbox, Descriptions, Tooltip,
} from 'antd'
import { SaveOutlined, ArrowLeftOutlined, UndoOutlined, HistoryOutlined, EditOutlined } from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'
import { useDanhMucStore } from '@/store/danhMucStore'
import { useVienChucStore } from '@/store/vienChucStore'
import { duocTinhSoLieu } from '@/types/vienChuc'
import type { DonVi } from '@/types/donVi'
import type { QuyMoTruong, NoiDungQuyMo } from '@/types/quyMo'
import { choGhiXongVaKiemTra, lamMoiNgay } from '@/lib/supabase'
import { HANG_TRUONG_LABELS, getHangTruong, hangTruongTheoNamHoc } from '@/utils/hangTruong'
import { logAction } from '@/utils/auditLogger'
import { formatDatetime } from '@/utils/helpers'
import {
  type CapHoc, laCapHoc, TEN_CAP, THU_TU_CAP, KHOI, CO_HAI_BUOI, KHOI_TIN_TU_CHON,
  namHocHienHanh, dsNamHoc, idQuyMo, tongQuyMo, fmt, lamTron1,
} from '@/utils/dinhMuc'
import LichSuQuyMoDrawer from './LichSuQuyMoDrawer'

const { Title, Text } = Typography

const NGUONG_HANG: Record<CapHoc, string> = {
  MAM_NON: 'Hạng I từ 9 nhóm, lớp; hạng II từ 6 đến 8; hạng III từ 5 trở xuống',
  TIEU_HOC: 'Hạng I từ 28 lớp; hạng II từ 18 đến 27; hạng III dưới 18',
  THCS: 'Hạng I từ 28 lớp; hạng II từ 18 đến 27; hạng III dưới 18',
}

type TruongKhoi = 'soLop' | 'soHocSinh' | 'soLop2Buoi' | 'soHocSinh2Buoi'

/** Phần quy mô khai ở trang này (điều chỉnh định mức, kiêm nhiệm vẫn khai ở trang Định mức) */
type NhapQuyMo = Pick<QuyMoTruong, 'khoi' | 'khoiDayTinThem' | 'soDiemTruong' | 'ghiChu'>

const layNhap = (q?: QuyMoTruong): NhapQuyMo => ({
  khoi: q?.khoi ?? {}, khoiDayTinThem: q?.khoiDayTinThem, soDiemTruong: q?.soDiemTruong, ghiChu: q?.ghiChu,
})

// So sánh phần người dùng nhập, bỏ qua thứ tự khoá
function vanTay(q: NhapQuyMo, cap: CapHoc): string {
  return JSON.stringify({
    k: KHOI[cap].map((k) => {
      const o = q.khoi[k.ma]
      return [o?.soLop ?? 0, o?.soHocSinh ?? 0, ...(CO_HAI_BUOI[cap] ? [o?.soLop2Buoi ?? 0, o?.soHocSinh2Buoi ?? 0] : [])]
    }),
    b: cap === 'TIEU_HOC' ? [...(q.khoiDayTinThem ?? [])].sort() : [],
    d: cap === 'MAM_NON' ? q.soDiemTruong ?? 0 : 0,
    g: (q.ghiChu ?? '').trim(),
  })
}

/** Hiệu trưởng theo hồ sơ nhân sự (người đang công tác có chức vụ Hiệu trưởng) */
function useHieuTruong() {
  const vienChucs = useVienChucStore((s) => s.vienChucs)
  return useMemo(() => {
    const m = new Map<string, { ten: string; dienThoai?: string }>()
    for (const v of vienChucs) {
      if (v.chucVu === 'HT' && duocTinhSoLieu(v) && !m.has(v.donViId)) m.set(v.donViId, { ten: `${v.ho} ${v.ten}`, dienThoai: v.dienThoai?.trim() || undefined })
    }
    return m
  }, [vienChucs])
}

export default function ThongTinTruongPage() {
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
          <Title level={4} style={{ margin: 0 }}>Thông tin trường</Title>
          <Text type="secondary">
            Thông tin chung và quy mô trường lớp từng năm học. Số lớp là căn cứ xếp hạng trường (phụ cấp chức vụ, số phó hiệu trưởng) và tính định mức viên chức.
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
              placeholder="Tất cả các trường"
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
        <TongHop truongs={truongs} namHoc={namHoc} onChon={setChon} />
      )}
    </Card>
  )
}

// ───────────────────────────── Tổng hợp các trường ─────────────────────────────

type DongTT = {
  key: string
  loai: 'phuong' | 'cap' | 'truong'
  ten: string
  dv?: DonVi
  cap?: CapHoc
  qm?: QuyMoTruong
  stt?: number
  tongLop: number
  tongHS: number
  /** Dòng tổng: số trường, số trường đã khai, số trường theo hạng */
  soTruong?: number
  soDaKhai?: number
  theoHang?: Record<1 | 2 | 3, number>
}

function TongHop({ truongs, namHoc, onChon }: { truongs: DonVi[]; namHoc: string; onChon: (id: string) => void }) {
  const quyMoTruongs = useDanhMucStore((s) => s.quyMoTruongs)
  const hieuTruong = useHieuTruong()

  const { dongs, chuaKhai } = useMemo(() => {
    const truongRows: DongTT[] = truongs.map((dv) => {
      const cap = dv.loai as CapHoc
      const qm = quyMoTruongs.find((q) => q.id === idQuyMo(dv.id, namHoc))
      const t = qm ? tongQuyMo(qm, cap) : undefined
      return { key: dv.id, loai: 'truong', ten: dv.ten, dv, cap, qm, tongLop: t?.tongLop ?? 0, tongHS: t?.tongHS ?? 0 }
    })
    // Dòng cộng: toàn phường ở đầu, mỗi cấp một dòng ngay trên các trường của cấp
    const cong = (key: string, loai: 'phuong' | 'cap', ten: string, ds: DongTT[], cap?: CapHoc): DongTT => {
      const theoHang = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>
      for (const d of ds) if (d.tongLop) theoHang[getHangTruong(d.cap!, d.tongLop)]++
      return {
        key, loai, ten, cap,
        tongLop: ds.reduce((s, d) => s + d.tongLop, 0),
        tongHS: ds.reduce((s, d) => s + d.tongHS, 0),
        soTruong: ds.length, soDaKhai: ds.filter((d) => d.tongLop).length, theoHang,
      }
    }
    const ra: DongTT[] = [cong('__phuong', 'phuong', 'TOÀN PHƯỜNG', truongRows)]
    for (const cap of (Object.keys(THU_TU_CAP) as CapHoc[]).sort((a, b) => THU_TU_CAP[a] - THU_TU_CAP[b])) {
      const ds = truongRows.filter((d) => d.cap === cap)
      if (!ds.length) continue
      ra.push(cong(`__cap_${cap}`, 'cap', `Cấp ${TEN_CAP[cap]}`, ds, cap))
      ds.forEach((d, i) => ra.push({ ...d, stt: i + 1 }))
    }
    return { dongs: ra, chuaKhai: truongRows.filter((d) => !d.tongLop) }
  }, [truongs, quyMoTruongs, namHoc])

  const laTong = (r: DongTT) => r.loai !== 'truong'
  const dam = (r: DongTT, x: React.ReactNode) => (laTong(r) ? <b>{x}</b> : x)
  const mauHang = (h: 1 | 2 | 3) => (h === 1 ? 'gold' : h === 2 ? 'blue' : 'default')

  return (
    <>
      {chuaKhai.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`${chuaKhai.length}/${truongs.length} trường chưa khai báo quy mô năm học ${namHoc}`}
          description={chuaKhai.map((d) => d.ten).join(', ')}
        />
      )}
      <Table<DongTT>
        size="small"
        bordered
        rowKey="key"
        pagination={false}
        dataSource={dongs}
        scroll={{ x: 'max-content' }}
        onRow={(r) => (r.loai === 'truong'
          ? { onClick: () => onChon(r.dv!.id), style: { cursor: 'pointer' } }
          : { style: { background: r.loai === 'phuong' ? '#e0e7ff' : '#f1f5f9' } })}
        columns={[
          { title: 'STT', key: 'stt', width: 50, align: 'center', render: (_, r) => r.stt ?? '' },
          {
            title: 'Trường', key: 'ten',
            render: (_, r) => (laTong(r)
              ? <span><b>{r.ten}</b> <Text type="secondary" style={{ fontSize: 13 }}>({r.soTruong} trường)</Text></span>
              : <a>{r.ten}</a>),
          },
          { title: 'Cấp học', key: 'cap', width: 90, render: (_, r) => (r.loai === 'truong' ? TEN_CAP[r.cap!] : '') },
          { title: 'Số lớp', key: 'lop', width: 75, align: 'center', render: (_, r) => dam(r, r.tongLop || '-') },
          { title: 'Học sinh', key: 'hs', width: 85, align: 'center', render: (_, r) => dam(r, r.tongHS ? r.tongHS.toLocaleString('vi-VN') : '-') },
          { title: 'Bình quân/lớp', key: 'bq', width: 90, align: 'center', render: (_, r) => dam(r, r.tongLop ? fmt(r.tongHS / r.tongLop) : '-') },
          {
            title: 'Hạng trường', key: 'hang', width: 150, align: 'center',
            render: (_, r) => {
              if (laTong(r)) {
                const h = r.theoHang!
                const ds = ([1, 2, 3] as const).filter((k) => h[k])
                return ds.length
                  ? <Space size={4} wrap style={{ justifyContent: 'center' }}>{ds.map((k) => <Tag key={k} color={mauHang(k)} style={{ marginInlineEnd: 0 }}>{HANG_TRUONG_LABELS[k]}: {h[k]}</Tag>)}</Space>
                  : '-'
              }
              if (!r.tongLop) return '-'
              const hang = getHangTruong(r.cap!, r.tongLop)
              return <Tag color={mauHang(hang)} style={{ marginInlineEnd: 0 }}>{HANG_TRUONG_LABELS[hang]}</Tag>
            },
          },
          { title: 'Hiệu trưởng (theo hồ sơ)', key: 'ht', width: 190, render: (_, r) => (r.loai === 'truong' ? hieuTruong.get(r.dv!.id)?.ten ?? <Text type="secondary">-</Text> : '') },
          { title: 'ĐT hiệu trưởng', key: 'dtht', width: 120, render: (_, r) => (r.loai === 'truong' ? hieuTruong.get(r.dv!.id)?.dienThoai ?? <Text type="secondary">-</Text> : '') },
          { title: 'Điện thoại trường', key: 'dt', width: 120, render: (_, r) => (r.loai === 'truong' ? r.dv!.soDienThoai || <Text type="secondary">-</Text> : '') },
          {
            title: 'Khai báo', key: 'kb', width: 170,
            render: (_, r) => {
              if (laTong(r)) {
                const du = r.soDaKhai === r.soTruong
                return <Tag color={du ? 'success' : 'warning'} style={{ marginInlineEnd: 0 }}>Đã khai {r.soDaKhai}/{r.soTruong}</Tag>
              }
              return r.qm && r.tongLop
                ? <Text type="secondary" style={{ fontSize: 13 }}>{formatDatetime(r.qm.updatedAt)}</Text>
                : <Tag color="warning">Chưa khai báo</Tag>
            },
          },
        ]}
      />
    </>
  )
}

// ───────────────────────────── Một trường ─────────────────────────────

function ChiTietTruong({ donVi, namHoc, onBack }: { donVi: DonVi; namHoc: string; onBack?: () => void }) {
  const cap = donVi.loai as CapHoc
  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        {onBack && <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Tất cả các trường</Button>}
        <Text strong style={{ fontSize: 16 }}>{donVi.ten}</Text>
        <Tag>{TEN_CAP[cap]}</Tag>
      </Space>
      <ThongTinChung donVi={donVi} />
      <QuyMoNamHoc donVi={donVi} namHoc={namHoc} />
    </>
  )
}

function ThongTinChung({ donVi }: { donVi: DonVi }) {
  const { message } = App.useApp()
  const { currentUser, hasPermission, scopeDonViId } = useAuth()
  const updateDonVi = useDanhMucStore((s) => s.updateDonVi)
  const hieuTruong = useHieuTruong().get(donVi.id)
  const coTheSua = hasPermission('quyMo', 'write') && (!scopeDonViId || scopeDonViId === donVi.id)

  const [sua, setSua] = useState(false)
  const [nhap, setNhap] = useState({ diaChi: '', soDienThoai: '', email: '' })
  const batDauSua = () => {
    setNhap({ diaChi: donVi.diaChi ?? '', soDienThoai: donVi.soDienThoai ?? '', email: donVi.email ?? '' })
    setSua(true)
  }

  const luu = async () => {
    if (!currentUser) return
    const email = nhap.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      message.error('Email chưa đúng định dạng')
      return
    }
    const patch = { diaChi: nhap.diaChi.trim() || undefined, soDienThoai: nhap.soDienThoai.trim() || undefined, email: email || undefined }
    updateDonVi(donVi.id, patch)
    logAction(currentUser.id, currentUser.fullName, 'UPDATE', 'DanhMuc', {
      entityId: donVi.id,
      donViId: donVi.id,
      moTa: `Cập nhật thông tin chung - ${donVi.ten}`,
    })
    setSua(false)
    const kq = await choGhiXongVaKiemTra()
    if (kq === 'loi') message.warning({ content: 'Đã lưu trên máy này nhưng CHƯA lên được máy chủ. Hệ thống đang tự thử lại - hãy kiểm tra mạng và không đóng trang.', duration: 10 })
    else message.success('Đã lưu thông tin chung')
  }

  return (
    <Card
      size="small"
      title="Thông tin chung"
      style={{ marginBottom: 16 }}
      extra={coTheSua && (sua
        ? <Space><Button onClick={() => setSua(false)}>Hủy</Button><Button type="primary" icon={<SaveOutlined />} onClick={luu}>Lưu</Button></Space>
        : <Button icon={<EditOutlined />} onClick={batDauSua}>Sửa</Button>)}
    >
      <Descriptions size="small" column={{ xs: 1, md: 2 }} bordered>
        <Descriptions.Item label="Tên trường">{donVi.ten}</Descriptions.Item>
        <Descriptions.Item label="Mã">{donVi.ma}</Descriptions.Item>
        <Descriptions.Item label={<Tooltip title="Lấy từ hồ sơ nhân sự: người đang công tác có chức vụ Hiệu trưởng (điện thoại theo hồ sơ)">Hiệu trưởng</Tooltip>}>
          {hieuTruong
            ? <>{hieuTruong.ten}{hieuTruong.dienThoai
                ? <Text type="secondary"> - ĐT: <a href={`tel:${hieuTruong.dienThoai.replace(/\s/g, '')}`}>{hieuTruong.dienThoai}</a></Text>
                : <Text type="secondary"> - hồ sơ chưa ghi điện thoại</Text>}</>
            : <Text type="secondary">Chưa có hồ sơ ghi chức vụ Hiệu trưởng</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="Điện thoại trường">
          {sua ? <Input value={nhap.soDienThoai} maxLength={30} onChange={(e) => setNhap({ ...nhap, soDienThoai: e.target.value })} /> : donVi.soDienThoai || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Địa chỉ">
          {sua ? <Input value={nhap.diaChi} maxLength={200} onChange={(e) => setNhap({ ...nhap, diaChi: e.target.value })} /> : donVi.diaChi || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Email">
          {sua ? <Input value={nhap.email} maxLength={100} onChange={(e) => setNhap({ ...nhap, email: e.target.value })} /> : donVi.email || '-'}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}

function QuyMoNamHoc({ donVi, namHoc }: { donVi: DonVi; namHoc: string }) {
  const { message, modal } = App.useApp()
  const { currentUser, hasPermission, scopeDonViId } = useAuth()
  const cap = donVi.loai as CapHoc
  const id = idQuyMo(donVi.id, namHoc)
  const quyMoTruongs = useDanhMucStore((s) => s.quyMoTruongs)
  const quyMoDaLuu = useMemo(() => quyMoTruongs.find((q) => q.id === id), [quyMoTruongs, id])
  const luuQuyMo = useDanhMucStore((s) => s.luuQuyMo)
  const coTheSua = hasPermission('quyMo', 'write') && (!scopeDonViId || scopeDonViId === donVi.id)

  const tatCaLichSu = useDanhMucStore((s) => s.quyMoLichSu)
  const lichSu = useMemo(
    () => (tatCaLichSu ?? []).filter((l) => l.quyMoId === id).sort((a, b) => b.thoiGian.localeCompare(a.thoiGian)),
    [tatCaLichSu, id],
  )
  const [moLichSu, setMoLichSu] = useState(false)
  const [goc, setGoc] = useState(quyMoDaLuu)
  const [nhap, setNhap] = useState<NhapQuyMo>(() => layNhap(quyMoDaLuu))
  const daDoi = vanTay(nhap, cap) !== vanTay(layNhap(quyMoDaLuu), cap)

  // Bản mới từ máy khác: chưa sửa gì thì nạp luôn bản mới
  useEffect(() => {
    if (quyMoDaLuu?.updatedAt === goc?.updatedAt) return
    if (vanTay(nhap, cap) === vanTay(layNhap(goc), cap)) setNhap(layNhap(quyMoDaLuu))
    setGoc(quyMoDaLuu)
  }, [quyMoDaLuu])

  const t = tongQuyMo({ khoi: nhap.khoi } as QuyMoTruong, cap)
  const hangMoi = t.tongLop ? getHangTruong(cap, t.tongLop) : undefined
  // Hạng đang áp dụng cho năm học này (từ bản đã lưu, hoặc năm học gần nhất nếu năm này chưa khai)
  const hangHienTai = hangTruongTheoNamHoc(donVi, quyMoTruongs, namHoc)

  const datKhoi = (ma: string, truong: TruongKhoi, v: number | null) =>
    setNhap((q) => {
      const moi = { ...(q.khoi[ma] ?? { soLop: 0, soHocSinh: 0 }), [truong]: v ?? 0 }
      // Số học 2 buổi không vượt tổng của khối
      if (moi.soLop2Buoi != null && moi.soLop2Buoi > moi.soLop) moi.soLop2Buoi = moi.soLop
      if (moi.soHocSinh2Buoi != null && moi.soHocSinh2Buoi > moi.soHocSinh) moi.soHocSinh2Buoi = moi.soHocSinh
      return { ...q, khoi: { ...q.khoi, [ma]: moi } }
    })

  /** Nạp phần quy mô của một bản trong lịch sử vào form; chỉ có hiệu lực khi bấm "Lưu quy mô" */
  const nap = (nd: NoiDungQuyMo) => {
    setNhap(layNhap(JSON.parse(JSON.stringify(nd)) as QuyMoTruong))
    setMoLichSu(false)
    message.info('Đã nạp số liệu quy mô của bản này vào form. Kiểm tra lại rồi bấm "Lưu quy mô" để áp dụng.')
  }

  const luu = () => {
    if (!currentUser || !hangMoi) return

    const thucHien = async () => {
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
      const tinThem = cap === 'TIEU_HOC' ? (nhap.khoiDayTinThem ?? []).filter((k) => KHOI_TIN_TU_CHON.includes(k)) : []
      // Lấy bản mới nhất trên máy chủ để giữ nguyên phần điều chỉnh định mức, kiêm nhiệm do trang Định mức khai
      await lamMoiNgay()
      const moiNhat = useDanhMucStore.getState().quyMoTruongs.find((q) => q.id === id)
      luuQuyMo({
        id, donViId: donVi.id, namHoc, khoi,
        khoiDayTinThem: tinThem.length ? tinThem : undefined,
        dinhMucNhapTay: moiNhat?.dinhMucNhapTay,
        kiemNhiemNhapTay: moiNhat?.kiemNhiemNhapTay,
        soDiemTruong: cap === 'MAM_NON' ? nhap.soDiemTruong || undefined : undefined,
        ghiChu: nhap.ghiChu?.trim() || undefined,
        nguoiCapNhatId: currentUser.id,
        nguoiCapNhat: currentUser.fullName,
      })
      logAction(currentUser.id, currentUser.fullName, 'UPDATE', 'DanhMuc', {
        entityId: id,
        donViId: donVi.id,
        moTa: `Khai báo quy mô năm học ${namHoc} - ${donVi.ten}: ${t.tongLop} lớp, ${t.tongHS} học sinh (${HANG_TRUONG_LABELS[hangMoi]})`,
      })
      // Chỉ báo "đã lưu" khi dữ liệu thực sự đã lên máy chủ; lỗi mạng thì nói rõ để người dùng không tắt máy
      const kq = await choGhiXongVaKiemTra()
      if (kq === 'loi') {
        message.warning({
          content: 'Đã lưu trên máy này nhưng CHƯA lên được máy chủ. Hệ thống đang tự thử lại - hãy kiểm tra mạng và không đóng trang.',
          duration: 10,
        })
      } else message.success('Đã lưu quy mô lên máy chủ')
    }

    if (hangHienTai && hangHienTai.hang !== hangMoi) {
      modal.confirm({
        title: `Hạng trường năm học ${namHoc} đổi từ ${HANG_TRUONG_LABELS[hangHienTai.hang]} sang ${HANG_TRUONG_LABELS[hangMoi]}`,
        content: (
          <div>
            <p>
              Số lớp {hangHienTai.namHoc === namHoc ? `năm học ${namHoc}` : `đang dùng (theo năm học ${hangHienTai.namHoc})`} là {hangHienTai.tongLop}, nay khai {t.tongLop}.
            </p>
            <p style={{ marginBottom: 0 }}>
              Hạng trường là căn cứ phụ cấp chức vụ (TT 33/2005/TT-BGDĐT) và số phó hiệu trưởng.
              Phụ cấp đang hưởng <b>không tự thay đổi</b>; trang Rà soát sẽ liệt kê người có PC chức vụ khác mức theo hạng mới,
              và khi chỉnh sửa hồ sơ hiệu trưởng, phó hiệu trưởng, tổ trưởng, tổ phó hệ thống đề xuất mức theo hạng mới.
            </p>
          </div>
        ),
        okText: 'Lưu',
        cancelText: 'Hủy',
        onOk: thucHien,
      })
    } else thucHien()
  }

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
  const binhQuan = t.tongLop ? t.tongHS / t.tongLop : 0

  return (
    <Card
      size="small"
      title={(
        <Space wrap>
          <span>Quy mô năm học {namHoc}</span>
          {quyMoDaLuu
            ? <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>Cập nhật {formatDatetime(quyMoDaLuu.updatedAt)} - {quyMoDaLuu.nguoiCapNhat}</Text>
            : <Tag color="warning">Chưa khai báo</Tag>}
        </Space>
      )}
      extra={(
        <Space wrap>
          <Badge count={lichSu.length} size="small" color="#64748b" offset={[-4, 2]}>
            <Button icon={<HistoryOutlined />} onClick={() => setMoLichSu(true)}>Lịch sử khai báo</Button>
          </Badge>
          {coTheSua && (
            <>
              {daDoi && <Button icon={<UndoOutlined />} onClick={() => setNhap(layNhap(quyMoDaLuu))}>Hoàn tác</Button>}
              <Button type="primary" icon={<SaveOutlined />} onClick={luu} disabled={!daDoi || !t.tongLop}>Lưu quy mô</Button>
            </>
          )}
        </Space>
      )}
    >
      {daDoi && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Có thay đổi chưa lưu" />}
      {!quyMoDaLuu && hangHienTai && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Năm học ${namHoc} chưa khai báo - hạng trường, phụ cấp chức vụ đang tạm tính theo quy mô năm học ${hangHienTai.namHoc} (${hangHienTai.tongLop} lớp, ${HANG_TRUONG_LABELS[hangHienTai.hang]})`}
        />
      )}
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
                <Table.Summary.Cell index={1} align="center">{t.tongLop}</Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="center">{t.tongHS.toLocaleString('vi-VN')}</Table.Summary.Cell>
                {haiBuoi && <Table.Summary.Cell index={3} align="center">{t.tongLop2Buoi}</Table.Summary.Cell>}
                {haiBuoi && <Table.Summary.Cell index={4} align="center">{t.tongHS2Buoi.toLocaleString('vi-VN')}</Table.Summary.Cell>}
                <Table.Summary.Cell index={haiBuoi ? 5 : 3} align="center">{t.tongLop ? fmt(binhQuan) : '-'}</Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
          {haiBuoi && t.tongLop > 0 && (
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Học 1 buổi/ngày: {t.tongLop - t.tongLop2Buoi} lớp, {(t.tongHS - t.tongHS2Buoi).toLocaleString('vi-VN')} học sinh.
              {cap === 'TIEU_HOC' && ' Định mức giáo viên: lớp 1 buổi 1,2 GV/lớp, lớp 2 buổi 1,5 GV/lớp.'}
            </Text>
          )}
          {cap === 'TIEU_HOC' && t.tongLop > 0 && t.tongLop2Buoi === 0 && (
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
              <Text type="secondary" style={{ fontSize: 13 }}>
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
              <Text type="secondary" style={{ fontSize: 13 }}>
                Khối 3-5 bắt buộc theo chương trình GDPT 2018; khối 1, 2 tính thêm 1 tiết/tuần nếu trường có dạy.
              </Text>
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <Text strong>Ghi chú, căn cứ số liệu</Text>
            {coTheSua
              ? <Input.TextArea rows={2} value={nhap.ghiChu} onChange={(e) => setNhap((q) => ({ ...q, ghiChu: e.target.value }))} placeholder={`VD: Theo kế hoạch tuyển sinh năm học ${namHoc} đã được phê duyệt`} style={{ marginTop: 6 }} />
              : <div style={{ marginTop: 4 }}><Text type="secondary">{nhap.ghiChu || '-'}</Text></div>}
          </div>
        </Col>
        <Col xs={24} xl={haiBuoi ? 8 : 10}>
          <Row gutter={[12, 12]}>
            <Col span={12}><Card size="small"><Statistic title="Tổng số lớp" value={t.tongLop} /></Card></Col>
            <Col span={12}><Card size="small"><Statistic title={cap === 'MAM_NON' ? 'Tổng số trẻ' : 'Tổng học sinh'} value={t.tongHS} groupSeparator="." /></Card></Col>
            <Col span={12}><Card size="small"><Statistic title="Bình quân/lớp" value={t.tongLop ? lamTron1(binhQuan) : 0} precision={1} decimalSeparator="," /></Card></Col>
            <Col span={12}><Card size="small"><Statistic title="Hạng trường" value={hangMoi ? HANG_TRUONG_LABELS[hangMoi] : '-'} /></Card></Col>
          </Row>
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            title="Căn cứ xếp hạng trường"
            description={(
              <div style={{ fontSize: 14 }}>
                <div>{NGUONG_HANG[cap]} (TT 19/2023, TT 20/2023). Hạng trường quyết định số phó hiệu trưởng và phụ cấp chức vụ (TT 33/2005).</div>
                <div style={{ marginTop: 6 }}>
                  Phụ cấp chức vụ xét theo hạng của năm học chứa ngày xét (hôm nay: năm học {namHocHienHanh()}).
                  Năm học chưa khai báo thì tạm dùng năm học gần nhất đã khai.
                </div>
              </div>
            )}
          />
        </Col>
      </Row>
      <LichSuQuyMoDrawer
        open={moLichSu}
        onClose={() => setMoLichSu(false)}
        lichSu={lichSu}
        cap={cap}
        coTheSua={coTheSua}
        onNap={nap}
        ghiChuNap="Ở trang này chỉ nạp lại số lớp, học sinh, Tin học, điểm trường và ghi chú; phần điều chỉnh định mức nạp ở trang Định mức."
      />
    </Card>
  )
}
