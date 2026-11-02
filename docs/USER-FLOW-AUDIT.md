# Rà soát luồng khách hàng — 02/11/2026

Rà mã tại HEAD `4e35b6e` cùng các thay đổi trong worktree, chạy kiểm thử trên
user UI local `http://localhost:3000` và backend local. Báo cáo này ghi các vấn đề
còn mở; chưa sửa mã ứng dụng trong lần rà soát. Không tạo/hủy đơn, thanh toán
hoặc điều chỉnh tồn trên database đang dùng.

Quy tắc đã chốt: [USER-COMMERCE-LOGIC.md](USER-COMMERCE-LOGIC.md).

## Kết quả chính

| Mức | Vấn đề | Ảnh hưởng |
| --- | --- | --- |
| P1 | Checkout dùng địa chỉ đã lưu chung giữa các tài khoản | Người B có thể thấy và đặt giao đến địa chỉ người A |
| P1 | “Tổng thanh toán” trước xác nhận chưa gồm VAT | Số phải trả trên hóa đơn tăng so với tổng được hiển thị khi chốt đơn |
| P2 | Mất phản hồi tạo đơn rồi reload có thể mất đường thử lại | Pending key còn, nhưng không thể replay qua UI khi báo giá mới thiếu tồn |
| P2 | Profile giữ dữ liệu cũ sau khi phiên hết hạn ở tab khác | Quay lại màn hình vẫn thấy thông tin cá nhân đã tải trước đó |
| P2 | Hai tab ghi đè giỏ hàng | Hàng đã xóa có thể xuất hiện lại hoặc thay đổi mới bị mất |
| P2 | Gộp giỏ khách vào giỏ đủ 100 SKU làm mất phần chưa gộp | SKU khách bị bỏ nhưng giỏ khách vẫn bị xóa và báo chuyển thành công |
| P2, theo môi trường | Chuyển staff portal khác hostname không mang theo phiên | Đăng nhập tại cửa hàng rồi qua portal lại phải đăng nhập |

P1: cần ưu tiên trước khi xem luồng mua hàng là hoàn chỉnh. P2: cần sửa để xử lý
đúng trường hợp lỗi, nhiều tab hoặc cấu hình triển khai tương ứng.

## 1. P1 — Địa chỉ giao hàng dùng chung giữa tài khoản

Mã liên quan:
[khóa lưu địa chỉ](../ui/userUI/Frontend/src/app/checkout/CheckoutProcess.tsx#L24),
[đọc và tự chọn địa chỉ](../ui/userUI/Frontend/src/app/checkout/CheckoutProcess.tsx#L66),
[recipient gửi tạo đơn](../ui/userUI/Frontend/src/app/checkout/CheckoutProcess.tsx#L274).

`phub_user_delivery_addresses_v1` không chứa mã khách hàng. Checkout ưu tiên
địa chỉ đã lưu trên trình duyệt và tự chọn dòng đầu, kể cả khi profile hiện tại
thuộc người khác. Khóa này còn lưu tên, điện thoại và địa chỉ.

Đã tái hiện bằng browser fixtures: đăng nhập giả lập BETA, profile có địa chỉ
Beta, localStorage có địa chỉ Alpha từ tài khoản trước. Mở `/checkout` tự hiện
và chọn người nhận Alpha. Không bấm tạo đơn thật.

Hướng sửa: tách storage theo customer ID, reset địa chỉ/lựa chọn khi đổi phiên,
kiểm tra cấu trúc dữ liệu lưu và xử lý khóa cũ có chủ sở hữu không xác định.
Thêm kiểm thử A đăng xuất → B đăng nhập trên cùng browser.

## 2. P1 — Tổng chốt mua chưa phản ánh VAT

Mã liên quan:
[VAT và tổng thanh toán](../ui/userUI/Frontend/src/app/checkout/CheckoutProcess.tsx#L911),
[hợp đồng quote trước thuế](../Backend/phub_api/schemas/commerce.py#L112).

Quote hiện trả `tax_total=0`, `total` trước thuế theo hợp đồng
`tax_application='invoice'`. Checkout lại gắn nhãn “Thuế VAT dự kiến (10%)” cho
số 0 và “Tổng thanh toán” cho tổng trước thuế.

Ví dụ giá hàng 5.000.000đ không giảm giá: màn hình xác nhận thể hiện VAT 0 và
tổng thanh toán 5.000.000đ, nhưng hóa đơn sau đặt là 5.500.000đ. Các kiểm thử
đúng contract quote vẫn có thể đạt trong khi nội dung hiển thị gây hiểu nhầm.

Hướng sửa: cho khách biết đầy đủ số dự kiến phải trả trước khi xác nhận, hoặc
tối thiểu ghi rõ chưa gồm VAT và phần thuế sẽ áp dụng. Nếu bổ sung preview sau
thuế, dùng cùng quy tắc làm tròn theo dòng/phân bổ của server. Giữ contract
quote/expected_total/replay hiện có cho tới khi có thay đổi API tương ứng.

## 3. P2 — Pending checkout thiếu bước phục hồi

Mã liên quan:
[lưu và kiểm tra pending attempt](../ui/userUI/Frontend/src/app/checkout/CheckoutProcess.tsx#L293),
[xóa attempt sau thành công](../ui/userUI/Frontend/src/app/checkout/CheckoutProcess.tsx#L307),
[nút phụ thuộc quote mới](../ui/userUI/Frontend/src/app/checkout/CheckoutProcess.tsx#L927).

Đã tái hiện bằng browser fixtures:

1. POST tạo đơn giả lập thành công ở server nhưng phía khách nhận 503.
2. Trình duyệt giữ idempotency key và fingerprint của lần đặt đó.
3. Reload; chiếc cuối đã được chính đơn vừa tạo giữ nên quote mới trả không đủ tồn.
4. UI không có quote, nút đặt hàng bị khóa. Không có thao tác replay request/key
   gốc để nhận lại receipt, dù key vẫn được lưu.

Kết quả ghi nhận: `posts=1`, `retryButtonDisabled=true`, `attemptStillSaved=true`.
Nếu đổi nội dung sau lỗi mạng, fingerprint cũ cũng chặn tạo attempt mới; xem
lịch sử rồi quay lại không tự kết thúc trạng thái pending.

Hướng sửa: phục hồi pending attempt độc lập với báo giá mới bằng request/key
gốc hoặc API tra cứu kết quả theo attempt có ownership. Chỉ cho mở attempt mới
khi đã xác minh trạng thái cũ. Không xóa key tùy tiện khi chưa biết đơn đã được tạo.

## 4. P2 — Profile chưa đồng bộ hết hạn phiên giữa tab

Mã liên quan:
[ConnectedAccount kiểm tra phiên](../ui/userUI/Frontend/src/app/main/profile/ConnectedAccount.tsx#L20),
[listener chỉ trong window](../ui/userUI/Frontend/src/app/main/profile/ConnectedAccount.tsx#L29),
[ShoppingProvider kiểm tra lại khi focus](../ui/userUI/Frontend/src/components/shopping/ShoppingProvider.tsx#L229).

Đã tái hiện bằng fixtures: mở `/main/profile`, chuyển phản hồi session sang 401,
phát sự kiện focus. Provider gọi lại `/api/customer/me` và nhận 401, nhưng trang
profile vẫn hiện Contact Information và My Orders đã tải trước đó.

Đây là dữ liệu cũ còn trên giao diện; kiểm tra này không chứng minh có thể đọc
dữ liệu mới trái quyền từ backend. Nguyên nhân là profile, header và shopping
provider quản lý trạng thái phiên riêng, chưa đồng bộ invalidation đầy đủ.

Hướng sửa: dùng chung hoặc đồng bộ nguồn phiên, kiểm tra lại khi focus và truyền
logout/session change giữa tab; xóa dữ liệu riêng tư khỏi UI khi mất phiên.

## 5. P2 — Giỏ hàng hai tab có thể ghi đè nhau

Mã liên quan:
[persist toàn bộ snapshot](../ui/userUI/Frontend/src/components/shopping/ShoppingProvider.tsx#L81),
[điều kiện nạp lại giỏ](../ui/userUI/Frontend/src/components/shopping/ShoppingProvider.tsx#L166),
[các listener hiện tại](../ui/userUI/Frontend/src/components/shopping/ShoppingProvider.tsx#L229).

Đã tái hiện bằng hai trang browser cùng context và fixtures GET:

```text
Ban đầu cả hai tab: A1 + B1
Tab 1 xóa B:       storage = A1
Tab 2 focus, sửa A thành 2:
                   storage = A2 + B1
```

Tab 2 vẫn dùng `linesRef` cũ; không có listener `storage`, còn focus cùng tài
khoản không tải lại giỏ khi giỏ guest trống. `persist` ghi lại toàn bộ snapshot
nên sản phẩm đã xóa có thể sống lại, hoặc dữ liệu mới ở tab kia bị mất.

Hướng sửa: đồng bộ thay đổi giỏ qua `storage`/broadcast và xử lý phiên bản hoặc
thao tác cập nhật để tránh ghi đè snapshot cũ. Kiểm tra thêm xóa giỏ sau đặt đơn
trong lúc tab khác đang mở.

## 6. P2 — Mất SKU guest khi giỏ tài khoản đủ 100 dòng

Mã liên quan:
[merge bỏ phần vượt sức chứa](../ui/userUI/Frontend/src/lib/shopping/cart-storage.ts#L40),
[xóa toàn bộ giỏ guest](../ui/userUI/Frontend/src/components/shopping/ShoppingProvider.tsx#L176),
[thông báo chuyển toàn bộ](../ui/userUI/Frontend/src/components/shopping/ShoppingProvider.tsx#L190).

Đã xác minh bằng hàm TypeScript thực: account có 100 SKU khác nhau + guest có
SKU EXTRA số lượng 6 → kết quả merge không chứa EXTRA. Luồng đăng nhập sau đó
vẫn xóa cả giỏ guest và thông báo đã chuyển đủ số dòng guest.

Hướng sửa: trả lại phần chưa gộp được, giữ dữ liệu đó và thông báo rõ; hoặc
chặn thao tác gộp cho tới khi khách giải quyết sức chứa. Không tăng giới hạn
tùy tiện mà chưa cập nhật contract quote/order tối đa 100 SKU.

## 7. P2 theo môi trường — Chuyển staff portal khác hostname

Mã liên quan:
[điều hướng sau login](../ui/userUI/Frontend/src/app/auth/login/page.tsx#L47),
[liên kết portal](../ui/userUI/Frontend/src/components/layout/HeaderPanels.tsx#L75),
[helper handoff đã có](../ui/shared/staff-portal.ts#L2).

Đăng nhập ADMIN/NHAN_VIEN tại user UI đang chuyển trang bằng location/link
thường. Cookie HttpOnly host-only không đi theo sang hostname khác. Repo đã
có helper one-use handoff `enterStaffPortal` nhưng các entrypoint này chưa dùng.

Ảnh hưởng khi triển khai các portal trên hostname khác nhau: người dùng đăng
nhập thành công tại cửa hàng rồi vẫn phải đăng nhập lại ở portal đích. Local
cùng `localhost` khác port có thể không thể hiện lỗi này.

Đây là kết luận từ đường đi mã và cookie scope, chưa chạy tái hiện production
hai hostname trong lần audit. Cần kiểm thử môi trường tương ứng khi sửa.

## 8. Chức năng còn thiếu hoặc đang bị vô hiệu hóa chủ động

- **Thanh toán chuyển khoản/QR thông thường:** checkout hứa QR/tài khoản sau đặt
  ở [CheckoutProcess](../ui/userUI/Frontend/src/app/checkout/CheckoutProcess.tsx#L786),
  nhưng payment provider thường còn trả `PAYMENT_INTEGRATION_REQUIRED`
  ([payment_requests.py](../Backend/phub_api/services/payment_requests.py#L7)).
  Bypass là luồng riêng; không coi bypass là đã có cổng thanh toán thực. Cần
  triển khai provider/hướng dẫn ngân hàng hoặc sửa nội dung để đúng khả năng hiện có.
- **Đổi/quên mật khẩu khách:** nút dashboard hiện chỉ thông báo chưa có API;
  chưa có luồng khôi phục từ màn hình login.
- **Wishlist theo tài khoản, đánh giá, newsletter, lưu phương thức thanh toán,
  địa chỉ billing riêng:** đang hiển thị chưa hỗ trợ. Đây là backlog chức năng,
  không phải lỗi hồi quy từ phần gom kho/hóa đơn.
- **Một số bộ lọc và sắp xếp:** khoảng giá/màu/tồn kho và sort tên chưa được mở
  đầy đủ trên UI; so sánh/yêu thích của catalog chỉ tạm ở giao diện.
- **Giỏ mini:** link checkout chưa kiểm tra `selectedLines` như trang `/cart`;
  bỏ chọn hết vẫn có thể đi vào trang báo chưa chọn sản phẩm. Transaction tạo
  đơn vẫn kiểm tra tồn, nên đây không phải lỗ hổng bán vượt kho.

## 9. Bằng chứng kiểm thử và giới hạn

Trong lần rà soát này:

- **455 kiểm thử backend đạt**: auth/handoff, catalog/filter/availability,
  commerce/customer reads, orders/payments, manual shopping và OpenAPI.
- **24 unit test frontend đạt**: giỏ guest, quote allocations, gộp dòng/tiền,
  account client.
- TypeScript `npx tsc --noEmit` đạt.
- Năm bộ browser regression đạt: `product-stock`, `product-quantity`,
  `cart-stock`, `account-product-lines`, `automatic-invoice`. Bao gồm desktop
  1440px, mobile 390px khi bộ test có hai viewport, và tự làm mới hóa đơn.
- Các ca tái hiện riêng xác nhận địa chỉ chéo tài khoản, pending checkout,
  profile stale, giỏ hai tab và hàm merge guest bị mất dòng.

Bộ `account-dashboard.e2e.cjs` còn thất bại tại dòng 169. Assertion cũ cấm mọi
request chứa `/customer/`, nhưng ShoppingProvider toàn app luôn dùng
`GET /api/customer/me` để phân loại guest/tài khoản. Fixture mode ADMIN cũng
đang trả profile khách cho endpoint này thay vì 403 như backend thực.
Cần sửa assertion/fixture và chạy lại suite; lỗi test này không chứng minh
backend cho guest/admin đọc được đơn hay hồ sơ khách hàng.

Browser fixtures chỉ mô phỏng HTTP, không ghi nghiệp vụ thật. Product tests có
đọc sản phẩm công khai của local cho SSR. Không chạy tạo đơn/thanh toán thật,
không chạy migration hay thay đổi cấu hình khi audit. Không tái kiểm tra cổng
thanh toán production hoặc toàn bộ ma trận hostname. Không chạy lại PostgreSQL
concurrency script trong lần audit này.

## Thứ tự sửa đề xuất

1. Tách địa chỉ theo tài khoản và sửa nội dung/số tiền VAT ở bước xác nhận.
2. Thêm phục hồi pending checkout và thống nhất hết hạn phiên.
3. Đồng bộ giỏ giữa tab, giữ phần guest chưa gộp được.
4. Chốt phương án thanh toán thường và handoff portal theo môi trường triển khai.
5. Hoàn thiện các tính năng tài khoản/catalog theo ưu tiên sản phẩm.

Mỗi phần sửa cần ca kiểm thử đúng tình huống lỗi ở trên và cập nhật trạng thái
báo cáo; không đánh dấu đã hoàn thành chỉ vì các happy-path test đang đạt.
