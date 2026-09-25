import { useMemo } from 'react'
import { Card, Typography, Table, Tag, Button, Collapse, Alert } from 'antd'
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
      render: (v: string, r: any) => r.isGroup ? <Text strong style={{ color: '#2563eb' }}>{v}</Text> : v,
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

  const buocChuyen = [
    {
      so: 1, ai: 'Trường có người chuyển đi', tieuDe: 'Lập đề nghị chuyển',
      noiDung: <>Chọn viên chức, trường đến, ngày chuyển và lý do (số quyết định điều động). Bấm <b>Lưu &amp; Trình duyệt</b>.</>,
      chip: <><Tag>Bản nháp</Tag> <Text type="secondary">→</Text> <Tag color="processing">Chờ Quản trị duyệt</Tag></>,
    },
    {
      so: 2, ai: 'Quản trị hệ thống', tieuDe: 'Duyệt và chuyển hồ sơ',
      noiDung: <>Quản trị duyệt phiếu. Hệ thống <b>tách hồ sơ</b>: trường đi giữ lại hồ sơ cũ với trạng thái <i>Chuyển đi</i>; trường đến có <b>hồ sơ mới</b> trạng thái <i>Chuyển đến</i>, mang theo ngạch, bậc, hệ số và phụ cấp. Cả hai hồ sơ đều ghi vào Lịch sử biến động.</>,
      chip: <Tag color="warning">Chờ trường đến tiếp nhận</Tag>,
    },
    {
      so: 3, ai: 'Trường tiếp nhận', tieuDe: 'Phân công và ghi ngày về đơn vị', cuoi: true,
      noiDung: <>Trường đến bấm <b>Tiếp nhận</b>, chọn vị trí việc làm, chức vụ và <b>thời điểm về đơn vị</b>. Hồ sơ trở lại trạng thái <i>Đang làm việc</i>.</>,
      chip: <Tag color="success">Đã hoàn tất</Tag>,
    },
  ]

  return (
    <Card className="hd-root">
      <div className="hd-toolbar">
        <div>
          <div className="hd-brand">
            <div className="hd-logo">GV</div>
            <div>
              <Title level={3} style={{ margin: 0, fontWeight: 700 }}>Sổ tay Kế toán trường</Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                Hướng dẫn sử dụng Hệ thống Quản lý Viên chức &amp; Lao động
              </Text>
            </div>
          </div>
        </div>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In tài liệu</Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 28, borderRadius: 8 }}
        title="Dữ liệu viên chức đã được nhập sẵn từ bảng lương tháng 6/2026"
        description="Năm việc chính: (1) rà soát, hoàn thiện hồ sơ nhân sự; (2) xử lý các hồ sơ lệch ngạch – bậc – hệ số ở trang Rà soát; (3) không tự sửa hệ số lương và phụ cấp — mọi điều chỉnh đi qua phiếu đề xuất, được phê duyệt là hệ thống tự ghi vào hồ sơ; (4) chuyển trường trong phường đi qua phiếu chuyển công tác; (5) người chuyển ra ngoài phường, nghỉ hưu, thôi việc thì đổi trạng thái công tác, không xoá hồ sơ."
      />

      {/* ── Mục lục ── */}
      <div className="hd-toc">
        <div className="hd-toc-title">Nội dung</div>
        <ol>
          <li><a href="#hd-s1">Đăng nhập hệ thống</a></li>
          <li><a href="#hd-s2">Rà soát và hoàn thiện hồ sơ nhân sự</a></li>
          <li><a href="#hd-s3">Nguyên tắc về hệ số lương và phụ cấp</a></li>
          <li><a href="#hd-s4">Quy trình đề xuất điều chỉnh</a></li>
          <li><a href="#hd-s5">Hướng dẫn lập phiếu đề xuất</a></li>
          <li><a href="#hd-s6">Chuyển công tác, chuyển đi, nghỉ hưu</a></li>
          <li><a href="#hd-s7">Rà soát ngạch – bậc – hệ số</a></li>
          <li><a href="#hd-s8">Theo dõi và tra cứu</a></li>
          <li><a href="#hd-s9">Câu hỏi thường gặp</a></li>
        </ol>
      </div>

      {/* ── I ── */}
      <div id="hd-s1" />
      <Section
        so="I"
        tieuDe="Đăng nhập hệ thống"
        moTa="Mỗi trường được cấp hai tài khoản: một cho Kế toán (KT) và một cho Hiệu trưởng (HT). Tài khoản Kế toán là tài khoản trực tiếp nhập liệu và lập phiếu đề xuất."
      >
        <h3>Cách đăng nhập</h3>
        <ol>
          <li>Mở trình duyệt, vào địa chỉ hệ thống. Trang đăng nhập hiển thị hai phần: bên trái là bảng hiệu hệ thống, bên phải là ô nhập tài khoản.</li>
          <li>Nhập <b>Tên đăng nhập</b> và <b>Mật khẩu</b> đã được cấp, bấm <b>Đăng nhập</b>.</li>
          <li>Sau khi vào, thanh điều hướng bên trái (nền xanh) hiển thị các chức năng theo quyền tài khoản.</li>
        </ol>

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
          Mật khẩu được cung cấp riêng cho từng trường, không hiển thị trên màn hình đăng nhập.
          Sau khi đăng nhập lần đầu, bấm vào <b>tên người dùng</b> ở góc trên bên phải → <b>Thông tin tài khoản</b> để đổi mật khẩu.
        </Paragraph>

        <KhungLuuY nhan="Lưu ý bảo mật">
          <ul>
            <li>Hệ thống <b>tự động đăng xuất sau 10 phút</b> không có thao tác. Đây là quy định bảo vệ dữ liệu nhân sự, không phải lỗi — chỉ cần đăng nhập lại và tiếp tục.</li>
            <li>Tài khoản Kế toán chỉ nhìn thấy và chỉ sửa được hồ sơ <b>thuộc trường mình</b>. Hồ sơ thêm mới luôn được gán vào trường của tài khoản — không cần chọn đơn vị.</li>
            <li>Mọi thao tác thêm, sửa, xóa đều được ghi vào nhật ký hệ thống kèm tên người thực hiện và thời điểm.</li>
          </ul>
        </KhungLuuY>
      </Section>

      {/* ── II ── */}
      <div id="hd-s2" />
      <Section
        so="II"
        tieuDe="Rà soát và hoàn thiện hồ sơ nhân sự"
        moTa="Toàn bộ danh sách viên chức và người lao động đã được nhập sẵn từ bảng lương tháng 6/2026 của từng trường. Việc của Kế toán giai đoạn này là đối chiếu và bổ sung những thông tin mà bảng lương không có."
      >
        <h3>Cách mở và sửa một hồ sơ</h3>
        <ol>
          <li>Bấm mục <b>Hồ sơ nhân sự</b> trên thanh điều hướng bên trái.</li>
          <li>Bấm vào <b>họ tên</b> để mở trang chi tiết.</li>
          <li>Bấm nút <b>Chỉnh sửa</b>, cập nhật thông tin rồi <b>Lưu</b>.</li>
        </ol>
        <Paragraph>
          Danh sách <b>mặc định chỉ hiện người đang công tác</b> (Đang làm việc, Chuyển đến). Muốn xem lại hồ sơ
          đã chuyển đi, nghỉ hưu hoặc thôi việc, chọn ở ô lọc <b>Trạng thái</b> (có cả lựa chọn <i>Tất cả trạng thái</i>).
          Người mới thì bấm <b>Thêm hồ sơ nhân sự</b>.
        </Paragraph>
        <Paragraph>
          Có thể bấm vào tiêu đề bất kỳ cột nào để sắp xếp danh sách — ví dụ sắp theo <b>Ngày sinh</b> để tìm nhanh những hồ sơ chưa có ngày sinh.
        </Paragraph>

        <h3>Hai quy ước áp dụng cho mọi danh sách</h3>
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 190 }}>Quy ước</th><th>Hệ thống thực hiện</th></tr></thead>
            <tbody>
              <tr>
                <td><b>Họ tên luôn IN HOA</b></td>
                <td>
                  Gõ thường hay gõ hoa đều được — hệ thống tự chuyển sang IN HOA khi lưu và khi
                  hiển thị. Toàn bộ hồ sơ đã nhập trước đây cũng đã được chuẩn hoá.
                  Kế toán <b>không phải tự gõ hoa</b>.
                </td>
              </tr>
              <tr>
                <td><b>Thứ tự: CBQL – Giáo viên – Nhân viên</b></td>
                <td>
                  Mọi danh sách viên chức đều xếp cán bộ quản lý trước, rồi giáo viên, cuối cùng
                  nhân viên. Trong từng nhóm xếp theo chức vụ (Hiệu trưởng, Phó Hiệu trưởng,
                  Tổ trưởng, Tổ phó) rồi đến tên A→Z — đúng thứ tự bảng lương quen dùng.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Paragraph type="secondary" style={{ fontSize: 13.5 }}>
          Vì thứ tự này lấy theo <b>Vị trí việc làm</b> và <b>Chức vụ</b> trong hồ sơ, hai mục đó khai
          sai sẽ khiến người đó đứng nhầm nhóm. Đây là lý do cần rà kỹ hai trường này.
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
                <td>
                  Loại hình lao động <i className="hd-req">*</i> (chọn trước tiên), Vị trí việc làm <i className="hd-req">*</i>, Chức vụ,
                  Công việc cụ thể <i className="hd-req">*</i> (khi Vị trí việc làm là <i>Nhân viên</i>),
                  Mã ngạch/Hạng <i className="hd-req">**</i>, Nguồn kinh phí <i className="hd-req">**</i>,
                  Trạng thái công tác <i className="hd-req">*</i>, Ngày chuyển đi (khi trạng thái là <i>Chuyển đi</i>)
                </td>
                <td>Đã có, cần đối chiếu</td>
              </tr>
              <tr>
                <td><b>Mốc thời gian</b></td>
                <td>Ngày vào ngành <i className="hd-req">*</i>, Ngày vào đơn vị <i className="hd-req">*</i>, Ngày vào biên chế <i className="hd-req">**</i></td>
                <td>Kế toán bổ sung</td>
              </tr>
              <tr>
                <td><b>Trình độ</b></td>
                <td>Trình độ chuyên môn nghiệp vụ, Nhiệm vụ chính, Trình độ khác</td>
                <td>Kế toán bổ sung</td>
              </tr>
              <tr>
                <td><b>Lương &amp; phụ cấp</b></td>
                <td>Viên chức biên chế: Bậc lương <i className="hd-req">**</i>, Hệ số lương, Mốc hưởng lương. Hợp đồng: chọn <b>Hình thức nhận lương</b> — theo bậc, hệ số hoặc theo mức tiền. Mốc hưởng PCTN, các khoản phụ cấp</td>
                <td>Từ bảng lương T6/2026</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Paragraph type="secondary" style={{ fontSize: 13 }}>
          <i className="hd-req">*</i> Bắt buộc với mọi hồ sơ. <i className="hd-req">**</i> Chỉ bắt buộc với <b>viên chức biên chế</b> — trên màn
          hình các ô này có nhãn xanh <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 0 }}>VC biên chế</Tag>.
        </Paragraph>

        <h3>Viên chức biên chế và các loại hình hợp đồng</h3>
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 150 }}></th><th>Viên chức biên chế</th><th>Hợp đồng (NĐ 235/2026, trường tự ký, xác định thời hạn, thỉnh giảng, khác)</th></tr></thead>
            <tbody>
              <tr>
                <td><b>Mã ngạch/Hạng</b></td>
                <td>Bắt buộc</td>
                <td>Không bắt buộc. Chưa có mã ngạch thì hồ sơ được xếp theo Vị trí việc làm</td>
              </tr>
              <tr>
                <td><b>Nguồn kinh phí, ngày vào biên chế</b></td>
                <td>Bắt buộc</td>
                <td>Không khai (ô bị ẩn). Trên trang Vị trí việc làm, mọi hợp đồng được đếm vào cột <b>HĐ</b></td>
              </tr>
              <tr>
                <td><b>Lương</b></td>
                <td>Luôn theo ngạch, bậc, hệ số</td>
                <td>
                  Chọn <b>Hình thức nhận lương</b>: <i>Theo bậc lương, hệ số</i> hoặc <i>Theo mức tiền (VNĐ/tháng)</i>.
                  Chọn theo mức tiền thì nhập số tiền mỗi tháng; bậc, hệ số bị ẩn
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Paragraph type="secondary" style={{ fontSize: 13.5 }}>
          Người nhận lương theo mức tiền hiện ở cột riêng <b>Lương theo mức tiền (đ/tháng)</b> trên Bảng tổng hợp lương,
          không tính vào tổng hệ số, không nằm trong danh sách nâng bậc lương. Phụ cấp tính theo % lương chính không
          áp dụng cho họ; phụ cấp dạng hệ số (nếu có) vẫn được tính. Loại hình <i>Hợp đồng NĐ 111</i> đã bỏ, không chọn được nữa.
        </Paragraph>

        <h3>Danh mục việc cần làm</h3>
        <ol className="hd-todo">
          <li>Đối chiếu tổng số viên chức trên hệ thống với danh sách thực tế của trường.</li>
          <li>Bổ sung <b>ngày sinh</b> cho những hồ sơ còn trống (một số trường hợp bảng lương không ghi ngày sinh).</li>
          <li>Kiểm tra <b>Ngày vào ngành</b> — đây là căn cứ tính phụ cấp thâm niên nhà giáo.</li>
          <li>Bổ sung <b>số CCCD</b> và <b>số điện thoại</b> liên hệ.</li>
          <li>Bổ sung <b>trình độ chuyên môn nghiệp vụ</b> và trình độ khác (lý luận chính trị, tin học, ngoại ngữ…).</li>
          <li>Kiểm tra <b>Vị trí việc làm</b> và <b>Chức vụ</b> đúng thực tế (Hiệu trưởng, Phó Hiệu trưởng, Tổ trưởng chuyên môn, giáo viên, nhân viên).</li>
          <li>Với nhân viên: kiểm tra <b>Công việc cụ thể</b> (kế toán, văn thư, thư viện, thiết bị, giáo vụ, y tế, tư vấn học sinh, bảo vệ, lao công, cấp dưỡng…). Hệ thống đã tự điền trước theo nhiệm vụ chính — sửa lại nếu chưa đúng. Ô này quyết định người đó thuộc nhóm <i>chuyên môn – hỗ trợ</i>, <i>phục vụ</i> hay <i>nuôi dưỡng</i> trên trang Tổng quan.</li>
          <li>Rà soát <b>Trạng thái công tác</b>: người đã chuyển ra ngoài phường, nghỉ hưu hoặc thôi việc phải đổi trạng thái, <i>không xóa hồ sơ</i> (xem mục VI).</li>
          <li>Với người hợp đồng: chọn đúng <b>Hình thức nhận lương</b>; lương khoán theo tháng thì chọn <i>Theo mức tiền</i> và nhập số tiền.</li>
          <li>Mở trang <b>Rà soát ngạch – bậc</b> và xử lý hết các hồ sơ trường mình còn trong danh sách (xem mục VII).</li>
          <li>Đối chiếu <b>Bảng tổng hợp lương</b> trên hệ thống với bảng lương giấy tháng 6/2026 — báo lại nếu có sai lệch.</li>
        </ol>

        <KhungLuuY nhan="Không xóa hồ sơ">
          <p>
            Viên chức nghỉ hưu, chuyển công tác hoặc thôi việc <b>vẫn giữ nguyên hồ sơ</b> trên hệ thống.
            Chỉ đổi mục <b>Trạng thái công tác</b> sang <i>Nghỉ hưu</i>, <i>Chuyển đi</i> hoặc <i>Thôi việc</i>.
          </p>
          <p>
            Người đã đổi sang ba trạng thái này <b>không còn được tính</b> vào Bảng tổng hợp lương, trang Hệ số lương,
            Phụ cấp, Báo cáo, Tổng quan, Vị trí việc làm và danh sách lập phiếu đề xuất; cũng ẩn khỏi danh sách hồ sơ mặc định.
            Lịch sử lương và phụ cấp vẫn được lưu, xem lại qua ô lọc Trạng thái.
          </p>
        </KhungLuuY>
      </Section>

      {/* ── III ── */}
      <div id="hd-s3" />
      <Section
        so="III"
        tieuDe="Nguyên tắc về hệ số lương và phụ cấp"
        moTa="Đây là điểm khác biệt lớn nhất so với cách làm trên file Excel. Xin đọc kỹ phần này trước khi thao tác."
      >
        <KhungLuuY nhan="Quy định bắt buộc">
          <p><b>Kế toán không tự sửa hệ số lương, bậc lương và phụ cấp trực tiếp trong hồ sơ.</b></p>
          <p>
            Tài khoản Kế toán được cấp quyền <i>chỉ xem</i> đối với dữ liệu lương. Mọi thay đổi phải
            đi qua phiếu đề xuất và được Phòng Văn hóa – Xã hội thẩm định.
          </p>
        </KhungLuuY>

        <h3>Vì sao phải làm như vậy</h3>
        <div className="hd-reasons">
          <div className="hd-reason">
            <div className="hd-reason-num">1</div>
            <div>
              <b>Mỗi thay đổi đều có căn cứ.</b> Hệ số lương gắn với một phiếu đề xuất đã được phê duyệt,
              tra ngược lại được ai đề nghị, ai duyệt, ngày nào.
            </div>
          </div>
          <div className="hd-reason">
            <div className="hd-reason-num">2</div>
            <div>
              <b>Có lịch sử biến động.</b> Hệ thống tự ghi lại "Bậc 3 – Hệ số 3.00 → Bậc 4 – Hệ số 3.33"
              kèm ngày hiệu lực, xem được ngay trong hồ sơ viên chức.
            </div>
          </div>
          <div className="hd-reason">
            <div className="hd-reason-num">3</div>
            <div>
              <b>Số liệu 11 trường thống nhất.</b> Bảng tổng hợp lương toàn phường và các báo cáo gửi cấp trên
              luôn khớp nhau vì cùng lấy từ một nguồn.
            </div>
          </div>
          <div className="hd-reason">
            <div className="hd-reason-num">4</div>
            <div>
              <b>Giảm việc cho Kế toán.</b> Sau khi phiếu được phê duyệt, hệ thống tự cập nhật vào hồ sơ —
              không phải nhập lại lần thứ hai.
            </div>
          </div>
        </div>

        <h3>Các khoản phụ cấp trên hệ thống</h3>
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 220 }}>Khoản</th><th>Cách tính, ghi chú</th></tr></thead>
            <tbody>
              <tr><td><b>PC thâm niên vượt khung</b></td><td>% lương chính. Hưởng khi đã ở bậc cuối của bảng đủ 36 tháng (loại A) hoặc 24 tháng (loại B, C): 5%, mỗi năm sau +1%.</td></tr>
              <tr><td><b>PC chức vụ</b></td><td>Hệ số, tự tính theo loại trường × hạng trường × chức vụ (TT 33/2005) khi khai chức vụ trong hồ sơ. Bỏ chức vụ thì dòng phụ cấp này tự được gỡ.</td></tr>
              <tr>
                <td><b>Bảo lưu PC chức vụ</b><br /><Text type="secondary" style={{ fontSize: 12.5 }}>NĐ 178/2024, NĐ 67/2025</Text></td>
                <td>
                  Hiệu trưởng xuống Phó hiệu trưởng, Phó hiệu trưởng xuống giáo viên <b>do sắp xếp tổ chức bộ máy</b>: hưởng
                  <b> nguyên mức PC chức vụ cũ</b> đến hết thời hạn bổ nhiệm chức vụ cũ; còn dưới 6 tháng thì được 6 tháng.
                  Cách khai: sửa hồ sơ, đổi chức vụ — hệ thống hiện khung vàng <i>Bảo lưu phụ cấp chức vụ</i>; bật lên, nhập số, ngày quyết định
                  và ngày hết hạn bổ nhiệm cũ. Hệ thống tự tính ngày hết bảo lưu, áp mức cũ trên Bảng tổng hợp lương (nhãn <Tag color="gold" style={{ fontSize: 10 }}>BL</Tag>),
                  dùng mức này làm nền tính PC thâm niên, ưu đãi, và <b>tự chuyển về mức mới khi hết hạn</b>.
                </td>
              </tr>
              <tr><td><b>PC trách nhiệm công việc</b></td><td>Hệ số theo vị trí, VD kế toán 0,2 — nhập theo quyết định.</td></tr>
              <tr><td><b>PC thâm niên nhà giáo</b></td><td>% lương chính, chỉ <b>CBQL và giáo viên</b>: 5% khi đủ 5 năm, mỗi năm +1%. <b>Vẫn giữ nguyên</b>, hưởng song song với PC ưu đãi nhà giáo.</td></tr>
              <tr><td><b>Hệ số chênh lệch bảo lưu</b></td><td>Nhập <b>giá trị hệ số</b> (VD <i>0,33</i>), <b>không nhập %</b>. Nhập từ 5 trở lên hệ thống sẽ báo lỗi. Cộng thẳng vào tổng hệ số lương.</td></tr>
              <tr>
                <td><b>PC ưu đãi nhà giáo</b><br /><Text type="secondary" style={{ fontSize: 12.5 }}>NĐ 182/2026, từ 01/01/2026</Text></td>
                <td>
                  % lương chính, chọn theo cấp học: <b>mầm non, tiểu học 45%</b> · <b>THCS 40%</b> · <b>nhân viên (nhân sự hỗ trợ giáo dục) 20%</b>.
                  Toàn bộ hồ sơ đã được chuyển từ mức cũ QĐ 244 (35%, 30%) sang mức mới, hiệu lực 01/01/2026, có ghi Lịch sử biến động.
                  Hai mức cũ vẫn còn trong danh mục (nhãn <i>Mức cũ</i>) chỉ để tra lịch sử — không chọn cho hồ sơ mới.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Mã chức danh cũ</h3>
        <Paragraph>
          Một số người còn giữ mã chức danh trước TT 01, 02/2021. Trên hệ thống các mã này ghi rõ <b>(mã cũ)</b> và dùng đúng bảng lương:
        </Paragraph>
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 130 }}>Mã</th><th>Chức danh</th><th style={{ width: 230 }}>Bảng lương</th></tr></thead>
            <tbody>
              <tr><td>V.07.03.07</td><td>Giáo viên tiểu học hạng II (mã cũ)</td><td>A1 — 9 bậc, 2,34 – 4,98, 3 năm/bậc</td></tr>
              <tr><td>V.07.03.08</td><td>Giáo viên tiểu học hạng III (mã cũ)</td><td>A0 — 10 bậc, 2,10 – 4,89, 3 năm/bậc</td></tr>
              <tr><td>V.07.03.09</td><td>Giáo viên tiểu học hạng IV (mã cũ)</td><td>B — 12 bậc, 1,86 – 4,06, 2 năm/bậc</td></tr>
              <tr><td>V.07.02.06</td><td>Giáo viên mầm non hạng IV (mã cũ)</td><td>B — 12 bậc, 1,86 – 4,06, 2 năm/bậc</td></tr>
            </tbody>
          </table>
        </div>
        <Paragraph type="secondary" style={{ fontSize: 13.5 }}>
          Giáo viên chưa đạt chuẩn trình độ (VD trình độ trung cấp) giữ mã hạng IV và bảng lương loại B cho đến khi đạt chuẩn.
          Người đã ở <b>bậc cuối</b> của bảng không nâng bậc nữa mà chuyển sang phụ cấp thâm niên vượt khung.
        </Paragraph>

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
                  Trạng thái công tác, ngày chuyển đi<br />
                  Hình thức nhận lương, mức lương theo tiền (hợp đồng)
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
      <div id="hd-s4" />
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
            <li>Tính sẵn <b>ngày nâng bậc lương kế tiếp</b> từ ngày hiệu lực trên phiếu.</li>
            <li>Cập nhật lại hồ sơ viên chức và mã ngạch nếu phiếu có chuyển ngạch.</li>
            <li>Ghi một dòng vào <b>Lịch sử biến động</b> của viên chức, gắn với mã phiếu đề xuất.</li>
          </ol>
        </div>

        <KhungLuuY nhan="Kế toán không phải làm gì thêm" ok>
          <p>
            Sau khi phiếu chuyển sang trạng thái <b>Đã phê duyệt</b>, hệ số lương và phụ cấp mới đã nằm trong
            hồ sơ và đã hiển thị trên Bảng tổng hợp lương. <b>Không cần vào sửa lại hồ sơ.</b> Nếu
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
      <div id="hd-s5" />
      <Section
        so="V"
        tieuDe="Hướng dẫn lập phiếu đề xuất"
        moTa="Vào menu Đề xuất điều chỉnh Hệ số lương – PCTN trên thanh điều hướng, bấm nút tạo phiếu mới. Một phiếu có thể gồm nhiều viên chức cùng đợt, không cần lập riêng từng người."
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
      <div id="hd-s6" />
      <Section
        so="VI"
        tieuDe="Chuyển công tác, chuyển đi, nghỉ hưu"
        moTa="Chuyển sang trường khác trong phường thì đi qua phiếu chuyển công tác: Quản trị duyệt, trường đi giữ hồ sơ Chuyển đi, trường đến có hồ sơ mới. Chuyển ra ngoài phường/tỉnh, nghỉ hưu, thôi việc thì không lập phiếu — chỉ đổi trạng thái trong hồ sơ."
      >
        <div className="hd-flow">
          {buocChuyen.map((b) => (
            <div key={b.so} className={b.cuoi ? 'hd-step hd-step-final' : 'hd-step'}>
              <div className="hd-dot">{b.so}</div>
              <span className="hd-who">{b.ai}</span>
              <h4>{b.tieuDe}</h4>
              <p>{b.noiDung}</p>
              <p><Text type="secondary" style={{ fontSize: 13, marginRight: 6 }}>Trạng thái:</Text>{b.chip}</p>
            </div>
          ))}
        </div>

        <KhungLuuY nhan="Lương giữ nguyên khi chuyển" ok>
          <p>
            Ngạch, bậc, hệ số lương, mốc hưởng lương và toàn bộ khoản phụ cấp được <b>chép sang hồ sơ mới</b>
            ở trường đến, không phải khai lại. Hồ sơ cũ ở trường đi vẫn giữ mức lương tại thời điểm chuyển đi để tra cứu.
            Trường tiếp nhận chỉ điền: vị trí việc làm, chức vụ, vị trí cụ thể tại trường và thời điểm về đơn vị.
          </p>
        </KhungLuuY>

        <h3>Trường có người chuyển đi cần biết</h3>
        <ul>
          <li>Vào menu <b>Chuyển công tác</b> → <b>Đề nghị chuyển đi</b>. Danh sách chỉ hiện viên chức của trường mình.</li>
          <li>Một người đang có phiếu chuyển dở dang sẽ không hiện lại trong danh sách, tránh lập trùng phiếu.</li>
          <li><b>Không xoá hồ sơ</b> người chuyển đi. Khi Quản trị duyệt, hồ sơ ở trường mình chuyển sang trạng thái <i>Chuyển đi</i> kèm ngày chuyển: không còn tính vào bảng lương, báo cáo, nhưng vẫn xem được qua ô lọc Trạng thái → <i>Chuyển đi</i>. Trang chi tiết có liên kết sang hồ sơ ở trường mới.</li>
          <li>Phiếu ở trạng thái <Tag>Bản nháp</Tag> có thể sửa hoặc xoá; đã trình thì phải chờ Quản trị xử lý.</li>
        </ul>

        <h3>Trường tiếp nhận cần biết</h3>
        <ul>
          <li>Khi Quản trị duyệt xong, phiếu hiện ở menu <b>Chuyển công tác</b> với nhãn <Tag color="warning">Chờ trường đến tiếp nhận</Tag> kèm số đếm trên tiêu đề trang.</li>
          <li>Hồ sơ mới đã nằm trong danh sách của trường, trạng thái <i>Chuyển đến</i>, mang mã hồ sơ mới.</li>
          <li>Bấm <b>Tiếp nhận</b> và điền phân công. <b>Thời điểm về đơn vị</b> được ghi vào hồ sơ làm mốc công tác tại trường. Chỉ tiếp nhận được phiếu đã được Quản trị duyệt.</li>
          <li><b>Không tự thêm hồ sơ</b> cho người chuyển đến từ trường trong phường — sẽ bị trùng hồ sơ.</li>
          <li>Vị trí việc làm cũ đã được gỡ vì thuộc trường cũ — cần chọn lại từ danh mục vị trí của trường mình.</li>
        </ul>

        <KhungLuuY nhan="Chưa tiếp nhận thì hồ sơ chưa hoàn chỉnh">
          <p>
            Người mới chuyển đến vẫn ở trạng thái <i>Chuyển đến</i> cho tới khi trường bấm Tiếp nhận.
            Trong thời gian đó, hồ sơ chưa có vị trí việc làm nên có thể đứng sai nhóm trong danh sách
            và trong bảng tổng hợp lương. Nên tiếp nhận ngay khi người đó đến nhận nhiệm vụ.
          </p>
        </KhungLuuY>

        <h3>Chuyển ra ngoài phường, ngoài tỉnh — nghỉ hưu — thôi việc</h3>
        <Paragraph>Những trường hợp này không có trường tiếp nhận trên phần mềm nên <b>không lập phiếu</b>. Kế toán tự cập nhật:</Paragraph>
        <ol>
          <li>Mở hồ sơ → <b>Chỉnh sửa</b>.</li>
          <li>Ở ô <b>Trạng thái công tác</b> chọn <i>Chuyển đi</i>, <i>Nghỉ hưu</i> hoặc <i>Thôi việc</i> (ô này có ở mọi loại hình lao động).</li>
          <li>Chọn <i>Chuyển đi</i> thì nhập thêm <b>Ngày chuyển đi</b> (bắt buộc), rồi <b>Lưu</b>.</li>
        </ol>
        <Paragraph>
          Từ lúc lưu, người đó không còn tính vào bảng lương, báo cáo số liệu thực tế và các danh sách nâng lương;
          hồ sơ vẫn giữ nguyên để tra cứu.
        </Paragraph>
      </Section>

      {/* ── VII ── */}
      <div id="hd-s7" />
      <Section
        so="VII"
        tieuDe="Rà soát ngạch – bậc – hệ số"
        moTa="Menu Rà soát ngạch – bậc (ngay dưới Bảng tổng hợp lương) liệt kê những hồ sơ đang công tác có mã ngạch, bậc, hệ số chưa khớp danh mục bảng lương. Hệ thống không tự sửa — trường đối chiếu quyết định xếp lương rồi vào hồ sơ để sửa."
      >
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 210 }}>Vấn đề</th><th>Nghĩa là</th><th style={{ width: 250 }}>Cách xử lý</th></tr></thead>
            <tbody>
              <tr><td><Tag color="orange">Hệ số không khớp bảng</Tag></td><td>Hệ số đang ghi khác hệ số của bậc đó trong bảng lương của mã ngạch.</td><td>Xem cột <b>Gợi ý</b>: nếu hệ số khớp bảng/bậc khác thì thường là <b>sai mã ngạch</b> hoặc <b>sai bậc</b> — sửa theo quyết định.</td></tr>
              <tr><td><Tag color="volcano">Bậc vượt bảng lương</Tag></td><td>Bậc lớn hơn số bậc của bảng lương mã đó.</td><td>Kiểm tra lại mã ngạch — thường là mã đang gán sai bảng.</td></tr>
              <tr><td><Tag color="red">Chưa có mã ngạch</Tag></td><td>Viên chức biên chế chưa khai mã ngạch/hạng.</td><td>Sửa hồ sơ, chọn mã ngạch/hạng.</td></tr>
              <tr><td><Tag color="red">Chưa có bậc, hệ số</Tag></td><td>Hồ sơ chưa có lương đang hưởng.</td><td>Viên chức: khai bậc lương. Hợp đồng lương khoán: chọn <i>Theo mức tiền</i> và nhập số tiền.</td></tr>
              <tr><td><Tag color="magenta">Có PC chức vụ nhưng không có chức vụ</Tag></td><td>Đang hưởng PC chức vụ mà hồ sơ không ghi chức vụ, không có bảo lưu.</td><td>Khai chức vụ (tổ trưởng, tổ phó…); nếu đã thôi chức vụ do sắp xếp thì khai bảo lưu, không thì gỡ phụ cấp.</td></tr>
              <tr><td><Tag color="geekblue">Sắp hết bảo lưu PC chức vụ</Tag></td><td>Còn 60 ngày trở xuống là hết bảo lưu.</td><td>Chỉ để biết trước — hết hạn hệ thống tự chuyển mức, không cần sửa.</td></tr>
              <tr><td><Tag color="cyan">Chưa chọn công việc cụ thể</Tag></td><td>Nhân viên chưa chọn công việc (kế toán, bảo vệ, cấp dưỡng…).</td><td>Sửa hồ sơ, chọn <b>Công việc cụ thể</b>.</td></tr>
              <tr><td><Tag color="gold">Lương ghi theo mã khác</Tag></td><td>Bản ghi lương gắn mã ngạch khác mã đang ghi trong hồ sơ.</td><td>Xác định mã đúng, sửa lại mã ngạch trong hồ sơ.</td></tr>
              <tr><td><Tag color="purple">Tên lỗi font (TCVN3)</Tag></td><td>Họ tên còn ký tự bảng mã cũ, VD <i>NGUYÔN THÞ</i>.</td><td>Gõ lại họ tên bằng Unicode.</td></tr>
            </tbody>
          </table>
        </div>
        <ul>
          <li>Bấm các nhãn đếm phía trên bảng để lọc nhanh theo từng loại vấn đề; bấm <b>họ tên</b> để mở hồ sơ.</li>
          <li>Bấm <b>Xuất Excel</b> để lấy danh sách gửi đối chiếu.</li>
          <li>Người nhận lương theo mức tiền chỉ được kiểm tra họ tên và công việc cụ thể; người đã chuyển đi, nghỉ hưu, thôi việc không thuộc diện rà soát.</li>
          <li>Sửa xong, hồ sơ tự biến khỏi danh sách. Mục tiêu: trường mình <b>không còn hồ sơ nào</b> trong trang này.</li>
        </ul>
      </Section>

      {/* ── VIII ── */}
      <div id="hd-s8" />
      <Section so="VIII" tieuDe="Theo dõi và tra cứu">
        <Paragraph style={{ marginBottom: 16 }}>
          Sau khi đăng nhập, trang <b>Tổng quan</b> hiển thị các thẻ thông tin nhanh (tổng lao động, đề xuất đang xử lý,
          sắp nâng lương, dự báo nghỉ hưu) và phần <b>Cơ cấu nhân sự</b>, lọc được theo cấp học:
        </Paragraph>
        <ul>
          <li><b>5 thẻ nhóm vị trí</b>, không trùng nhau và cộng lại bằng tổng lao động: Cán bộ quản lý · Giáo viên · Nhân viên chuyên môn – hỗ trợ · Nhân viên phục vụ · Nhân viên nuôi dưỡng. Mỗi thẻ ghi số biên chế và hợp đồng.</li>
          <li><b>Bảng cơ cấu</b> nhóm vị trí × loại hình (Biên chế · HĐ NĐ 235 · HĐ trường tự ký · HĐ khác). <b>Bấm vào một số</b> để mở ngay danh sách hồ sơ tương ứng.</li>
          <li><b>Biểu đồ nhân sự theo trường</b>, chia màu theo 5 nhóm, để thấy trường nào thiếu hoặc thừa nhóm nào.</li>
        </ul>
        <Paragraph>Các chức năng trên thanh điều hướng:</Paragraph>
        <div className="hd-tw">
          <table className="hd-table">
            <thead><tr><th style={{ width: 250 }}>Menu</th><th>Dùng để làm gì</th></tr></thead>
            <tbody>
              <tr><td><b>Tổng quan</b></td><td>Số liệu nhanh, cơ cấu nhân sự theo nhóm vị trí và loại hình, biểu đồ theo trường, số phiếu đề xuất đang xử lý. Thẻ "Sắp nâng lương" hiện số viên chức cần lập phiếu trong 90 ngày tới.</td></tr>
              <tr><td><b>Hồ sơ nhân sự</b></td><td>Danh sách và chi tiết từng người, kèm lịch sử biến động lương – phụ cấp. Xuất/nhập Excel (có cột Hình thức lương, Mức lương theo tiền).</td></tr>
              <tr><td><b>Bảng tổng hợp lương</b></td><td>Bảng lương theo mẫu quen thuộc, có dòng cộng của từng trường và dòng tổng cuối bảng; lọc theo loại hình lao động; cột riêng cho người nhận lương theo mức tiền. Chỉ tính người đang công tác. Bấm <b>Xuất Excel</b> để lấy file đối chiếu.</td></tr>
              <tr><td><b>Rà soát ngạch – bậc</b></td><td>Danh sách hồ sơ lệch mã ngạch, bậc, hệ số cần trường xử lý (mục VII).</td></tr>
              <tr><td><b>Đề xuất điều chỉnh HSL – PCTN</b></td><td>Danh sách phiếu đã lập và trạng thái xử lý từng phiếu.</td></tr>
              <tr><td><b>Chuyển công tác</b></td><td>Lập đề nghị chuyển đi và tiếp nhận người chuyển đến. Số phiếu đang chờ hiện ngay trên tiêu đề trang.</td></tr>
              <tr><td><b>Dự báo nghỉ hưu</b></td><td>Danh sách viên chức sắp đến tuổi nghỉ hưu (theo Nghị định 135/2020) để chủ động bố trí nhân sự.</td></tr>
              <tr><td><b>Báo cáo</b></td><td>Các biểu tổng hợp phục vụ báo cáo cấp trên, lọc theo đơn vị và loại hình lao động.</td></tr>
            </tbody>
          </table>
        </div>
        <Paragraph>
          Ở các bảng danh sách, bấm vào <b>tiêu đề cột</b> để sắp xếp tăng hoặc giảm dần. Trang
          <b> Hồ sơ nhân sự</b> có bộ lọc theo đơn vị, loại hình lao động và trạng thái công tác (mặc định: đang công tác).
          Ô lọc loại hình ở mọi trang chỉ gồm các loại hình đang dùng.
        </Paragraph>
        <Paragraph>
          Thanh điều hướng bên trái có thể thu gọn thành biểu tượng bằng nút ở cuối thanh, giúp mở rộng vùng hiển thị trên màn hình nhỏ.
        </Paragraph>
      </Section>

      {/* ── IX ── */}
      <div id="hd-s9" />
      <Section so="IX" tieuDe="Câu hỏi thường gặp">
        <Collapse
          ghost
          className="hd-faq"
          items={[
            {
              key: '1', label: 'Hệ số lương trên hệ thống lệch với bảng lương giấy thì xử lý thế nào?',
              children: (
                <>
                  <p>Trước hết mở trang <b>Rà soát ngạch – bậc</b>: nếu người đó có trong danh sách, cột Gợi ý thường chỉ ra ngay nguyên nhân (sai mã ngạch hoặc sai bậc) — sửa mã ngạch/bậc theo quyết định.</p>
                  <p>Nếu là mức lương thực sự thay đổi, không sửa trực tiếp mà lập phiếu đề xuất loại <b>Điều chỉnh lương</b>, ghi rõ số liệu đúng và căn cứ trong phần Ghi chú. Sai lệch ở nhiều hồ sơ thì liên hệ số hỗ trợ.</p>
                </>
              ),
            },
            {
              key: '2', label: 'Trường có viên chức mới chuyển đến, thêm vào bằng cách nào?',
              children: (
                <>
                  <p><b>Nếu chuyển từ một trường khác trong phường:</b> không tự khai lại. Trường có người chuyển đi lập phiếu ở menu <b>Chuyển công tác</b>; sau khi Quản trị duyệt, trường mình có hồ sơ mới kèm nguyên ngạch, bậc, hệ số và phụ cấp. Việc của trường tiếp nhận chỉ là bấm <b>Tiếp nhận</b> và phân công vị trí.</p>
                  <p><b>Nếu chuyển từ ngoài phường hoặc tuyển mới:</b> vào <b>Hồ sơ nhân sự</b> → <b>Thêm hồ sơ nhân sự</b>, khai đầy đủ kèm bậc và hệ số lương đang hưởng theo quyết định. Đặt <b>Trạng thái công tác</b> là <i>Chuyển đến</i>.</p>
                </>
              ),
            },
            {
              key: '2d', label: 'Viên chức chuyển sang tỉnh khác (hoặc nghỉ hưu), không có phiếu trên phần mềm thì làm gì?',
              children: <p>Sửa hồ sơ, đặt <b>Trạng thái công tác</b> là <i>Chuyển đi</i> (kèm <b>Ngày chuyển đi</b>) hoặc <i>Nghỉ hưu</i>, <i>Thôi việc</i>. Không xoá hồ sơ. Người đó tự ra khỏi bảng lương và báo cáo, hồ sơ vẫn xem lại được qua ô lọc Trạng thái.</p>,
            },
            {
              key: '2e', label: 'Người hợp đồng hưởng lương khoán theo tháng thì khai thế nào?',
              children: <p>Trong hồ sơ, phần <b>Lương &amp; Phụ cấp</b> chọn <b>Hình thức nhận lương</b>: <i>Theo mức tiền (VNĐ/tháng)</i> và nhập số tiền. Không cần khai mã ngạch, bậc. Viên chức biên chế thì luôn theo ngạch, bậc — không có lựa chọn này.</p>,
            },
            {
              key: '2f', label: 'Hệ số chênh lệch bảo lưu nhập là 33 hay 0,33?',
              children: <p>Nhập <b>0,33</b> — đây là giá trị hệ số, không phải %. Hệ thống báo lỗi nếu nhập từ 5 trở lên vào một khoản phụ cấp loại hệ số.</p>,
            },
            {
              key: '2h', label: 'Hiệu trưởng sau sắp xếp làm Phó hiệu trưởng thì phụ cấp chức vụ tính thế nào?',
              children: <p>Được bảo lưu nguyên mức PC chức vụ hiệu trưởng đến hết thời hạn bổ nhiệm hiệu trưởng (tối thiểu 6 tháng). Sửa hồ sơ, đổi chức vụ sang Phó hiệu trưởng, bật <b>Bảo lưu phụ cấp chức vụ</b> và nhập quyết định. Không sửa tay dòng PC chức vụ — hệ thống tự áp mức bảo lưu và tự hết hạn. Danh sách người đang bảo lưu hiện trên trang Tổng quan.</p>,
            },
            {
              key: '2g', label: 'Mã chức danh có chữ "(mã cũ)" là gì?',
              children: <p>Là các mã trước TT 01, 02/2021 (V.07.03.07, V.07.03.08, V.07.03.09, V.07.02.06) mà một số người vẫn giữ, VD giáo viên chưa đạt chuẩn trình độ giữ mã hạng IV. Hệ thống đã gán đúng bảng lương cho từng mã (xem mục III); không cần đổi mã nếu quyết định xếp lương vẫn ghi mã cũ.</p>,
            },
            {
              key: '2b', label: 'Vì sao tên viên chức hiển thị IN HOA, gõ chữ thường có sao không?',
              children: <p>Đây là quy định thống nhất toàn hệ thống để tên trong hồ sơ, bảng lương và các báo cáo luôn giống nhau. Kế toán gõ thường hay gõ hoa đều được — hệ thống tự chuyển khi lưu.</p>,
            },
            {
              key: '2c', label: 'Vì sao danh sách không xếp theo thứ tự A→Z?',
              children: <p>Danh sách xếp theo thứ tự nghiệp vụ: cán bộ quản lý trước, rồi giáo viên, cuối cùng nhân viên; trong mỗi nhóm mới xếp theo chức vụ rồi đến tên A→Z. Thứ tự này khớp với bảng lương quen dùng. Nếu muốn xem theo cách khác, bấm vào tiêu đề cột bất kỳ để sắp xếp lại.</p>,
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
            {
              key: '7', label: 'Làm sao thu gọn thanh menu bên trái để bảng rộng hơn?',
              children: <p>Bấm nút mũi tên ở cuối thanh điều hướng xanh bên trái. Thanh thu lại thành biểu tượng, bấm lại để mở rộng. Trên thiết bị di động thanh tự động thu gọn.</p>,
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
          <Text type="secondary" style={{ fontSize: 13 }}>Hệ thống Quản lý Viên chức &amp; Lao động ngành Giáo dục</Text>
        </div>
      </div>

      <style>{`
.hd-root { max-width: 1000px; margin: 0 auto; border-radius: 12px; }
.hd-toolbar {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
  flex-wrap: wrap; margin-bottom: 24px; padding-bottom: 20px;
  border-bottom: 3px solid #2563eb;
}
.hd-brand { display: flex; align-items: center; gap: 14px; }
.hd-logo {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  background: linear-gradient(135deg, #1e3a8a, #2563eb);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 18px; font-weight: 700;
  box-shadow: 0 2px 8px rgba(37,99,235,0.25);
}
.hd-section { display: grid; grid-template-columns: 52px minmax(0,1fr); gap: 0 20px; margin-bottom: 46px; }
.hd-rail {
  font-weight: 700; font-size: 20px; color: #2563eb; line-height: 1; padding-top: 5px;
  text-align: right; font-variant-numeric: tabular-nums;
}
.hd-body { min-width: 0; }
.hd-body h2 { font-size: 21px; font-weight: 700; line-height: 1.3; margin: 0 0 4px; }
.hd-body h3 { font-size: 15px; font-weight: 600; margin: 26px 0 10px; color: #1e293b; }
.hd-body h4 { font-size: 15px; font-weight: 600; margin: 3px 0 4px; }
.hd-lede { color: #64748b; font-size: 14.5px; margin: 0 0 18px; max-width: 70ch; line-height: 1.6; }
.hd-body p { margin: 0 0 12px; max-width: 74ch; line-height: 1.65; }
.hd-body ul, .hd-body ol { margin: 0 0 14px; padding-left: 22px; max-width: 74ch; }
.hd-body li { margin-bottom: 6px; line-height: 1.6; }
.hd-todo li { margin-bottom: 9px; }
.hd-req { color: #dc2626; font-weight: 700; font-style: normal; }

/* ── Mục lục ── */
.hd-toc {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 16px 20px; margin-bottom: 32px;
}
.hd-toc-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-bottom: 8px; }
.hd-toc ol { margin: 0; padding-left: 20px; columns: 2; column-gap: 24px; }
.hd-toc li { margin-bottom: 4px; font-size: 14px; break-inside: avoid; }
.hd-toc a { color: #2563eb; text-decoration: none; }
.hd-toc a:hover { text-decoration: underline; }

/* ── Bảng ── */
.hd-tw { overflow-x: auto; margin: 0 0 18px; }
.hd-table { border-collapse: collapse; width: 100%; font-size: 14px; min-width: 460px;
  border: 1px solid #e2e8f0; border-radius: 8px; }
.hd-table th { font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase;
  color: #64748b; text-align: left; padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0; font-weight: 600; background: #f8fafc; }
.hd-table td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: top; line-height: 1.55; }
.hd-table tr:last-child td { border-bottom: none; }
.hd-table tr:hover td { background: #f8fafc; }
.hd-grp td { background: #eff6ff !important; }

/* ── Khung lưu ý ── */
.hd-note { position: relative; border: 1px solid #dc2626; background: #fef2f2;
  padding: 20px 20px 4px; margin: 20px 0 22px; border-radius: 8px; }
.hd-note::before { content: attr(data-label); position: absolute; top: -9px; left: 14px;
  background: #fef2f2; padding: 0 8px; font-weight: 700; font-size: 10.5px;
  letter-spacing: .12em; text-transform: uppercase; color: #dc2626; }
.hd-note p:last-child { margin-bottom: 16px; }
.hd-note ul { margin-bottom: 16px; }
.hd-note-ok { border-color: #16a34a; background: #f0fdf4; }
.hd-note-ok::before { background: #f0fdf4; color: #16a34a; }

/* ── Lý do (phần III) ── */
.hd-reasons { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 8px 0 22px; }
.hd-reason { display: flex; gap: 10px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; line-height: 1.55; }
.hd-reason-num {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  background: #eff6ff; color: #2563eb; font-weight: 700; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
}
@media (max-width: 640px) { .hd-reasons { grid-template-columns: 1fr; } }

/* ── Quy trình ── */
.hd-flow { margin: 22px 0 8px; position: relative; }
.hd-flow::before { content: ""; position: absolute; left: 15px; top: 14px; bottom: 42px;
  width: 2px; background: #e2e8f0; }
.hd-step { position: relative; padding-left: 50px; margin-bottom: 24px; }
.hd-dot { position: absolute; left: 0; top: 0; width: 32px; height: 32px; border-radius: 50%;
  background: #fff; border: 2px solid #2563eb; color: #2563eb; font-weight: 700; font-size: 14px;
  display: flex; align-items: center; justify-content: center; }
.hd-step-final .hd-dot { background: #16a34a; border-color: #16a34a; color: #fff; }
.hd-who { font-size: 11.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  color: #64748b; display: block; }
.hd-step p { margin: 0 0 8px; }

/* ── Auto box ── */
.hd-auto { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 18px 2px; margin: 18px 0 6px; background: #f8fafc; }
.hd-auto > b { font-size: 11.5px; letter-spacing: .1em; text-transform: uppercase;
  color: #16a34a; display: block; margin-bottom: 9px; }

/* ── FAQ ── */
.hd-faq .ant-collapse-header { font-weight: 600 !important; padding-left: 0 !important; }
.hd-faq .ant-collapse-content-box p { margin: 0 0 8px; }

/* ── Footer ── */
.hd-footer { border-top: 3px solid #2563eb; margin-top: 48px; padding-top: 18px;
  display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.hd-hotline { font-size: 18px; font-weight: 700; margin-top: 4px; color: #1e293b; }

@media (max-width: 640px) {
  .hd-section { grid-template-columns: 1fr; }
  .hd-rail { text-align: left; font-size: 13px; letter-spacing: .1em; padding: 0 0 4px; }
  .hd-toc ol { columns: 1; }
  .hd-brand { flex-direction: column; align-items: flex-start; gap: 8px; }
}

@media print {
  .qlvc-sidebar, .ant-layout-sider, .ant-layout-header, .ant-layout-footer { display: none !important; }
  .ant-layout-content { margin: 0 !important; overflow: visible !important; }
  .ant-layout { height: auto !important; overflow: visible !important; }
  .hd-toolbar .ant-btn { display: none !important; }
  .hd-root, .hd-root .ant-card-body { box-shadow: none !important; border: none !important; padding: 0 !important; }
  .hd-faq .ant-collapse-content { display: block !important; height: auto !important; }
  .hd-faq .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow { display: none !important; }
  .hd-section, .hd-note, .hd-auto, .hd-step { page-break-inside: avoid; }
  .hd-body h2 { page-break-after: avoid; }
  .hd-toc { page-break-after: avoid; }
  body { font-size: 11pt; }
}
      `}</style>
    </Card>
  )
}
