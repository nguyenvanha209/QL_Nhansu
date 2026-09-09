import { useMemo } from 'react'
import { Card, Typography, Table, Tag, Button, Space, Collapse, Alert } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { useUserStore } from '@/store/userStore'
import { useDanhMucStore } from '@/store/danhMucStore'

const { Title, Text, Paragraph } = Typography

const DV_ORDER: Record<string, number> = { MAM_NON: 1, TIEU_HOC: 2, THCS: 3 }
const DV_LABEL: Record<string, string> = { MAM_NON: 'Mầm non', TIEU_HOC: 'Tiểu học', THCS: 'Trung học cơ sở' }

function Section({ so, tieuDe, moTa, children }: { so: string; tieuDe: string; moTa?: string; children: React.ReactNode }) {
  return (
    <section className="hd-section">
      <div className="hd-rail">{so}</div>
      <div className="hd-body">
        <h2>{tieuDe}</h2>
        {moTa && <p className="hd-lede">{moTa}</p>}
        {children}
      </div>
    </section>
  )
}

function KhungLuuY({ nhan, ok, children }: { nhan: string; ok?: boolean; children: React.ReactNode }) {
  return (
    <div className={ok ? 'hd-note hd-note-ok' : 'hd-note'} data-label={nhan}>
      {children}
    </div>
  )
}

export default function HuongDanPage() {
  const users = useUserStore((s) => s.users)
  const donVis = useDanhMucStore((s) => s.donVis)

  const taiKhoanTruong = useMemo(() => {
    const ds = donVis
      .filter((d) => d.active)
      .sort((a, b) => {
        const oa = DV_ORDER[a.loai] ?? 9
        const ob = DV_ORDER[b.loai] ?? 9
        if (oa !== ob) return oa - ob
        return a.ten.localeCompare(b.ten, 'vi')
      })
    const rows: Array<{ key: string; ten: string; kt: string; ht: string; isGroup?: boolean }> = []
    let lastLoai = ''
    for (const dv of ds) {
      const kt = users.find((u) => u.active && u.donViId === dv.id && u.role === 'CB_TRUONG')
      const ht = users.find((u) => u.active && u.donViId === dv.id && u.role === 'HIEU_TRUONG')
      if (!kt && !ht) continue
      if (dv.loai !== lastLoai) {
        rows.push({ key: `g_${dv.loai}`, ten: DV_LABEL[dv.loai] ?? dv.loai, kt: '', ht: '', isGroup: true })
        lastLoai = dv.loai
      }
      rows.push({ key: dv.id, ten: dv.ten, kt: kt?.username ?? '—', ht: ht?.username ?? '—' })
    }
    return rows
  }, [donVis, users])

  const colTaiKhoan = [
    {
      title: 'Trường', dataIndex: 'ten', key: 'ten',
      render: (v: string, r: any) => r.isGroup ? <Text strong style={{ color: '#1B4D8F' }}>{v}</Text> : v,
    },
    {
      title: 'Tài khoản Kế toán', dataIndex: 'kt', key: 'kt', width: 170,
      render: (v: string, r: any) => r.isGroup ? null : <Text code>{v}</Text>,
    },
    {
      title: 'Tài khoản Hiệu trưởng', dataIndex: 'ht', key: 'ht', width: 180,
      render: (v: string, r: any) => r.isGroup ? null : <Text code>{v}</Text>,
    },
  ]

  const buoc = [
    {
      so: 1, ai: 'Kế toán trường', tieuDe: 'Lập và trình phiếu',
      noiDung: <>Tạo phiếu, chọn viên chức, kiểm tra bậc và hệ số đề nghị, rồi bấm <b>Trình Hiệu trưởng duyệt</b>.</>,
      chip: <><Tag>Bản nháp</Tag> <Text type="secondary">→</Text> <Tag color="cyan">Chờ Hiệu trưởng duyệt</Tag></>,
    },
    {
      so: 2, ai: 'Hiệu trưởng', tieuDe: 'Duyệt tại trường',
      noiDung: <>Hiệu trưởng đăng nhập bằng tài khoản <Text code>HT.xxx</Text>, xem phiếu rồi bấm <b>Duyệt — chuyển VH-XH</b>. Có thể <b>Yêu cầu bổ sung</b> hoặc <b>Từ chối</b> kèm ý kiến.</>,
      chip: <Tag color="processing">Chờ VH-XH thẩm định</Tag>,
    },
    {
      so: 3, ai: 'Phòng Văn hóa – Xã hội', tieuDe: 'Thẩm định hồ sơ',
      noiDung: <>Cán bộ Phòng VH-XH kiểm tra căn cứ pháp lý, niên hạn nâng bậc, mức phụ cấp, rồi bấm <b>Đồng ý — chuyển lãnh đạo</b>.</>,
      chip: <Tag color="warning">Chờ lãnh đạo phê duyệt</Tag>,
    },
    {
      so: 4, ai: 'Lãnh đạo phường', tieuDe: 'Phê duyệt — hệ thống tự cập nhật', cuoi: true,
      noiDung: <>Lãnh đạo bấm <b>Phê duyệt</b>. Ngay tại thời điểm này hệ thống tự ghi kết quả vào hồ sơ viên chức.</>,
      chip: <Tag color="success">Đã phê duyệt</Tag>,
    },
  ]

  return (
    <Card className="hd-root">
      <div className="hd-toolbar">
        <div>
          <Title level={3} style={{ margin: 0 }}>Sổ tay Kế toán trường</Title>
          <Text type="secondary">
            Hướng dẫn rà soát hồ sơ viên chức và lập phiếu đề xuất điều chỉnh hệ số lương, phụ cấp thâm niên
          </Text>
        </div>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In tài liệu</Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 28 }}
        title="Dữ liệu viên chức đã được nhập sẵn từ bảng lương tháng 6/2026"
        description="Ba việc chính: (1) rà soát, hoàn thiện hồ sơ viên chức; (2) không tự sửa hệ số lương và phụ cấp; (3) mọi điều chỉnh lương đi qua phiếu đề xuất — được phê duyệt là hệ thống tự ghi vào hồ sơ."
      />

      {/* ── I ── */}
      <Section
        so="I"
        tieuDe="Đăng nhập hệ thống"
        moTa="Mỗi trường được cấp hai tài khoản: một cho Kế toán (KT) và một cho Hiệu trưởng (HT). Tài khoản Kế toán là tài khoản trực tiếp nhập liệu và lập phiếu đề xuất."
      >
        <h3>Tên đăng nhập của từng trường</h3>
        <Table
          dataSource={taiKhoanTruong}
          columns={colTaiKhoan}
          size="small"
          pagination={false}
          bordered
          rowClassName={(r: any) => r.isGroup ? 'hd-grp' : ''}
          style={{ marginBottom: 16 }}
        />
        <Paragraph>
          Mật khẩu được cung cấp riêng cho từng trường, không đăng công khai trên màn hình đăng nhập.
          Sau khi đăng nhập lần đầu, vào menu tài khoản ở góc trên bên phải → <b>Thông tin tài khoản</b> để đổi mật khẩu.
        </Paragraph>

        <KhungLuuY nhan="Lưu ý bảo mật">
          <ul>
            <li>Hệ thống <b>tự động đăng xuất sau 10 phút</b> không có thao tác. Đây là quy định bảo vệ dữ liệu nhân sự, không phải lỗi — chỉ cần đăng nhập lại và tiếp tục.</li>
            <li>Tài khoản Kế toán chỉ nhìn thấy và chỉ sửa được hồ sơ viên chức <b>thuộc trường mình</b>.</li>
            <li>Mọi thao tác thêm, sửa, xóa đều được ghi vào nhật ký hệ thống kèm tên người thực hiện và thời điểm.</li>
          </ul>
        </KhungLuuY>
      </Section>

      {/* ── II ── */}
      <Section
        so="II"
        tieuDe="Rà soát và hoàn thiện hồ sơ viên chức"
        moTa="Toàn bộ danh sách viên chức đã được nhập sẵn từ bảng lương tháng 6/2026 của từng trường. Việc của Kế toán giai đoạn này là đối chiếu và bổ sung những thông tin mà bảng lương không có."
      >
        <h3>Cách mở và sửa một hồ sơ</h3>
        <ol>
          <li>Vào menu <b>Hồ sơ viên chức</b> ở thanh bên trái.</li>
          <li>Bấm vào <b>họ tên</b> viên chức để mở trang chi tiết.</li>
          <li>Bấm nút <b>Chỉnh sửa</b>, cập nhật thông tin rồi <b>Lưu</b>.</li>
        </ol>
        <Paragraph>
          Có thể bấm vào tiêu đề bất kỳ cột nào để sắp xếp danh sách — ví dụ sắp theo <b>Ngày sinh</b> để tìm nhanh những hồ sơ chưa có ngày sinh.
        </Paragraph>

        <h3>Các nhóm thông tin trong hồ sơ</h3>
        <div className="hd-tw">
          <table className="hd-table">
            <thead>
              <tr><th style={{ width: 170 }}>Nhóm</th><th>Các trường thông tin</th><th style={{ width: 150 }}>Nguồn</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><b>Thông tin cá nhân</b></td>
                <td>Họ và tên <i className="hd-req">*</i>, Giới tính <i className="hd-req">*</i>, Ngày sinh <i className="hd-req">*</i>, Số CCCD, Điện thoại, Đảng viên</td>
                <td>Kế toán bổ sung</td>
              </tr>
              <tr>
                <td><b>Công tác</b></td>
                <td>Đơn vị công tác <i className="hd-req">*</i>, Vị trí việc làm <i className="hd-req">*</i>, Chức vụ, Mã ngạch/Hạng <i className="hd-req">*</i>, Loại hình lao động <i className="hd-req">*</i>, Nguồn kinh phí <i className="hd-req">*</i>, Trạng thái công tác <i className="hd-req">*</i></td>
                <td>Đã có, cần đối chiếu</td>
              </tr>
              <tr>
                <td><b>Mốc thời gian</b></td>
                <td>Ngày vào ngành <i className="hd-req">*</i>, Ngày vào đơn vị <i className="hd-req">*</i>, Ngày vào biên chế</td>
                <td>Kế toán bổ sung</td>
              </tr>
              <tr>
                <td><b>Trình độ</b></td>
                <td>Trình độ chuyên môn nghiệp vụ, Nhiệm vụ chính, Trình độ khác</td>
                <td>Kế toán bổ sung</td>
              </tr>
              <tr>
                <td><b>Lương &amp; phụ cấp</b></td>
                <td>Bậc lương, Hệ số lương, Mốc hưởng lương, Mốc hưởng PCTN, các khoản phụ cấp</td>
                <td>Từ bảng lương T6/2026</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Paragraph type="secondary" style={{ fontSize: 13 }}>
          <i className="hd-req">*</i> Trường bắt buộc — không lưu được hồ sơ nếu để trống.
        </Paragraph>

        <h3>Danh mục việc cần làm</h3>
        <ol className="hd-todo">
          <li>Đối chiếu tổng số viên chức trên hệ thống với danh sách thực tế của trường.</li>
          <li>Bổ sung <b>ngày sinh</b> cho những hồ sơ còn trống (một số trường hợp bảng lương không ghi ngày sinh).</li>
          <li>Kiểm tra <b>Ngày vào ngành</b> — đây là căn cứ tính phụ cấp thâm niên nhà giáo.</li>
          <li>Bổ sung <b>số CCCD</b> và <b>số điện thoại</b> liên hệ.</li>
          <li>Bổ sung <b>trình độ chuyên môn nghiệp vụ</b> và trình độ khác (lý luận chính trị, tin học, ngoại ngữ…).</li>
          <li>Kiểm tra <b>Vị trí việc làm</b> và <b>Chức vụ</b> đúng thực tế (Hiệu trưởng, Phó Hiệu trưởng, Tổ trưởng chuyên môn, giáo viên, nhân viên).</li>
          <li>Rà soát <b>Trạng thái công tác</b>: người đã chuyển đi hoặc nghỉ hưu phải đổi trạng thái, <i>không xóa hồ sơ</i>.</li>
          <li>Đối chiếu <b>Bảng tổng hợp lương</b> trên hệ thống với bảng lương giấy tháng 6/2026 — báo lại nếu có sai lệch.</li>
        </ol>

        <KhungLuuY nhan="Không xóa hồ sơ">
          <p>
            Viên chức nghỉ hưu, chuyển công tác hoặc thôi việc <b>vẫn giữ nguyên hồ sơ</b> trên hệ thống.
            Chỉ đổi mục <b>Trạng thái công tác</b> sang <i>Nghỉ hưu</i>, <i>Chuyển đi</i> hoặc <i>Thôi việc</i>.
          </p>
          <p>
            Người đã đổi trạng thái sẽ tự động không còn xuất hiện trong danh sách lập phiếu đề xuất,
            nhưng lịch sử lương và phụ cấp vẫn được lưu để tra cứu về sau.
          </p>
        </KhungLuuY>
      </Section>

      {/* ── III ── */}
      <Section
        so="III"
        tieuDe="Nguyên tắc về hệ số lương và phụ cấp"
        moTa="Đây là điểm khác biệt lớn nhất so với cách làm trên file Excel. Xin đọc kỹ phần này trước khi thao tác."
      >
        <KhungLuuY nhan="Quy định bắt buộc">
          <p><b>Kế toán không tự sửa hệ số lương, bậc lương và phụ cấp trực tiếp trong hồ sơ.</b></p>
          <p>
            Tài khoản Kế toán được cấp quyền <i>chỉ xem</i> đối với dữ liệu lương. Menu “Lương &amp; Phụ cấp”
            đã được ẩn khỏi thanh điều hướng. Mọi thay đổi phải đi qua phiếu đề xuất và được
            Phòng Văn hóa – Xã hội thẩm định.
          </p>
        </KhungLuuY>

        <h3>Vì sao phải làm như vậy</h3>
        <ul>
          <li><b>Mỗi thay đổi đều có căn cứ.</b> Hệ số lương gắn với một phiếu đề xuất đã được phê duyệt, tra ngược lại được ai đề nghị, ai duyệt, ngày nào.</li>
          <li><b>Có lịch sử biến động.</b> Hệ thống tự ghi lại “Bậc 3 – Hệ số 3.00 → Bậc 4 – Hệ số 3.33” kèm ngày hiệu lực, xem được ngay trong hồ sơ viên chức.</li>
          <li><b>Số liệu 11 trường thống nhất.</b> Bảng tổng hợp lương toàn phường và các báo cáo gửi cấp trên luôn khớp nhau vì cùng lấy từ một nguồn.</li>
          <li><b>Giảm việc cho Kế toán.</b> Sau khi phiếu được phê duyệt, hệ thống tự cập nhật vào hồ sơ — không phải nhập lại lần thứ hai.</li>
        </ul>

        <h3>Phân biệt hai việc</h3>
        <div className="hd-tw">
          <table className="hd-table">
            <thead>
              <tr><th style={{ width: '46%' }}>Kế toán tự làm được</th><th>Phải qua phiếu đề xuất</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  Ngày sinh, CCCD, điện thoại<br />
                  Trình độ chuyên môn, trình độ khác<br />
                  Ngày vào ngành, vào đơn vị, vào biên chế<br />
                  Chức vụ, vị trí việc làm<br />
                  Trạng thái công tác
                </td>
                <td>
                  Nâng bậc lương thường xuyên<br />
                  Nâng bậc lương trước thời hạn<br />
                  Điều chỉnh hệ số lương<br />
                  Chuyển ngạch / thay đổi hạng chức danh<br />
                  Nâng mức phụ cấp thâm niên nhà giáo
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── IV ── */}
      <Section
        so="IV"
        tieuDe="Quy trình đề xuất điều chỉnh"
        moTa="Phiếu đề xuất đi qua bốn bước. Kế toán thực hiện bước 1; ba bước còn lại do Hiệu trưởng, Phòng VH-XH và Lãnh đạo phường xử lý. Trạng thái ghi dưới đây chính là nhãn hiển thị trên màn hình."
      >
        <div className="hd-flow">
          {buoc.map((b) => (
            <div key={b.so} className={b.cuoi ? 'hd-step hd-step-final' : 'hd-step'}>
              <div className="hd-dot">{b.so}</div>
              <span className="hd-who">{b.ai}</span>
              <h4>{b.tieuDe}</h4>
              <p>{b.noiDung}</p>
              <p><Text type="secondary" style={{ fontSize: 13, marginRight: 6 }}>Trạng thái:</Text>{b.chip}</p>
            </div>
          ))}
        </div>

        <div className="hd-auto">
          <b>Hệ thống tự động thực hiện sau khi phê duyệt</b>
          <ol>
            <li>Kết thúc hiệu lực bản ghi hệ số lương (hoặc phụ cấp thâm niên) cũ.</li>
            <li>Tạo bản ghi mới với bậc, hệ số và ngày hiệu lực đúng như trên phiếu.</li>
            <li>Tính sẵn <b>ngày nâng bậc lương kế tiếp</b>: cộng 2 năm với bậc từ 8 trở xuống, cộng 3 năm với bậc trên 8.</li>
            <li>Cập nhật lại hồ sơ viên chức và mã ngạch nếu phiếu có chuyển ngạch.</li>
            <li>Ghi một dòng vào <b>Lịch sử biến động</b> của viên chức, gắn với mã phiếu đề xuất.</li>
          </ol>
        </div>

        <KhungLuuY nhan="Kế toán không phải làm gì thêm" ok>
          <p>
            Sau khi phiếu chuyển sang trạng thái <b>Đã phê duyệt</b>, hệ số lương và phụ cấp mới đã nằm trong
            hồ sơ viên chức và đã hiển thị trên Bảng tổng hợp lương. <b>Không cần vào sửa lại hồ sơ.</b> Nếu
            Kế toán sửa tay thêm lần nữa, số liệu sẽ bị trùng và lệch so với báo cáo toàn phường.
          </p>
        </KhungLuuY>

        <h3>Khi phiếu bị trả lại</h3>
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 200 }}>Trạng thái</th><th>Ý nghĩa và việc cần làm</th></tr></thead>
            <tbody>
              <tr>
                <td><Tag color="orange">Yêu cầu bổ sung</Tag></td>
                <td>Người duyệt cần thêm thông tin hoặc chỉnh lại số liệu. Mở phiếu, đọc ý kiến ở phần lịch sử duyệt, sửa lại rồi trình lại.</td>
              </tr>
              <tr>
                <td><Tag color="error">Bị từ chối</Tag></td>
                <td>Đề nghị không được chấp thuận. Đọc lý do trong phiếu; nếu vẫn cần điều chỉnh thì lập phiếu mới với căn cứ đầy đủ hơn.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── V ── */}
      <Section
        so="V"
        tieuDe="Hướng dẫn lập phiếu đề xuất"
        moTa="Vào menu Đề xuất điều chỉnh Hệ số lương – PCTN, bấm nút tạo phiếu mới. Một phiếu có thể gồm nhiều viên chức cùng đợt, không cần lập riêng từng người."
      >
        <h3>Phần thông tin chung</h3>
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 165 }}>Mục</th><th>Cách điền</th></tr></thead>
            <tbody>
              <tr><td><b>Tiêu đề</b> <i className="hd-req">*</i></td><td>Ghi rõ đợt và trường. Ví dụ: <i>Nâng bậc lương 6 tháng đầu năm 2026 – THCS An Đà</i>.</td></tr>
              <tr><td><b>Đơn vị</b> <i className="hd-req">*</i></td><td>Hệ thống điền sẵn trường của bạn.</td></tr>
              <tr><td><b>Loại đề xuất</b> <i className="hd-req">*</i></td><td>Nâng bậc thường xuyên · Nâng bậc trước hạn · Điều chỉnh lương · Chuyển ngạch/chức danh · Phụ cấp thâm niên.</td></tr>
              <tr><td><b>Ghi chú</b></td><td>Căn cứ pháp lý, số văn bản, hoặc giải trình cho trường hợp đặc biệt.</td></tr>
            </tbody>
          </table>
        </div>

        <h3>5.1 — Phiếu nâng bậc lương</h3>
        <Paragraph>
          Hệ thống có sẵn bảng <b>gợi ý viên chức đến kỳ nâng lương</b>, lọc theo đợt: 6 tháng đầu năm
          (01/01 – 30/06) hoặc 6 tháng cuối năm (01/07 – 31/12). Cách nhanh nhất:
        </Paragraph>
        <ol>
          <li>Chọn <b>năm</b> và <b>đợt</b> cần xét.</li>
          <li>Tích chọn những viên chức đủ điều kiện trong bảng gợi ý.</li>
          <li>Bấm <b>Thêm đã chọn</b> — hệ thống tự điền bậc mới, hệ số mới và mốc hưởng lương theo bảng lương của ngạch.</li>
          <li>Kiểm tra lại từng dòng. Cột <b>Bậc mới</b>, <b>Hệ số mới</b> và <b>Mốc hưởng lương</b> đều sửa được nếu trường hợp cụ thể khác gợi ý.</li>
        </ol>
        <Paragraph>
          Với trường hợp không nằm trong gợi ý (nâng trước hạn do thành tích, điều chỉnh sai sót…),
          chọn trực tiếp viên chức ở ô tìm kiếm phía trên bảng chi tiết.
        </Paragraph>

        <h3>5.2 — Phiếu phụ cấp thâm niên nhà giáo</h3>
        <Paragraph>
          Chọn loại đề xuất <b>Phụ cấp thâm niên</b>, giao diện sẽ chuyển sang các cột riêng:
          Mốc PCTN hiện tại, PCTN hiện tại, PCTN đề nghị, Mốc hưởng PCTN.
        </Paragraph>
        <ul>
          <li>Hệ thống gợi ý theo <b>ngày kỷ niệm mốc hưởng PCTN</b> của từng người và tự đề nghị mức mới <b>tăng 1%</b> so với mức đang hưởng.</li>
          <li>Trường hợp chưa từng hưởng phụ cấp thâm niên, mức đề nghị khởi điểm là <b>5%</b>.</li>
          <li>Hồ sơ chưa khai <b>Mốc hưởng PCTN</b> sẽ không xuất hiện trong bảng gợi ý — cần bổ sung mốc này trong hồ sơ viên chức trước.</li>
        </ul>

        <KhungLuuY nhan="Nhân viên không hưởng PCTN">
          <p>
            Phụ cấp thâm niên nhà giáo chỉ áp dụng cho <b>cán bộ quản lý và giáo viên</b>. Viên chức có
            vị trí việc làm là <i>Nhân viên</i> (kế toán, y tế, văn thư, thư viện…) không thuộc diện hưởng.
            Hệ thống sẽ chặn không cho thêm vào phiếu và báo cảnh báo ngay tại màn hình.
          </p>
        </KhungLuuY>

        <h3>Lưu và trình phiếu</h3>
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 200 }}>Nút</th><th>Kết quả</th></tr></thead>
            <tbody>
              <tr>
                <td><b>Lưu bản nháp</b></td>
                <td>Phiếu ở trạng thái <Tag>Bản nháp</Tag>, chỉ mình bạn thấy. Sửa tiếp lúc nào cũng được; khi xong mở phiếu và bấm <b>Trình Hiệu trưởng duyệt</b>.</td>
              </tr>
              <tr>
                <td><b>Lưu &amp; Nộp ngay</b></td>
                <td>Vừa tạo phiếu vừa trình thẳng lên Hiệu trưởng, chuyển sang <Tag color="cyan">Chờ Hiệu trưởng duyệt</Tag>.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Paragraph>Kiểm tra kỹ trước khi nộp: phiếu đã trình thì không sửa được nữa, phải chờ người duyệt trả lại.</Paragraph>
      </Section>

      {/* ── VI ── */}
      <Section so="VI" tieuDe="Theo dõi và tra cứu">
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 250 }}>Menu</th><th>Dùng để làm gì</th></tr></thead>
            <tbody>
              <tr><td><b>Tổng quan</b></td><td>Số liệu nhanh về nhân sự, cơ cấu vị trí việc làm và số phiếu đề xuất đang xử lý.</td></tr>
              <tr><td><b>Hồ sơ viên chức</b></td><td>Danh sách và chi tiết từng người, kèm lịch sử biến động lương – phụ cấp. Xuất được ra Excel.</td></tr>
              <tr><td><b>Bảng tổng hợp lương</b></td><td>Bảng lương theo mẫu quen thuộc, có dòng cộng của từng trường và dòng tổng cuối bảng. Bấm <b>Xuất Excel</b> để lấy file đối chiếu.</td></tr>
              <tr><td><b>Đề xuất điều chỉnh HSL – PCTN</b></td><td>Danh sách phiếu đã lập và trạng thái xử lý từng phiếu.</td></tr>
              <tr><td><b>Dự báo nghỉ hưu</b></td><td>Danh sách viên chức sắp đến tuổi nghỉ hưu để chủ động bố trí nhân sự.</td></tr>
              <tr><td><b>Báo cáo</b></td><td>Các biểu tổng hợp phục vụ báo cáo cấp trên.</td></tr>
            </tbody>
          </table>
        </div>
        <Paragraph>
          Ở các bảng danh sách, bấm vào <b>tiêu đề cột</b> để sắp xếp tăng hoặc giảm dần. Riêng trang
          <b> Hồ sơ viên chức</b> có thêm bộ lọc theo loại hình lao động và trạng thái công tác.
        </Paragraph>
      </Section>

      {/* ── VII ── */}
      <Section so="VII" tieuDe="Câu hỏi thường gặp">
        <Collapse
          ghost
          className="hd-faq"
          items={[
            {
              key: '1', label: 'Hệ số lương trên hệ thống lệch với bảng lương giấy thì xử lý thế nào?',
              children: <p>Không sửa trực tiếp. Lập phiếu đề xuất loại <b>Điều chỉnh lương</b>, ghi rõ trong phần Ghi chú số liệu đúng và căn cứ kèm theo. Nếu sai lệch xảy ra ở nhiều hồ sơ, liên hệ trực tiếp số hỗ trợ để rà soát lại dữ liệu gốc.</p>,
            },
            {
              key: '2', label: 'Trường có viên chức mới chuyển đến giữa năm, thêm vào bằng cách nào?',
              children: <p>Vào <b>Hồ sơ viên chức</b> → <b>Thêm viên chức</b>, khai đầy đủ thông tin kèm bậc và hệ số lương đang hưởng theo quyết định điều động. Đặt <b>Trạng thái công tác</b> là <i>Chuyển đến</i>. Hồ sơ mới không cần qua phiếu đề xuất.</p>,
            },
            {
              key: '3', label: 'Đã trình phiếu nhưng phát hiện nhầm số liệu?',
              children: <p>Liên hệ Hiệu trưởng để bấm <b>Yêu cầu bổ sung</b>. Phiếu sẽ quay lại để bạn sửa và trình lại, không cần lập phiếu mới.</p>,
            },
            {
              key: '4', label: 'Một phiếu có thể gồm bao nhiêu viên chức?',
              children: <p>Không giới hạn. Nên gộp toàn bộ viên chức cùng một đợt nâng lương vào một phiếu — vừa nhanh cho Kế toán, vừa gọn cho các cấp duyệt.</p>,
            },
            {
              key: '5', label: 'Dữ liệu có bị mất khi máy tính hỏng hoặc xóa trình duyệt không?',
              children: <p>Không. Toàn bộ dữ liệu lưu trên máy chủ dùng chung, đăng nhập từ máy nào cũng thấy đúng số liệu mới nhất.</p>,
            },
            {
              key: '6', label: 'Vì sao đang làm thì bị đăng xuất?',
              children: <p>Hệ thống tự đăng xuất sau 10 phút không thao tác để bảo vệ dữ liệu nhân sự. Phần đã bấm Lưu vẫn còn nguyên. Đăng nhập lại và làm tiếp bình thường.</p>,
            },
          ]}
        />
      </Section>

      <div className="hd-footer">
        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>Hỗ trợ kỹ thuật và cấp lại mật khẩu</Text>
          <div className="hd-hotline">Đ/c Nguyễn Văn Hạ — 0902.121.599</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>UBND Phường Gia Viên</Text><br />
          <Text type="secondary" style={{ fontSize: 13 }}>Hệ thống Quản lý Viên chức ngành Giáo dục</Text>
        </div>
      </div>

      <style>{`
.hd-root { max-width: 1000px; margin: 0 auto; }
.hd-toolbar {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
  flex-wrap: wrap; margin-bottom: 20px; padding-bottom: 18px;
  border-bottom: 2px solid rgba(0,0,0,.85);
}
.hd-section { display: grid; grid-template-columns: 52px minmax(0,1fr); gap: 0 20px; margin-bottom: 46px; }
.hd-rail { font-weight: 700; font-size: 21px; color: #1B4D8F; line-height: 1; padding-top: 4px; text-align: right; }
.hd-body { min-width: 0; }
.hd-body h2 { font-size: 22px; font-weight: 700; line-height: 1.25; margin: 0 0 4px; }
.hd-body h3 { font-size: 16px; font-weight: 600; margin: 26px 0 10px; }
.hd-body h4 { font-size: 16px; font-weight: 600; margin: 3px 0 4px; }
.hd-lede { color: rgba(0,0,0,.55); font-size: 15px; margin: 0 0 18px; max-width: 70ch; }
.hd-body p { margin: 0 0 12px; max-width: 74ch; }
.hd-body ul, .hd-body ol { margin: 0 0 14px; padding-left: 22px; max-width: 74ch; }
.hd-body li { margin-bottom: 6px; }
.hd-todo li { margin-bottom: 9px; }
.hd-req { color: #B4232A; font-weight: 700; font-style: normal; }

.hd-tw { overflow-x: auto; margin: 0 0 18px; }
.hd-table { border-collapse: collapse; width: 100%; font-size: 14px; min-width: 460px;
  border: 1px solid rgba(0,0,0,.12); }
.hd-table th { font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase;
  color: rgba(0,0,0,.5); text-align: left; padding: 10px 13px;
  border-bottom: 1px solid rgba(0,0,0,.12); font-weight: 600; }
.hd-table td { padding: 10px 13px; border-bottom: 1px solid rgba(0,0,0,.06); vertical-align: top; }
.hd-table tr:last-child td { border-bottom: none; }
.hd-grp td { background: #EEF3FA !important; }

.hd-note { position: relative; border: 1px solid #B4232A; background: #FDF1F1;
  padding: 20px 20px 4px; margin: 20px 0 22px; border-radius: 2px; }
.hd-note::before { content: attr(data-label); position: absolute; top: -8px; left: 14px;
  background: #FDF1F1; padding: 0 8px; font-weight: 700; font-size: 10.5px;
  letter-spacing: .14em; text-transform: uppercase; color: #B4232A; }
.hd-note p:last-child { margin-bottom: 16px; }
.hd-note ul { margin-bottom: 16px; }
.hd-note-ok { border-color: #1F7A4D; background: #EDF6F1; }
.hd-note-ok::before { background: #EDF6F1; color: #1F7A4D; }

.hd-flow { margin: 22px 0 8px; position: relative; }
.hd-flow::before { content: ""; position: absolute; left: 15px; top: 14px; bottom: 42px;
  width: 2px; background: rgba(0,0,0,.1); }
.hd-step { position: relative; padding-left: 50px; margin-bottom: 24px; }
.hd-dot { position: absolute; left: 0; top: 0; width: 32px; height: 32px; border-radius: 50%;
  background: #fff; border: 2px solid #1B4D8F; color: #1B4D8F; font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: center; }
.hd-step-final .hd-dot { background: #1F7A4D; border-color: #1F7A4D; color: #fff; }
.hd-who { font-size: 11.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(0,0,0,.45); display: block; }
.hd-step p { margin: 0 0 8px; }

.hd-auto { border: 1px solid rgba(0,0,0,.12); border-radius: 2px; padding: 16px 18px 2px; margin: 18px 0 6px; }
.hd-auto > b { font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase;
  color: #1F7A4D; display: block; margin-bottom: 9px; }

.hd-faq .ant-collapse-header { font-weight: 600 !important; padding-left: 0 !important; }
.hd-faq .ant-collapse-content-box p { margin: 0 0 8px; }

.hd-footer { border-top: 2px solid rgba(0,0,0,.85); margin-top: 48px; padding-top: 18px;
  display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.hd-hotline { font-size: 18px; font-weight: 700; margin-top: 4px; }

@media (max-width: 640px) {
  .hd-section { grid-template-columns: 1fr; }
  .hd-rail { text-align: left; font-size: 13px; letter-spacing: .1em; padding: 0 0 4px; }
}

@media print {
  .ant-layout-sider, .ant-layout-header, .ant-layout-footer { display: none !important; }
  .ant-layout-content { margin: 0 !important; overflow: visible !important; }
  .ant-layout { height: auto !important; overflow: visible !important; }
  .hd-toolbar .ant-btn { display: none !important; }
  .hd-root, .hd-root .ant-card-body { box-shadow: none !important; border: none !important; padding: 0 !important; }
  .hd-faq .ant-collapse-content { display: block !important; height: auto !important; }
  .hd-faq .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow { display: none !important; }
  .hd-section, .hd-note, .hd-auto, .hd-step { page-break-inside: avoid; }
  .hd-body h2 { page-break-after: avoid; }
  body { font-size: 11pt; }
}
      `}</style>
    </Card>
  )
}
