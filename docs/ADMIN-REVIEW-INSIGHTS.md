# Báo cáo đánh giá sản phẩm cho Admin

Trong **Tiếp thị → Báo cáo CRM**, thay biểu đồ sao gộp toàn hệ thống bằng bảng
phân tích từng sản phẩm. Admin xem báo cáo và nhận xét; nhân viên vẫn quản lý
ẩn/hiện đánh giá tại portal nhân viên. Không dẫn admin sang trang tác nghiệp.

- Tìm theo tên/mã sản phẩm/SKU; lọc ngày tạo đánh giá theo ngày Việt Nam.
- Lọc số đánh giá tối thiểu để đối chiếu sản phẩm có mẫu đủ lớn. Vẫn ghi số mẫu
  và nhãn ít đánh giá (<5), không kết luận chất lượng chỉ từ một điểm số.
- Sắp xếp theo số đánh giá 1–2 sao, điểm trung bình thấp, nhiều đánh giá hoặc mới nhất.
- Mỗi sản phẩm có số phản hồi, điểm trung bình, số/tỷ lệ 1–2 sao và ngày phản hồi mới nhất.
- **Xem nhận xét** mở chi tiết ngay dưới bảng, mặc định 1–2 sao nếu sản phẩm có
  phản hồi thấp. Có thể xem tất cả. Chi tiết dùng cùng bộ lọc thời gian với báo cáo.
- 20 sản phẩm/trang và 10 nhận xét/trang. Tổng số, điểm trung bình và tỷ lệ tính
  từ toàn bộ dữ liệu phù hợp, không chỉ trang hiện tại.

Chỉ tính đánh giá `HIEN_THI`, với điểm/nội dung phiên bản hiện tại. Đây không phải
lịch sử điểm tại thời điểm quá khứ. Điểm toàn bộ = tổng sao / tổng đánh giá;
không lấy trung bình cộng các điểm trung bình sản phẩm. Tỷ lệ thấp = số đánh giá
1–2 sao / tổng đánh giá × 100. Bộ lọc số mẫu áp dụng cả các chỉ số tổng quan.
Ngày kết thúc bao gồm toàn bộ ngày đó theo `Asia/Ho_Chi_Minh`.

API chỉ đọc ADMIN: `GET /api/crm/review-insights`, có `q`, `date_from`, `date_to`,
`min_reviews`, `sort`, `page`, `product_id`, `review_page`, `low_only`.
Một RPC SQL tổng hợp trên các bảng hiện có; nội dung nhận xét chỉ đọc khi mở
chi tiết và có phân trang. Không thêm bảng, không seed/sửa/xóa đánh giá thật.

Đã áp dụng `20261109075759_admin_review_insights.sql` trên Phub ngày 09/11/2026.
Kiểm tra chỉ đọc sau migration: 4 sản phẩm, 5 đánh giá hiển thị, điểm chung 3,4/5,
1 đánh giá 1–2 sao. Đây là số liệu tại thời điểm kiểm tra, không phải seed mới.
API, SQL biệt lập, TypeScript và browser fixtures đã kiểm tra điểm có trọng số,
khoảng ngày Việt Nam, ngưỡng mẫu, phân trang, drilldown, quyền và bố cục mobile.
