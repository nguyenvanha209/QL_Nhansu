import { useState } from 'react'
import type { ReactNode } from 'react'
import { Card, Typography, Tabs, Collapse, Button, Tag, Alert } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { useAuth } from '@/hooks/useAuth'
import { usePhamVi } from '@/hooks/usePhamVi'

const { Title, Text } = Typography

// Hướng dẫn sử dụng: ngắn, theo vai trò, mỗi việc là các bước "bấm gì - ở đâu".
// Tự mở đúng phần của người đang đăng nhập; mục riêng của trường học (PCTN, định mức...) chỉ hiện ở khối trường.

/** Một việc: tiêu đề + các bước đánh số + lưu ý (nếu có) */
function Viec({ ten, buoc, luuY }: { ten: string; buoc: ReactNode[]; luuY?: ReactNode }) {
  return (
    <div className="hd2-viec">
      <div className="hd2-ten">{ten}</div>
      <ol>{buoc.map((b, i) => <li key={i}>{b}</li>)}</ol>
      {luuY && <div className="hd2-luuy">{luuY}</div>}
    </div>
  )
}

const M = ({ children }: { children: ReactNode }) => <b className="hd2-menu">{children}</b>
const N = ({ children }: { children: ReactNode }) => <b className="hd2-nut">{children}</b>

export default function HuongDanPage() {
  const { currentUser, isVHXH, isLanhDao, isHieuTruong, laQuanTri } = useAuth()
  const { khoi, laTruongHocKhoi } = usePhamVi()
  const laTruong = laTruongHocKhoi // tài khoản trường, hoặc xem toàn phường
  const macDinh = isLanhDao ? 'lanh-dao' : isVHXH || laQuanTri ? 'vhxh' : isHieuTruong ? 'thu-truong' : 'can-bo'
  const [the, setThe] = useState(macDinh)
  const tenDonVi = khoi === 'CO_QUAN' ? 'phòng' : khoi === 'DVSN' ? 'đơn vị' : laTruong && khoi ? 'trường' : 'đơn vị'

  // ── Chung cho mọi người ──
  const batDau = (
    <>
      <Viec ten="Đăng nhập và đổi mật khẩu" buoc={[
        <>Đăng nhập bằng tên và mật khẩu do Phòng Văn hóa - Xã hội cấp.</>,
        <>Lần đầu: bấm tên mình ở góc trên bên phải → <M>Thông tin tài khoản</M> → <N>Đổi mật khẩu</N> (ít nhất 8 ký tự).</>,
      ]} luuY="Nhập sai mật khẩu 10 lần, tài khoản tạm khoá 15 phút. Không dùng chung tài khoản." />
      <Viec ten="Làm quen màn hình" buoc={[
        <>Menu bên trái chia theo nhóm việc. <Tag color="red" style={{ marginInlineEnd: 0 }}>Số đỏ</Tag> cạnh mục menu là việc đang chờ bạn xử lý.</>,
        <>Trang <M>Tổng quan</M> có khung <b>Việc cần làm</b>: bấm nút ở từng dòng để tới đúng chỗ cần làm.</>,
        <>Tìm nhanh người hoặc chức năng: bấm ô tìm kiếm đầu trang hoặc phím <Text keyboard>Ctrl</Text> + <Text keyboard>K</Text>.</>,
        <>Dữ liệu tự lưu lên máy chủ. Khi biểu tượng đầu trang đang báo "Đang lưu", chờ xong rồi mới đóng trang.</>,
      ]} />
    </>
  )

  // ── Cán bộ đơn vị (kế toán, người làm tổ chức) ──
  const canBo = (
    <>
      <Viec ten="1. Giữ hồ sơ nhân sự luôn đúng" buoc={[
        <><M>Hồ sơ nhân sự</M> → bấm tên người → <N>Chỉnh sửa</N>: kiểm tra, bổ sung thông tin → <N>Lưu</N>.</>,
        <>Người mới về {tenDonVi}: <M>Hồ sơ nhân sự</M> → <N>Thêm hồ sơ nhân sự</N>, khai đủ ngạch, bậc, hệ số, mốc hưởng lương và phụ cấp lần đầu.</>,
        <><M>Thông tin BHXH</M>: khai tháng bắt đầu đóng BHXH cho người còn thiếu.</>,
        <><M>Rà soát ngạch - bậc</M>: xử lý hết các dòng cảnh báo (hệ số lệch bảng lương, mốc hưởng sai...).</>,
        <>Người nghỉ hưu, thôi việc, chuyển ra ngoài phường: sửa <b>Trạng thái công tác</b> trong hồ sơ, <b>không xoá</b> hồ sơ.</>,
      ]} luuY="Bậc, hệ số, phụ cấp đã có thì không sửa trực tiếp được: muốn đổi phải lập phiếu (mục 3). Phiếu được phê duyệt, phần mềm tự ghi vào hồ sơ." />

      <Viec ten="2. Nâng lương theo kỳ 6 tháng" buoc={[
        <><M>Nâng lương{laTruong ? ', PCTN' : ''}</M> → <N>Lập phiếu</N>, chọn loại: Nâng bậc lương thường xuyên{laTruong ? ', Nâng phụ cấp thâm niên, Xếp phụ cấp thâm niên nhà giáo lần đầu' : ''}.</>,
        <>Chọn năm và kỳ (6 tháng đầu / cuối năm). Phần mềm tự liệt kê người đến hạn, kể cả người hưởng vượt khung (+1% mỗi năm).</>,
        <>Tích chọn người → <N>Thêm … đã chọn vào đề xuất</N> → kiểm tra bậc, hệ số, mốc hưởng từng người.</>,
        <><N>Lưu &amp; Trình duyệt</N>. Phiếu chuyển tới Thủ trưởng {tenDonVi} duyệt.</>,
        <>Thủ trưởng duyệt xong: bấm <N>Xuất danh sách kiểm tra (Excel)</N> trên phiếu, làm công văn đề nghị gửi qua <b>hệ thống quản lý văn bản</b>.</>,
      ]} luuY={<>Nâng lương <b>trước thời hạn</b>: cùng mục, chọn loại "Nâng bậc lương trước thời hạn" → <N>Lập hồ sơ</N>, khai thành tích, tải lên tờ trình, biên bản họp xét, quy chế, minh chứng. Làm trước nâng lương thường xuyên.</>} />

      <Viec ten="3. Điều chỉnh lương, phụ cấp" buoc={[
        <><M>Điều chỉnh lương</M> → <N>Lập phiếu điều chỉnh</N> → chọn người, nhập mức mới (phụ cấp chức vụ, trách nhiệm, hệ số...).</>,
        <>Tải lên quyết định làm căn cứ → <N>Lưu &amp; Trình duyệt</N>.</>,
      ]} />

      <Viec ten="4. Bị yêu cầu bổ sung" buoc={[
        <>Phiếu bị trả lại hiện trạng thái <Tag color="orange" style={{ marginInlineEnd: 0 }}>Yêu cầu bổ sung</Tag> kèm ý kiến.</>,
        <>Mở phiếu → <N>Sửa &amp; trình lại</N> → sửa theo ý kiến → trình lại.</>,
      ]} />

      <Viec ten="5. Sau khi có Thông báo kết quả" buoc={[
        <><M>Thông báo kết quả</M>: xem, tải danh sách để ra quyết định theo phân cấp.</>,
        <><M>Truy lĩnh</M> → chọn năm, kỳ → <N>Lập bảng truy lĩnh</N> → kiểm tra số tháng từng người → <N>Trình Trưởng phòng duyệt</N>.</>,
        <>Được duyệt: bấm <N>Xuất Excel theo mẫu</N> để in, ký.</>,
      ]} luuY={<>Bảng hiện cảnh báo vàng "chưa có trong bảng" thì bấm <N>Cập nhật từ phiếu đã phê duyệt</N> rồi <N>Lưu</N>.</>} />

      <Viec ten="6. Đăng ký lao động tiền lương" buoc={[
        <><M>Đăng ký LĐTL</M> → chọn năm, kỳ → <N>Lập đăng ký</N>: phần mềm lập danh sách hệ số lương và biểu tổng hợp từ hồ sơ.</>,
        <>Thẻ <b>Biểu tổng hợp</b>: nhập kế hoạch được duyệt kỳ trước theo văn bản đã xác nhận (kỳ trước duyệt trên phần mềm thì bấm <N>Lấy kế hoạch kỳ trước</N>), kiểm tra cột Thực hiện.</>,
        <>Thẻ <b>Danh sách hệ số lương</b>: kiểm tra từng người, ghi chú tăng, giảm → <N>Lưu</N> → <N>Trình Thủ trưởng duyệt</N>.</>,
        <>Lãnh đạo Phòng phê duyệt xong: <N>Xuất Excel theo mẫu</N>, Hiệu trưởng ký, gửi Phòng Văn hóa - Xã hội qua hệ thống quản lý văn bản.</>,
      ]} luuY={<>Hồ sơ lương thay đổi sau khi lập (nâng lương, người mới) thì bấm <N>Cập nhật từ hồ sơ</N>.</>} />

      <Viec ten="7. Chuyển công tác trong phường" buoc={[
        <><M>Chuyển công tác</M> → <N>Đề nghị chuyển đi</N>: chọn người, đơn vị đến, ngày chuyển, số quyết định → <N>Lưu &amp; Trình duyệt</N>.</>,
        <>Đơn vị đến: khi phiếu được duyệt, bấm <N>Tiếp nhận</N>, chọn vị trí, ngày về đơn vị.</>,
      ]} />

      <Viec ten="8. Bổ nhiệm và kế toán" buoc={[
        <><M>Bổ nhiệm, {laTruong ? 'kế toán' : 'chuyển đổi VT'}</M>: nhập quyết định bổ nhiệm của cán bộ quản lý (ngày, số quyết định) để phần mềm nhắc hết nhiệm kỳ.</>,
        <>Thẻ <b>Kế toán - chuyển đổi vị trí công tác</b>: nhập mốc quyết định phân công kế toán gần nhất.</>,
      ]} />

      {laTruong && (
        <Viec ten="9. Riêng trường học" buoc={[
          <>Nút <M>Thông tin trường</M> (đầu trang): khai số lớp, học sinh từng năm học - căn cứ hạng trường, phụ cấp chức vụ, định mức.</>,
          <><M>Cơ cấu VTVL, định mức</M>: xem thừa, thiếu so với định mức; phân công giáo viên.</>,
        ]} />
      )}
    </>
  )

  // ── Thủ trưởng đơn vị ──
  const thuTruong = (
    <>
      <Viec ten="Duyệt phiếu của đơn vị" buoc={[
        <>Số đỏ ở <M>Nâng lương</M>, <M>Điều chỉnh lương</M> là phiếu chờ bạn duyệt. Bấm vào để mở danh sách.</>,
        <>Mở phiếu → xem từng người (bậc, hệ số, mốc hưởng, minh chứng).</>,
        <>Đúng: <N>Duyệt - chuyển VH-XH</N>. Cần sửa: <N>Yêu cầu bổ sung</N> (ghi rõ nội dung). Không đủ điều kiện: <N>Từ chối</N>.</>,
        <>Duyệt xong mới ký công văn đề nghị gửi Phòng Văn hóa - Xã hội qua hệ thống quản lý văn bản.</>,
        <><M>Đăng ký LĐTL</M>: mở bản chờ duyệt → kiểm tra biểu tổng hợp, danh sách → <N>Duyệt - chuyển VH-XH</N> hoặc <N>Trả lại</N>.</>,
      ]} />
      <Viec ten="Theo dõi đơn vị mình" buoc={[
        <><M>Tổng quan</M>: số người, người sắp nâng lương, sắp nghỉ hưu, việc cần làm.</>,
        <><M>Bảng tổng hợp lương</M>, <M>Dự báo nghỉ hưu</M>, <M>Báo cáo</M>: xem và <N>Xuất Excel</N> khi cần.</>,
        <><M>Truy lĩnh</M>: kiểm tra bảng do cán bộ lập trước khi trình.</>,
      ]} />
    </>
  )

  // ── Phòng Văn hóa - Xã hội ──
  const vhxh = (
    <>
      <Viec ten="Chọn khối để xem" buoc={[
        <>Ô chọn khối ở đầu trang: <b>Tất cả</b> / <b>Trường học</b> / <b>Cơ quan UBND phường</b> / <b>Đơn vị sự nghiệp</b>. Danh sách, số liệu, danh mục đổi theo khối đã chọn.</>,
      ]} />
      <Viec ten="Thẩm định phiếu" buoc={[
        <><M>Nâng lương</M> hoặc <M>Điều chỉnh lương</M>: bảng tổng hợp cho biết mỗi đơn vị đang ở bước nào.</>,
        <>Mở phiếu → chọn <b>Đồng ý / Không đồng ý</b> cho từng người (khi cần) → <N>Đồng ý - trình Lãnh đạo Phòng</N> hoặc <N>Yêu cầu bổ sung</N>.</>,
      ]} />
      <Viec ten="Thông báo kết quả" buoc={[
        <><M>Thông báo kết quả</M> → chọn loại, kỳ → <N>Tổng hợp lại</N> → nhập số, ngày, người ký → <N>Ban hành</N>.</>,
        <>Tải <N>Thông báo (Word)</N> và <N>Danh sách (Excel)</N> để trình ký.</>,
      ]} />
      <Viec ten="Duyệt bảng truy lĩnh" buoc={[
        <><M>Truy lĩnh</M>: số đỏ là bảng chờ duyệt → mở bảng → <N>Duyệt</N> hoặc <N>Trả lại</N> (ghi lý do).</>,
        <>Tên Trưởng phòng ký trên biểu sửa ngay trong trang bảng truy lĩnh.</>,
        <><M>Đăng ký LĐTL</M>: số đỏ là bản chờ thẩm định → đối chiếu biên chế với chỉ tiêu được giao, hệ số với kết quả nâng lương → <N>Đồng ý - trình Lãnh đạo Phòng</N> hoặc <N>Trả lại</N>.</>,
      ]} />
      <Viec ten="Theo dõi chung" buoc={[
        <><M>Rà soát ngạch - bậc</M>, <M>Thông tin BHXH</M>: nhắc đơn vị còn sai, còn thiếu.</>,
        <><M>Bổ nhiệm, kế toán</M>: cán bộ quản lý sắp hết nhiệm kỳ; kế toán đến hạn chuyển đổi vị trí (Thông tư 159/2026/TT-BTC).</>,
        ...(laQuanTri ? [<><M>Danh mục hệ thống</M>, <M>Tài khoản người dùng</M>: thêm đơn vị, cấp tài khoản, đặt lại mật khẩu.</>] : []),
      ]} />
    </>
  )

  // ── Lãnh đạo Phòng VHXH (Trưởng phòng được ủy quyền phê duyệt) ──
  const lanhDao = (
    <>
      <Viec ten="Phê duyệt phiếu" buoc={[
        <>Số đỏ ở <M>Nâng lương</M>, <M>Điều chỉnh lương</M> là phiếu chờ phê duyệt.</>,
        <>Mở phiếu → xem ý kiến thẩm định của chuyên viên → <N>Phê duyệt</N> hoặc <N>Từ chối</N>.</>,
        <>Phê duyệt xong, phần mềm tự cập nhật lương, phụ cấp vào hồ sơ từng người.</>,
      ]} />
      <Viec ten="Duyệt truy lĩnh, phê duyệt đăng ký lao động tiền lương" buoc={[
        <>Số đỏ ở <M>Truy lĩnh</M> là bảng chờ duyệt → mở → <N>Duyệt</N> hoặc <N>Trả lại</N> (ghi lý do).</>,
        <>Số đỏ ở <M>Đăng ký LĐTL</M> là bản Phòng đã thẩm định → <N>Phê duyệt</N> hoặc <N>Trả lại</N>.</>,
      ]} />
      <Viec ten="Nắm tình hình" buoc={[
        <><M>Tổng quan</M>: cơ cấu nhân sự, việc tồn đọng toàn phường; chọn khối ở đầu trang để xem riêng trường học, cơ quan, đơn vị sự nghiệp.</>,
        <><M>Báo cáo</M>, <M>Dự báo nghỉ hưu</M>: xem và xuất Excel.</>,
      ]} />
    </>
  )

  const hoiDap: [string, ReactNode][] = [
    ['Hệ số trên phần mềm khác bảng lương giấy?', <>Vào <M>Rà soát ngạch - bậc</M> xem nguyên nhân. Nếu lương thực tế đã đổi theo quyết định, lập phiếu <b>Điều chỉnh lương</b> kèm quyết định.</>],
    ['Người đến hạn nâng lương không có trong danh sách gợi ý?', <>Kiểm tra mốc hưởng lương, phụ cấp vượt khung trong hồ sơ và mục <M>Rà soát ngạch - bậc</M>. Mốc sai thì danh sách gợi ý sai.</>],
    ['Đã trình phiếu mới thấy nhầm?', <>Nhờ Thủ trưởng đơn vị bấm <N>Yêu cầu bổ sung</N> để phiếu trở lại, sửa xong trình lại.</>],
    ['Người chuyển đến từ ngoài phường?', <>Thêm hồ sơ mới, chọn trạng thái <b>Chuyển đến</b>, khai lương theo quyết định đang hưởng.</>],
    ['Hệ số chênh lệch bảo lưu nhập 33 hay 0,33?', <>Nhập <b>0,33</b> (hệ số, không phải %). Hệ số lương, phụ cấp dùng tối đa 3 chữ số thập phân.</>],
    ['Vì sao họ tên trên màn hình IN HOA?', <>Phần mềm tự đổi để thống nhất. Danh sách, biểu mẫu xuất ra tự viết hoa chữ cái đầu mỗi từ.</>],
    ['Bảng truy lĩnh thiếu người?', <>Mở bảng → <N>Cập nhật từ phiếu đã phê duyệt</N> → <N>Lưu</N>.</>],
    ['Đang làm thì bị đăng xuất?', <>Để lâu không thao tác, phần mềm tự đăng xuất để bảo mật. Đăng nhập lại, dữ liệu đã lưu không mất.</>],
  ]

  const cacThe = [
    { key: 'can-bo', label: 'Cán bộ đơn vị (kế toán)', children: canBo },
    { key: 'thu-truong', label: 'Thủ trưởng đơn vị', children: thuTruong },
    { key: 'vhxh', label: 'Phòng Văn hóa - Xã hội', children: vhxh },
    { key: 'lanh-dao', label: 'Lãnh đạo Phòng VHXH', children: lanhDao },
  ]

  return (
    <Card className="hd2">
      <div className="hd2-dau">
        <div>
          <Title level={3} style={{ margin: 0 }}>Hướng dẫn sử dụng</Title>
          <Text type="secondary">Phần mềm Quản lý nhân sự lao động tiền lương - phường Gia Viên</Text>
        </div>
        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>In hướng dẫn</Button>
      </div>

      <Alert
        type="info" showIcon style={{ margin: '16px 0 20px' }}
        title={`Xin chào ${currentUser?.fullName ?? ''}. Phần hướng dẫn của bạn đã được mở sẵn bên dưới.`}
        description="Ba nguyên tắc: (1) hồ sơ phải đúng thì danh sách nâng lương mới đúng; (2) lương, phụ cấp chỉ thay đổi qua phiếu được phê duyệt; (3) văn bản đề nghị gửi qua hệ thống quản lý văn bản, minh chứng tải lên phần mềm, không nộp giấy."
      />

      <div className="hd2-muc">Bắt đầu</div>
      {batDau}

      <div className="hd2-muc">Việc theo vai trò</div>
      <Tabs activeKey={the} onChange={setThe} items={cacThe} />

      <div className="hd2-muc">Hỏi nhanh</div>
      <Collapse
        className="hd2-hoi"
        items={hoiDap.map(([h, d], i) => ({ key: String(i), label: h, children: <div>{d}</div> }))}
      />

      <style>{`
.hd2 .ant-card-body { max-width: 980px; margin: 0 auto; }
.hd2-dau { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.hd2-muc { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #2563eb;
  border-bottom: 2px solid #dbeafe; padding-bottom: 6px; margin: 26px 0 12px; }
.hd2-viec { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 18px 10px; margin-bottom: 12px; background: #fff; }
.hd2-ten { font-weight: 700; font-size: 15.5px; color: #1e3a5f; margin-bottom: 6px; }
.hd2-viec ol { margin: 0 0 4px; padding-left: 22px; line-height: 1.7; }
.hd2-viec li { margin-bottom: 3px; }
.hd2-luuy { margin: 6px 0 4px; padding: 8px 12px; border-left: 3px solid #f59e0b; background: #fffbeb; border-radius: 4px; font-size: 14px; }
.hd2-menu { color: #1d4ed8; background: #eff6ff; padding: 0 5px; border-radius: 4px; font-weight: 600; white-space: nowrap; }
.hd2-nut { border: 1px solid #cbd5e1; padding: 0 6px; border-radius: 5px; background: #f8fafc; font-weight: 600; white-space: nowrap; }
.hd2-hoi .ant-collapse-header { font-weight: 600; }
@media print {
  .qlvc-sidebar, .ant-layout-sider, .ant-layout-header, .ant-layout-footer, .hd2-dau .ant-btn { display: none !important; }
  .ant-layout-content { margin: 0 !important; overflow: visible !important; }
  .ant-layout { height: auto !important; overflow: visible !important; }
  .hd2 { box-shadow: none !important; border: none !important; }
  .hd2-viec { page-break-inside: avoid; }
  .hd2-hoi .ant-collapse-content { display: block !important; height: auto !important; }
}
      `}</style>
    </Card>
  )
}
