# Kế hoạch cập nhật dữ liệu admin theo thời gian thực

Trạng thái: chưa triển khai realtime push; đã có polling 10 giây để kiểm tra.

## Mục tiêu

Admin nhận biết dữ liệu được thay đổi bởi người khác hoặc hệ thống khác và cập
nhật đúng phần đang xem, không tải lại toàn bộ trang, không gọi API kiểm tra
phiên đăng nhập theo từng sự kiện. Giữ cache để giảm độ trễ khi sử dụng Render.

## Hiện trạng

- Cache GET không TTL trong bộ nhớ riêng của tab, giới hạn LRU/dung lượng;
  mất khi F5/đóng tab hoặc đổi phiên. Cache không được coi là luôn mới.
- Sau xác thực, preload trang đầu các mục được API cho phép, 2 request nền
  đồng thời; không tải toàn bộ database/mọi chi tiết/ảnh.
- Thao tác ghi qua admin xóa cache trước và sau request; UI áp dụng response vào
  hàng/form vừa lưu. Nút Làm mới lấy lại dữ liệu từ server.
- Đã bổ sung kiểm tra nền ngay khi mở lại trang và polling 10 giây cho dữ liệu
  đang xem; không đổi thì giữ cache/state, khác thì cập nhật cache liên quan.
  Giữ nội dung trong lúc tải, tạm dừng
  khi tab ẩn/offline/đang nhập/sửa/lưu/upload; không gọi lại API phiên.
- Polling chờ request hoàn tất rồi mới đếm 10 giây tiếp theo, không phải realtime
  push và không có bảo đảm độ trễ khi backend chậm. Trang chưa mở giữ snapshot
  và kiểm tra lại khi được mở; lỗi mạng giữ snapshot kèm cảnh báo.
- Xác thực dùng cookie/JWT riêng của PHUB qua backend. Không mặc định JWT này
  có thể dùng trực tiếp cho Supabase Realtime.

## Luồng đề xuất

```text
Database thay đổi
  → thông báo tài nguyên bị thay đổi
  → kiểm tra quyền nhận thông báo
  → xóa cache liên quan trong tab
  → tải lại phần dữ liệu đang xem nếu không có bản nháp đang sửa
```

Chỉ cần thông báo dạng `{ "resource": "orders", "type": "changed" }`, không
chuyển toàn bộ bản ghi, dữ liệu khách hàng hoặc thông tin tài khoản vào sự kiện.
Dữ liệu thực tế tiếp tục được lấy qua API đã có xác thực/phân quyền.

Cache không TTL vẫn dùng được: sự kiện sẽ đánh dấu cần kiểm tra sớm; polling
và kiểm tra khi mở trang là phương án dự phòng. Realtime không loại bỏ thời gian chờ API
khi tải dữ liệu mới hoặc khi backend chưa sẵn sàng.

## Kiến trúc cần xác nhận bằng thử nghiệm nhỏ

- Supabase phát sự kiện khi có INSERT/UPDATE/DELETE bằng cơ chế database change
  phù hợp; đánh giá private Broadcast trước khi chọn cách triển khai.
- Hướng ưu tiên để thử: backend nhận sự kiện và chuyển thông báo đến admin qua
  luồng SSE có xác thực, tận dụng cơ chế phiên hiện tại.
- Nếu chọn client kết nối Supabase trực tiếp, phải thiết kế token/kênh riêng và
  chính sách phân quyền tương thích. Không dùng service-role/secret key phía UI
  và không mở quyền đọc bảng công khai để làm realtime hoạt động.
- Chốt transport sau khi kiểm tra khả năng chạy trên Render, ngắt kết nối,
  số kết nối đồng thời và trường hợp backend có nhiều worker/instance. Không
  chỉ giữ một event bus trong bộ nhớ rồi giả định các worker tự đồng bộ.
- Gateway Next.js hiện dùng allowlist và đọc response bằng `text()`. SSE cần
  route streaming riêng hoặc thay đổi có kiểm soát; không dùng nguyên luồng
  buffer response hiện tại cho kết nối sự kiện dài hạn.

## Phạm vi và thứ tự thực hiện

### 1 Chuẩn bị nguồn sự kiện và bảo mật

- [ ] Làm thử trên staging với một bảng, không ghi dữ liệu production.
- [ ] Xác nhận sự kiện phát sau khi transaction thành công, không thông báo
  thay đổi đã rollback.
- [ ] Soạn migration/trigger và quyền kênh để review; không tự áp vào database thật.
- [ ] Chỉ cho tài khoản có quyền nhận thông báo tương ứng. Đóng luồng khi phiên
  hết hạn/đăng xuất hoặc quyền bị thu hồi; cache không được gia hạn quyền.
- [ ] Không đưa cookie, token, khóa Supabase hoặc nội dung bản ghi vào log.

### 2 Nối sự kiện với cache và giao diện

- [ ] Tạo một kết nối sự kiện dùng chung ở root admin, không mở lại theo từng trang.
- [ ] Bổ sung khả năng vô hiệu hóa cache theo tài nguyên và thông báo cho các
  phần đang hiển thị biết cần đồng bộ, thay vì chỉ xóa Map cache.
- [ ] Ánh xạ các dữ liệu phụ thuộc: đơn hàng → chi tiết/hoá đơn/thanh toán/thống
  kê có liên quan; sản phẩm/tồn kho/kho → các danh sách và thống kê liên quan.
- [ ] Ưu tiên thử với Đơn hàng, Sản phẩm và Tồn kho, sau đó mở rộng các bảng còn lại.
- [ ] Trang đang xem tự tải lại phần liên quan; trang chưa mở chỉ đánh dấu cache
  hết hiệu lực, không tải nền toàn bộ dữ liệu.
- [ ] Nếu đang nhập/chờ lưu/upload, giữ nguyên bản nháp và vị trí nhập. Hiện
  thông báo có dữ liệu mới và đồng bộ sau khi lưu/hủy hoặc khi người dùng chọn.
- [ ] Gộp các sự kiện liên tiếp để tránh một thay đổi nghiệp vụ gây nhiều lần gọi API.
- [ ] Không tự gửi lại thao tác POST/PATCH/PUT/DELETE.

### 3 Khôi phục kết nối và vận hành

- [ ] Tự kết nối lại có backoff khi mất mạng; hủy kết nối cũ để tránh nghe trùng.
- [ ] Sau khi kết nối lại, đồng bộ các tài nguyên đang xem vì có thể đã bỏ lỡ sự kiện.
- [ ] Xử lý khoảng trống giữa lần tải dữ liệu đầu và lúc đăng ký nhận sự kiện;
  không để một cập nhật rơi vào khoảng này rồi bị giữ cache vô thời hạn.
- [ ] Sự kiện/response của phiên cũ không được cập nhật UI hoặc cache của phiên mới.
- [ ] Khi realtime lỗi, giữ nút Làm mới và polling làm phương án dự phòng;
  không coi mất kết nối realtime là đã đăng xuất.
- [ ] Log local có nhãn riêng, chỉ ghi trạng thái kết nối/tài nguyên/lỗi an toàn.

## Kiểm thử và tiêu chí hoàn thành

- [ ] Hai phiên admin: phiên A tạo/sửa dữ liệu, phiên B tự cập nhật phần đang xem.
- [ ] Thay đổi trực tiếp từ database hoặc một backend khác cũng được phát hiện.
- [ ] Thay đổi nhiều bảng trong một nghiệp vụ không gây bão request hoặc tính sai
  thống kê do tải từng phần không nhất quán.
- [ ] Cache của bảng liên quan bị xóa đúng; dữ liệu không liên quan không bị tải lại.
- [ ] Bản nháp, focus, bộ lọc và phân trang được giữ; không tải lại toàn bộ document.
- [ ] Đăng xuất/hết phiên/thu hồi quyền chặn dữ liệu; phiên mới không thấy cache cũ.
- [ ] Mất mạng, server restart, sự kiện trùng và sự kiện bị bỏ lỡ đều có kiểm thử.
- [ ] Không gọi `/auth/me` cho mỗi sự kiện; không giữ bí mật backend ở trình duyệt.
- [ ] Nút Làm mới vẫn hoạt động khi realtime hỏng; không tự replay thao tác ghi.
- [ ] Chạy unit test, browser test với API/sự kiện giả lập và production build;
  kiểm thử staging có sự đồng ý trước khi deploy/áp migration thật.

## Các phần mã dự kiến liên quan

- `src/lib/admin-fetch.ts`: cache và vô hiệu hóa theo tài nguyên/phiên.
- `src/components/admin/auth-provider.tsx`: vòng đời kết nối theo phiên đã xác thực.
- `src/components/backend-data-view.tsx`: cập nhật phần dữ liệu đang xem.
- `src/features/accounts/accounts-view.tsx`: đồng bộ tài khoản, bảo vệ bản nháp.
- `src/features/dashboard/use-dashboard-data.ts`: làm mới thống kê liên quan.
- Backend, gateway và migration mới: xác định chi tiết sau bước thử nghiệm kiến trúc.

## Tài liệu tham khảo

- [Supabase Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
