// Bản dịch nội dung tham khảo của giao diện FAQ – 1.
// Đây không phải chính sách đã được duyệt cho hoạt động kinh doanh thực tế.
export interface TermsSection {
  id: string;
  title: string;
  paragraphs: readonly string[];
  definitions?: readonly string[];
}

export const termsSections: readonly TermsSection[] = [
  {
    id: "definitions", title: "Định nghĩa và cách hiểu",
    paragraphs: ["Trong các điều khoản và điều kiện mua bán dưới đây, trừ khi ngữ cảnh yêu cầu cách hiểu khác:"],
    definitions: [
      "“Cửa hàng” là Công ty Shop Pty Ltd, có mã số doanh nghiệp tại Úc (ABN) 11 222 333 444.",
      "“Khách hàng” là cá nhân hoặc tổ chức đặt mua hàng hóa hoặc dịch vụ từ Cửa hàng.",
      "“Sản phẩm” là hàng hóa, vật tư, thiết bị hoặc dịch vụ do Cửa hàng cung cấp cho Khách hàng.",
      "Nếu Khách hàng gồm nhiều người, những người này cùng chịu trách nhiệm liên đới và mỗi người có thể phải chịu toàn bộ nghĩa vụ.",
      "Mọi đề cập đến một bên hoặc một người đều bao gồm các loại hình tổ chức, cùng người kế nhiệm, bên nhận chuyển giao và người đại diện tương ứng.",
      "Đối với các thời hạn nêu tại điều 5 và điều 11, việc tuân thủ đúng thời hạn là điều kiện thiết yếu.",
      "Mọi đề cập đến tiền tệ đều được hiểu là đô la Úc (AUD).",
    ],
  },
  {
    id: "general", title: "Quy định chung",
    paragraphs: ["Khi đặt mua hoặc nhận Sản phẩm từ Cửa hàng, Khách hàng đồng ý chịu sự ràng buộc của các điều khoản và điều kiện mua bán này. Mọi đơn đặt hàng, bao gồm đơn đặt qua Internet, đều cần được Cửa hàng chấp nhận. Việc chấp nhận đơn hàng phụ thuộc vào sự đồng ý của Khách hàng đối với các điều khoản này; các điều khoản này được ưu tiên áp dụng ngay cả khi đơn đặt hàng của Khách hàng có nội dung trái ngược. Cửa hàng có quyền thay đổi các điều khoản vào bất kỳ thời điểm nào; việc Khách hàng tiếp tục đặt hàng sau đó được xem là chấp nhận các điều khoản đã sửa đổi. Sau khi đơn hàng đã được đặt và được Cửa hàng chấp nhận, Khách hàng không được hủy hoặc thay đổi đơn hàng, trừ khi hai bên có thỏa thuận bằng văn bản."],
  },
  {
    id: "quotations", title: "Báo giá",
    paragraphs: ["Báo giá do Cửa hàng cung cấp có hiệu lực trong thời hạn được ghi trên báo giá. Nếu không ghi thời hạn, Khách hàng có thể chấp nhận báo giá trong vòng bảy (7) ngày kể từ ngày lập. Sau thời hạn này, Cửa hàng có thể thay đổi mức giá mà không cần thông báo trước cho Khách hàng."],
  },
  {
    id: "prices-taxes", title: "Giá bán và thuế",
    paragraphs: ["Mức giá Khách hàng phải thanh toán là giá áp dụng tại thời điểm đặt hàng, với điều kiện Sản phẩm được nhận để giao trong một khoảng thời gian hợp lý. Giá có thể thay đổi mà không cần báo trước. Giá bán lẻ đề xuất chỉ có tính chất tham khảo và Cửa hàng không có nghĩa vụ phải áp dụng mức giá đó. Nếu vì bất kỳ lý do nào Khách hàng không mua đủ số lượng Sản phẩm đã thỏa thuận, Cửa hàng có thể điều chỉnh đơn giá theo tổng số lượng thực tế được mua, mà không ảnh hưởng đến các quyền và biện pháp xử lý khác của Cửa hàng. Giá đã bao gồm thuế hàng hóa và dịch vụ (GST), nhưng chưa bao gồm các loại thuế hoặc khoản thu khác. Các khoản này được cộng thêm vào giá và Khách hàng phải thanh toán khi trả tiền Sản phẩm."],
  },
  {
    id: "payment", title: "Điều kiện thanh toán",
    paragraphs: [
      "Thanh toán bằng thẻ tín dụng có thể phát sinh phụ phí. Nếu có, Cửa hàng sẽ thông báo cho Khách hàng trước khi xử lý giao dịch.",
      "Trừ khi có thỏa thuận khác bằng văn bản, nếu Cửa hàng chưa chấp thuận cấp tín dụng thương mại cho Khách hàng bằng văn bản, toàn bộ giá trị Sản phẩm phải được thanh toán bằng tiền mặt trước khi giao hàng.",
      "Nếu Cửa hàng đã đồng ý cấp tín dụng thương mại bằng văn bản, Khách hàng phải thanh toán theo các điều kiện do Cửa hàng cung cấp.",
      "Nếu Cửa hàng đã chấp thuận thỏa thuận tín dụng thương mại nhưng chưa thông báo điều kiện thanh toán, Khách hàng phải thanh toán toàn bộ giá trị Sản phẩm trong vòng bảy (7) ngày kể từ ngày lập bảng kê.",
      "Thanh toán bằng thẻ tín dụng theo từng hóa đơn hoặc giao dịch cũng có thể được cung cấp như một phương thức riêng, hoặc kết hợp với việc ủy quyền tự động trích tiền từ thẻ tín dụng.",
    ],
  },
  {
    id: "credit-accounts", title: "Tài khoản tín dụng",
    paragraphs: ["Các thỏa thuận tín dụng thương mại được Cửa hàng cấp cho Khách hàng tiếp tục có hiệu lực cho đến khi Cửa hàng quyết định chấm dứt theo quyền quyết định riêng của mình. Khi chấm dứt thỏa thuận, Cửa hàng sẽ thông báo bằng văn bản cho Khách hàng. Việc chấm dứt có hiệu lực kể từ khi Khách hàng nhận được thông báo."],
  },
  {
    id: "ownership", title: "Thay đổi chủ sở hữu",
    paragraphs: [
      "Tài khoản giao dịch được Cửa hàng phê duyệt dựa trên thông tin và cam kết do Khách hàng cung cấp. Nếu có thay đổi toàn bộ hoặc một phần quyền sở hữu của Khách hàng, Khách hàng phải lập tức thông báo bằng văn bản cho Cửa hàng. Cho đến khi Cửa hàng nhận được thông báo này, Khách hàng — bao gồm từng giám đốc nếu Khách hàng là công ty hoặc bên nhận ủy thác — có trách nhiệm bồi hoàn cho Cửa hàng đối với mọi tổn thất, khoản nợ chưa thanh toán, tiền lãi, thiệt hại, chi phí và phí phát sinh khi Cửa hàng giao dịch với cá nhân, công ty hoặc tổ chức đã mua lại toàn bộ hay một phần hoạt động kinh doanh, quyền lợi hoặc cổ phần của Khách hàng và sử dụng tài khoản giao dịch đã được phê duyệt trước đó. Quy định này cũng áp dụng khi công ty giữ nguyên tên nhưng thay đổi cổ đông, hoặc khi bên mua là một tổ chức ủy thác.",
      "Nếu Khách hàng được Cửa hàng cho phép thanh toán bằng hình thức tự động trích tiền từ thẻ tín dụng, Khách hàng phải thông báo bằng văn bản ít nhất năm (5) ngày trước khi thay đổi chủ sở hữu doanh nghiệp. Khoảng thời gian này nhằm để Cửa hàng liên hệ với chủ sở hữu mới, thu thập và xác nhận thông tin thẻ tín dụng mới khi cần thiết.",
    ],
  },
  {
    id: "product-information", title: "Thông tin về sản phẩm cung cấp",
    paragraphs: ["Các thông số mô tả, hình minh họa, bản vẽ, dữ liệu, kích thước và khối lượng do Cửa hàng cung cấp hoặc được trình bày trong danh mục và tài liệu quảng cáo chỉ mang tính gần đúng, nhằm mô tả khái quát hàng hóa. Những thông tin này không tự động trở thành một phần của thỏa thuận hoặc mô tả hàng hóa được bán theo thỏa thuận này hay thỏa thuận khác, trừ khi Cửa hàng có chấp thuận bằng văn bản. Trong trường hợp được chấp thuận, các thông tin đó vẫn được áp dụng trong phạm vi sai số thương mại được công nhận."],
  },
  {
    id: "delivery", title: "Giao hàng",
    paragraphs: [
      "Cửa hàng quyết định phương thức giao Sản phẩm cho Khách hàng và có quyền giao thành nhiều đợt. Nếu phát sinh chi phí do yêu cầu giao hàng đặc biệt, chẳng hạn giao đến Tasmania hoặc Lãnh thổ Bắc Úc, hoặc do yêu cầu giao gấp, Cửa hàng có thể tính thêm các chi phí đó cho Khách hàng. Chi phí phát sinh có thể bao gồm cước vận chuyển hàng không nếu đây không phải phương thức giao hàng thông thường. Khách hàng đồng ý nhận Sản phẩm đã mua trong giờ làm việc thông thường.",
      "Cửa hàng không chịu trách nhiệm đối với tổn thất hoặc thiệt hại do giao hàng chậm. Việc giao hàng chậm không làm phát sinh quyền hủy bỏ hoặc từ chối thực hiện đơn đặt hàng của Khách hàng.",
    ],
  },
];

export const termsNavigation = termsSections.map(({ id, title }) => ({ id, title }));
