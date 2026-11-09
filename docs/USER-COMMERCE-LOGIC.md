# Logic mua hàng khách hàng và bàn giao cho AI

**Cập nhật 09/11/2026 — đơn gần đây/hủy đơn:** `/main/profile` hiển thị 5 đơn
mới nhất ngay dưới thông tin/địa chỉ; mục lịch sử đầy đủ vẫn phân trang 10 đơn.
Ô đơn gần đây không có nút hủy. `CancelOrderButton` dùng chung cho danh sách
đầy đủ, chi tiết và màn hình đặt hàng thành công tại `/checkout`, viền đỏ, xác nhận trước
khi POST, khóa thao tác lặp và giữ lỗi tại đúng đơn. Chỉ đơn MOI/XAC_NHAN/
DANG_CHUAN_BI được hủy. RPC `customer_cancel_order_v1` được khôi phục bằng
migration `20261109133739_restore_customer_cancel_order.sql` (đã áp trên Phub).
Hủy nhả reservation, không tăng TON_KHO, không xóa hóa đơn/dòng đơn và không
khôi phục voucher đã dùng. Retry đơn HUY trả cùng trạng thái, không hoàn thêm.
Đơn còn khoản thu thực tế chưa hoàn trả ORDER_REFUND_REQUIRED để nhân viên
xử lý; chỉ khoản thu demo/bypass mới có bút toán hoàn mô phỏng trong RPC này.
Không hiểu bút toán database là đã chuyển tiền ngân hàng. Kiểm thử bằng fixtures
và PostgreSQL biệt lập; không hủy đơn thật để kiểm tra giao diện.

`CheckoutConfirmation` đọc trạng thái đơn hiện tại trước khi cho hủy, dùng lại
API hủy theo ownership. Khi hủy thành công, đổi tiêu đề sang “Đơn hàng đã hủy”,
làm mới hóa đơn/hạn thanh toán và chặn thanh toán mới. Lỗi hủy giữ tại nút để
khách thử lại; không thay đổi chính sách hoàn tiền hay tự hủy đơn thật để test.

**Nhận tại cửa hàng 04/11/2026:** checkout hỗ trợ `TAI_CUA_HANG`, chỉ cần tên
và số điện thoại; không cần địa chỉ. Đơn vẫn ONLINE, gom tồn mọi kho và có hóa
đơn/hạn 24 giờ. Xem [hợp đồng, migration và kiểm thử](STORE-PICKUP.md).

**Cập nhật 04/11/2026 — KAN-61:** hóa đơn ONLINE mới có hạn thanh toán 24 giờ.
Đơn chưa có khoản thu thành công sẽ tự hủy và nhả hàng giữ khi quá hạn; đơn
đã thu tiền (kể cả một phần), đã xuất kho/hoàn thành và hóa đơn lịch sử không
bị tự hủy. Xem [chính sách, vị trí mã và kiểm thử](KAN-61-PAYMENT-DEADLINE.md).

**Sửa trạng thái thêm giỏ 04/11/2026:** `ShoppingProvider` theo dõi yêu cầu thêm
theo từng product ID, không khóa mọi nút mua khi một món đang chờ API. Các món
khác có thể thêm đồng thời, lưu trên snapshot giỏ mới nhất; chặn thêm trùng món
đang xử lý và vẫn chặn checkout đến khi các lần thêm hoàn tất. Kiểm thử hồi quy:
`ui/userUI/Frontend/tests/product-add-isolation.e2e.cjs` (fixtures, không ghi DB).

Cập nhật ngày **02/11/2026**. Phạm vi: trang sản phẩm, giỏ hàng, checkout,
phân bổ kho, hóa đơn, chi tiết đơn và cách kiểm chứng các thay đổi trong phiên sửa này.

Các lỗi và chức năng còn thiếu sau lần rà soát tiếp theo được ghi tại
[USER-FLOW-AUDIT.md](USER-FLOW-AUDIT.md), kèm mức ưu tiên và cách tái hiện.

**Cập nhật 03/11/2026:** các thẻ sản phẩm trang chủ, catalog và xem nhanh dùng
`ProductCardActions`: icon thêm giỏ và nút Mua ngay cùng dùng một kết quả kiểm tra
tồn. Mua ngay chỉ thêm một chiếc rồi mở `/cart` nếu thành công. Nhãn “Hết hàng”
hoặc “Tạm ngừng bán” thay toàn bộ cụm nút. Catalog UI dùng `include_inactive=true`
để hiện trạng thái tạm ngừng (2); sản phẩm đã ẩn (0) luôn bị loại khỏi catalog,
chi tiết và availability công khai. Loại cha/con vẫn phải hoạt động. Availability trả
`is_active=false` khi sản phẩm tạm ngừng, luôn chặn mua dù còn tồn. Không đổi
trạng thái DB khi hết hàng, không tự xóa sản phẩm trong giỏ đã lưu.

**Cập nhật sau khi tích hợp:** chỉ giữ hàng cho đơn đang xử lý đã có hóa đơn
hoặc khoản thu thành công; giỏ hàng và báo giá không giữ hàng. Xem
[chính sách tồn kho và thuế](../Backend/docs/CART_STOCK_AND_TAX.md).
Trang hồ sơ hiện chỉ giữ thông tin cá nhân, địa chỉ giao hàng và danh sách đơn;
chi tiết đơn/hóa đơn/thanh toán được mở tại `/main/orders/[id]`.
Các mô tả màn hình hồ sơ và số liệu kiểm thử bên dưới là lịch sử trước thay đổi này.

## 1. Các quyết định đã chốt

| Vấn đề | Hành vi cần giữ |
| --- | --- |
| Nhập số lượng | Có thể xóa hết `1`, nhập `6`; chỉ nhận số nguyên dương khi thực hiện mua |
| Giới hạn số lượng | Bỏ trần nghiệp vụ 99/1.000; khả năng đáp ứng dựa trên tồn khả dụng |
| Nguồn hàng | Gom hàng của cùng SKU từ tất cả kho đang hoạt động |
| Thêm giỏ | Kiểm tra tổng số muốn thêm và số đã có trong giỏ |
| Tiếp tục từ `/cart` | Kiểm tra lại toàn bộ sản phẩm được chọn trước khi chuyển trang |
| Tạo đơn | Database kiểm tra lại, khóa và phân bổ kho trong transaction |
| Hóa đơn | Tự tạo sau khi đặt hàng thành công, cùng transaction với đơn |
| Hiển thị đơn/hóa đơn | Gộp các dòng cùng sản phẩm và giá thành một dòng, cộng đúng số lượng/tiền |
| Hết hàng | Ẩn nút thêm giỏ, mua ngay và ô số lượng ở trang chi tiết; hiện `Hết hàng` |
| Tiền và thuế | Dùng số thập phân chính xác; giữ số đã chốt, không cộng thuế lần nữa |
| Thử lại | Cùng idempotency key và payload không được tạo thêm đơn/hóa đơn |

Yêu cầu “không giới hạn số lượng” nghĩa là bỏ trần tùy ý trong giao diện và
nghiệp vụ. API/database hiện vẫn có giới hạn kỹ thuật của PostgreSQL `integer`:
`1..2_147_483_647`. Frontend kiểm tra `Number.isSafeInteger`; không mô tả hệ thống
là hỗ trợ số nguyên lớn vô hạn.

## 2. Nhập số lượng và thêm vào giỏ

Ô nhập dùng chuỗi nháp để người dùng có thể để trống tạm thời khi sửa.
Không ép về `1` ngay trong mỗi lần `onChange`, vì sẽ làm thao tác Backspace bị kẹt.
Không nhận dấu âm, số thập phân hoặc ký pháp `e`. Chuỗi trống được xử lý khi blur;
thao tác mua cần số nguyên dương hợp lệ.

Từ 03/11/2026, ô số lượng trang chi tiết tự giới hạn khi nhập vượt
`tổng tồn khả dụng − số lượng cùng SKU đang có trong giỏ`. Nút tăng dừng ở mức
này. Giá trị tối đa lấy từ `/api/catalog/availability`, gồm tất cả kho hoạt động
và trừ reservation theo chính sách hiện tại; không đặt trần 99/1.000. Số đã tải
được dùng ngay trong RAM khi gõ. Làm mới tồn hoặc đổi giỏ sẽ giới hạn lại nháp;
hết chỗ thêm trong giỏ được thông báo riêng, không ghi thành “Hết hàng”. API lỗi
thì chặn mua và cho thử lại. Kiểm tra số lượng thực tế khi bấm thêm/đặt vẫn giữ.

Ở trang sản phẩm, “Mua ngay” dùng cùng logic thêm hàng vào giỏ, chỉ chuyển sang
`/cart` khi thêm thành công. Nó không tự tạo đơn hoặc ghi nhận thanh toán.

`ShoppingProvider.add` lấy lại sản phẩm và kiểm tra:

1. SKU hiện tại khớp sản phẩm được chọn.
2. Số cần kiểm tra = số lượng đã có của SKU trong giỏ + số lượng muốn thêm.
3. API còn đủ hàng cho số lượng đó.
4. Chủ giỏ và số lượng giỏ chưa thay đổi trong khi chờ kết quả.

Thiếu hàng hoặc lỗi kết nối thì không thêm và không chuyển trang. Thêm giỏ,
sửa số lượng giỏ và xem báo giá không giữ hàng trong database. Khi gộp giỏ khách
vào giỏ tài khoản, số lượng lớn và trạng thái chọn mua vẫn cần được giữ.

## 3. Tồn vật lý, hàng đang giữ và tồn khả dụng

Tính theo từng SKU và từng kho đang hoạt động:

```text
khả dụng tại kho = max(0, TON_KHO.so_luong_ton - số lượng đang giữ tại kho)
tổng khả dụng    = tổng khả dụng tại tất cả kho hoạt động
```

Phần đang giữ lấy từ `CT_DON_HANG.so_luong`, ghép `DON_HANG` theo đơn và
`ma_kho_xuat` theo kho. Những trạng thái giữ hàng:

| Trạng thái đơn | Giữ hàng |
| --- | --- |
| `MOI` | Có |
| `XAC_NHAN` | Có |
| `DANG_CHUAN_BI` | Có |
| `HUY` | Không |
| `DA_XUAT_KHO`, `HOAN_THANH` | Không giữ lần nữa; xuất kho xử lý giảm tồn vật lý |

Không dùng `max(tồn của các kho)` làm tổng khả dụng. Không cộng kho ngừng hoạt
động. Không chỉ nhìn `TON_KHO` rồi bỏ qua các đơn đã giữ hàng.

Ví dụ lịch sử trong phiên sửa:

- Tồn vật lý: `39 + 39 + 60 + 50 = 188`.
- Hàng đang giữ: `21 + 2 = 23`.
- Có thể đặt: `188 - 23 = 165`.
- Người dùng sau đó chỉ cho phép hủy **7 đơn chưa thu tiền**, giải phóng 20 chiếc.
  Ba đơn đã ghi nhận thanh toán được giữ nguyên. Sau thao tác đó, khả dụng là 185.
- Đơn minh họa 185 chiếc được phân bổ `37 + 39 + 60 + 49`.

Đây là diễn biến dữ liệu ở thời điểm kiểm tra, không phải hằng số hay dữ liệu
seed cần đưa lại vào hệ thống. Đơn mới, hủy đơn hoặc xuất kho sẽ đổi các con số.

## 4. Ba lần kiểm tra tồn đều có mục đích riêng

### Trang sản phẩm

`GET /api/catalog/products/{product_id}/availability?quantity=1` kiểm tra sản phẩm
còn ít nhất một chiếc có thể mua hay không. `useProductStock` có bốn trạng thái:

| Trạng thái | Hiển thị |
| --- | --- |
| `checking` | Nút mua chưa được phép thực hiện, đang kiểm tra tồn kho |
| `available` | Hiện thao tác mua; kiểm tra số lượng thực tế khi bấm |
| `sold_out` | Hiện `Hết hàng`; ẩn nút mua, tại trang chi tiết ẩn cả ô số lượng |
| `error` | Báo lỗi hoặc cho thử kiểm tra lại, không gọi là hết hàng |

Hook làm mới mỗi 15 giây khi trang hiển thị, khi focus/quay lại tab, có mạng trở
lại và sau thao tác thêm/mua. Hủy request khi unmount. Trang chi tiết truyền kết
quả cho nút thêm giỏ để tránh tự kiểm tra trùng ngay trong cùng cụm nút.

Ví dụ còn 1 chiếc nhưng khách nhập 2: báo không đủ cho số lượng yêu cầu; sản phẩm
vẫn còn hàng. Chỉ chuyển `sold_out` khi kiểm tra một chiếc cũng không đáp ứng.
Các nút dùng chung ở danh sách mobile, danh sách desktop và xem nhanh cũng có
kiểm tra này.

### Nút “Tiến hành đặt hàng” trong `/cart`

`ShoppingCart.handleCheckout` gọi `ShoppingProvider.checkSelectedStock` trước khi
đi tiếp. Chỉ kiểm tra các dòng đang được chọn, với số lượng hiện tại trong giỏ.

- Đang kiểm tra: vô hiệu hóa nút tiếp tục và chặn bấm lặp.
- Thiếu hàng: ghi rõ tên và số lượng yêu cầu, ở lại `/cart`.
- Lỗi API: ở lại `/cart`, không coi lỗi là còn hàng.
- Đổi số lượng/lựa chọn/chủ giỏ trong khi chờ: kết quả cũ không được dùng để đi tiếp.
- Đủ hàng: khách đăng nhập đi `/checkout`; khách vãng lai đi đăng nhập kèm redirect.

Con số trong thông báo thiếu hàng là **số đã yêu cầu**, không phải số đang còn.
Nút này không tạo đơn, hóa đơn, giao dịch tiền hoặc reservation.

### Transaction tạo đơn

Kết quả từ trang sản phẩm và giỏ chỉ đúng ở lúc đọc. Tạo đơn phải kiểm tra lại
trong database để chống hai khách mua cùng một phần hàng.

Customer checkout hiện gọi `customer_checkout_multi_warehouse_v1` qua
`CommerceRepository`. RPC giữ một dòng quote/receipt cho mỗi SKU và trả thêm:

```json
{
  "sku": "EXAMPLE-SKU",
  "quantity": 165,
  "warehouse_id": 1,
  "allocations": [
    {"warehouse_id": 1, "quantity": 18},
    {"warehouse_id": 2, "quantity": 39},
    {"warehouse_id": 3, "quantity": 60},
    {"warehouse_id": 4, "quantity": 48}
  ]
}
```

`warehouse_id` là kho đầu tiên để tương thích request cũ; không thể dùng trường
này để ép server lấy hàng từ kho thiếu hoặc kho không hoạt động. Khi tạo đơn,
server phân bổ lại theo tồn mới nhất, theo thứ tự mã kho, dưới khóa tồn kho có
thứ tự `(ma_kho, sku)`. Tổng không đủ thì trả `INSUFFICIENT_STOCK` và rollback.

`customer_checkout_v2` vẫn phục vụ API cũ chọn kho tường minh. Không đổi nhầm
caller cũ sang chính sách mới nếu yêu cầu không bao gồm nó. Chi tiết kỹ thuật:
[multi-warehouse checkout](../Backend/docs/MULTI-WAREHOUSE-CHECKOUT.md).

## 5. Bảng dữ liệu, hóa đơn và thanh toán

| Dữ liệu | Nguồn |
| --- | --- |
| Tồn vật lý | `TON_KHO`, lọc kho qua `KHO` |
| Đơn, trạng thái, người nhận | `DON_HANG` |
| Dòng bán đã chốt, kho xuất, số lượng, thuế | `CT_DON_HANG` |
| Tổng hóa đơn đã lập | `HOA_DON` |
| Ghi nhận thu/hoàn tiền | `THANH_TOAN` |
| Lượt voucher | `SU_DUNG_VOUCHER` |

Đặt đơn online mới đồng thời lập hóa đơn. Nếu lập hóa đơn lỗi thì đơn, dòng đơn,
lượt voucher và bản ghi idempotency cùng rollback. Hóa đơn tự động có
`nguon_lap='TU_DONG'`, `nguoi_lap=NULL`; không dựng nhân viên giả.

Quote và receipt checkout giữ hợp đồng số tiền **trước thuế**. Hóa đơn và dòng
đơn đã lập hóa đơn chứa số tiền/thuế đã chốt. Hiển thị tổng sau thuế lấy từ
`HOA_DON`, không tự cộng VAT lần nữa trên frontend.

Thuế được làm tròn theo từng dòng bán bằng `numeric`. Voucher được chia theo
phân bổ kho bằng làm tròn lũy kế để tổng giảm giá không thất thoát phần lẻ.
Khi gộp hiển thị, cộng các số tiền đã lưu bằng `cents`/`decimal` dùng `bigint`;
không tính lại thuế từ số lượng đã gộp.

Có hóa đơn không đồng nghĩa đã thu tiền. Checkout không tự tạo khoản thu.
Chức năng thanh toán bypass từ phần mã `68d5f1c` có luồng riêng và ghi dữ liệu
nghiệp vụ thật, được đánh dấu bypass; giữ cờ cấu hình và kiểm tra quyền.
Xem [hóa đơn tự động](../Backend/docs/AUTOMATIC-INVOICES.md) và
[thanh toán bypass](../Backend/docs/PAYMENT-BYPASS.md).

Đơn/hóa đơn cũ không được tự lập bù hoặc ghi lại chỉ vì một bản sửa giao diện.
API đọc đơn/hóa đơn vẫn kiểm tra quyền sở hữu. RPC tạo đơn chỉ cho backend có
quyền thực thi; không đưa service key ra browser.

## 6. Cùng sản phẩm chỉ hiện một dòng

Một SKU xuất từ bốn kho cần **bốn dòng `CT_DON_HANG`** để giữ và xuất đúng kho.
Đó là dữ liệu phân bổ cần giữ; không xóa ba dòng để sửa giao diện.

Hàm dùng chung `groupInvoiceLines` gộp theo **SKU + đơn vị + đơn giá đã chốt**:
cộng `quantity`, `discount`, `tax_amount`, `line_total`. Các SKU khác nhau hoặc
giá/đơn vị lịch sử khác nhau vẫn là các dòng riêng. Tên sản phẩm giống nhau
không đủ để kết luận cùng SKU.

Đã áp dụng tại tất cả các bảng khách hàng liên quan:

1. Đơn hàng trong `/main/profile` — `AccountPanels.tsx` → `Lines`.
2. Hóa đơn trong `/main/profile` — cùng hàm `Lines`.
3. Chi tiết `/main/orders/[id]` — `OrderView.tsx`.
4. Hóa đơn sau checkout và trong chi tiết đơn — `shopping/InvoicePanel.tsx`.

Ví dụ `37 + 39 + 60 + 49` hiện một dòng **185 chiếc**. Với đơn giá 5.000.000đ,
không giảm giá và VAT 10% trong ví dụ, tổng trước thuế 925.000.000đ,
thuế 92.500.000đ, tổng hóa đơn 1.017.500.000đ.

Hai component cùng tên `InvoicePanel` nằm ở hai nơi khác nhau. Sửa một nơi sẽ
không tự sửa màn hình còn lại. Đây là lỗi bỏ sót đã xảy ra trong phiên này.

## 7. Bản đồ mã cần đọc trước khi sửa

Đường dẫn frontend tính từ `ui/userUI/Frontend/src/`:

| Tệp | Trách nhiệm |
| --- | --- |
| `app/main/product/[id]/ProductDetailActions.tsx` | Nhập số lượng, mua ngay, trạng thái hết hàng desktop/mobile |
| `components/shopping/AddToCartButton.tsx` | Nút thêm dùng chung, kiểm tra trạng thái tồn |
| `components/shopping/ShoppingProvider.tsx` | Giỏ khách/tài khoản, thêm hàng, kiểm tra giỏ trước checkout |
| `app/cart/ShoppingCart.tsx` | Sửa số lượng giỏ, chọn dòng, chặn điều hướng khi chưa đủ hàng |
| `app/checkout/CheckoutProcess.tsx` | Quote, gửi đơn với idempotency, receipt và hóa đơn |
| `lib/catalog/client.ts`, `lib/catalog/useProductStock.ts` | API tồn và cập nhật trạng thái có/hết hàng |
| `lib/shopping/cart-storage.ts` | Khôi phục, lưu, gộp giỏ |
| `lib/shopping/client.ts`, `lib/shopping/types.ts` | Kiểm tra hợp đồng quote/receipt/phân bổ |
| `lib/shopping/invoice-lines.ts`, `lib/shopping/money.ts` | Gộp hiển thị và cộng tiền chính xác |
| `app/main/profile/AccountPanels.tsx` | Bảng đơn và hóa đơn trong tài khoản |
| `components/shopping/OrderView.tsx`, `components/shopping/InvoicePanel.tsx` | Chi tiết đơn và hóa đơn ngoài dashboard |
| `components/catalog/CatalogPage.tsx`, `components/common/ProductListCard.tsx` | Nút thêm có kiểm tra tồn trong danh sách desktop |

Đường dẫn backend tính từ `Backend/`:

| Tệp | Trách nhiệm |
| --- | --- |
| `phub_api/services/catalog_availability.py` | Cộng tồn khả dụng qua các kho, trừ giữ hàng |
| `phub_api/repositories/catalog.py` | Đọc kho hoạt động và reservation |
| `phub_api/controllers/catalog.py`, `schemas/catalog.py` | Endpoint availability và validation |
| `phub_api/repositories/commerce.py` | Gọi RPC checkout gom kho |
| `phub_api/schemas/commerce.py`, `schemas/orders.py` | Số lượng, tiền, các allocation hợp lệ |
| `phub_api/services/commerce_reads.py` | Đọc snapshot dòng đơn, tổng hóa đơn và ownership |
| `docs/openapi.json` | Snapshot cần cập nhật khi sửa hợp đồng API |

## 8. Migration và tài liệu cũ

Ba migration đã được áp dụng vào Supabase Phub trong phiên làm việc, theo thứ tự:

1. `20261102080347_automatic_checkout_invoice.sql` — tự lập hóa đơn.
2. `20261102130239_stock_based_cart_quantity.sql` — bỏ trần 1.000 của checkout.
3. `20261102140733_multi_warehouse_customer_checkout.sql` — thêm RPC gom kho,
   kế thừa hóa đơn, idempotency và các kiểm tra hiện có.

Đây là lịch sử triển khai ở môi trường đã làm việc; môi trường khác phải kiểm
tra migration thực tế. Có file SQL trong Git không chứng minh database đã áp dụng.
Không chạy lại seed/initial schema để sửa lỗi thiếu RPC hoặc lập hóa đơn cũ.

Đọc phần cập nhật mới nhất của tài liệu kho. Chính sách chỉ kho 2 trong phần
lịch sử của [SINGLE-WAREHOUSE.md](SINGLE-WAREHOUSE.md) đã được thay thế. Không
lấy quy tắc cũ “chọn một kho đủ hàng” hay “tối đa 1.000” làm yêu cầu hiện hành
cho customer checkout.

## 9. Cách kiểm thử và báo cáo kết quả

Chọn bài kiểm tra theo phần sửa. Các ca biên quan trọng:

- Xóa `1` rồi nhập `6`, chặn số âm/0 khi mua; nhập 1.234 và lưu/tải lại giỏ.
- Thêm vào giỏ có tính phần đã có; thiếu hàng và lỗi API không làm tăng giỏ.
- Giỏ chỉ kiểm tra dòng đã chọn; đổi giỏ trong lúc chờ phải kiểm tra lại.
- SKU không có kho đơn lẻ đủ nhưng tổng đủ thì đặt được; kho inactive bị loại.
- Hai đơn đồng thời không bán vượt tổng khả dụng; retry không tạo trùng.
- Lỗi lập hóa đơn rollback toàn bộ; voucher và thuế không lệch phần lẻ.
- Bốn dòng kho thành một dòng 185 ở cả bốn bảng nêu trên, desktop và mobile.
- Hết hàng ẩn nút; nhập vượt tồn và lỗi API không thành `Hết hàng`; restock hiện lại.

Từ `Backend`:

```powershell
python -m pytest tests/test_cart_availability.py tests/test_commerce.py tests/test_orders.py tests/test_catalog.py tests/test_openapi.py -q
python scripts/test_multi_warehouse_checkout.py
```

Script PostgreSQL tạo cluster tạm riêng, dùng `psycopg2` và PostgreSQL trong PATH
hoặc `PHUB_POSTGRES_BIN`. Nó kiểm tra cả hóa đơn tự động; không tải `.env` và
không ghi vào Supabase đang chạy.

Từ `ui/userUI/Frontend`:

```powershell
npx tsc --noEmit
node --test tests/guest-cart.test.mjs tests/pooled-checkout.test.cjs tests/invoice-lines.test.cjs
$env:PHUB_USER_TEST_URL = 'http://localhost:3000'
node tests/product-quantity.e2e.cjs
node tests/cart-stock.e2e.cjs
node tests/account-product-lines.e2e.cjs
node tests/automatic-invoice.e2e.cjs
node tests/product-stock.e2e.cjs
```

Browser tests cần Playwright và Chrome. Nếu Playwright không được cài trong
frontend, đặt `PHUB_PLAYWRIGHT_MODULE` trỏ tới module đã cài trong môi trường đó;
không ghi đường dẫn cache riêng của máy khác vào mã ứng dụng. Product tests
cần local đang chạy và một sản phẩm công khai cho SSR; có thể chọn bằng
`PHUB_PRODUCT_TEST_ID`. Request đặt đơn/thanh toán trong các browser fixtures
được mock, không tạo giao dịch thật.

Nếu sửa hợp đồng API, xuất lại OpenAPI bằng
`python scripts/export_openapi.py --output docs/openapi.json` từ `Backend`, rồi
chạy kiểm tra snapshot. Khi sửa UI, chạy lint các tệp bị thay đổi. Chạy build khi
thay đổi có ảnh hưởng build/route hoặc cần xác minh bản production.

Khi báo hoàn thành, nói rõ đã kiểm tra bằng fixtures hay dữ liệu thật, URL nào,
viewport nào và có ghi dữ liệu hay không. Các lượt kiểm thử trong phiên này đã
bao gồm PostgreSQL biệt lập, browser desktop/mobile và kiểm tra chỉ đọc trên local.
Không dùng kết quả lịch sử này thay cho xác minh thay đổi mới.

## 10. Lời nhắn cho AI tiếp theo

Từ 04/11/2026, trạng thái bán/tồn hiển thị dùng batch endpoint và cache RAM theo
SKU tối đa 15 giây. Cache không thay thế kiểm tra tồn khi thêm giỏ/checkout và
transaction đặt đơn; không thay chính sách giữ hàng. Xem
[cách hoạt động và phép đo](USER-STOCK-PERFORMANCE.md) trước khi sửa refresh/cache.

Đọc luồng từ giao diện đang được người dùng mở đến API và transaction trước khi
sửa. Người dùng có thể đang ở `/main/profile`, trong khi bạn chỉ nhìn component
hóa đơn sau checkout. Tìm mọi nơi sử dụng cùng dữ liệu, rồi dùng chung logic.

Giữ ranh giới rõ: kho vật lý khác phần khả dụng; báo giá khác giữ hàng; tạo hóa
đơn khác thu tiền; phân bổ trong database khác cách gộp dòng trên màn hình.
Phần lớn các lỗi vừa sửa đến từ việc trộn những khái niệm này.

Không chữa “không mua đủ 188” bằng cách bỏ reservation, không chữa “bốn dòng
sản phẩm” bằng cách xóa dòng theo kho, không chữa “chưa có hóa đơn” bằng một
hóa đơn giả ở frontend. Sửa đúng lớp chịu trách nhiệm, giữ lịch sử nghiệp vụ.

Lệnh hủy/xóa đơn phải dựa trên đúng phạm vi người dùng yêu cầu và trạng thái
thanh toán hiện tại. Trong phiên này người dùng chỉ chấp thuận hủy 7 đơn chưa
thu tiền; đó không phải quyền hủy 3 đơn đã thu tiền hay các đơn mới về sau.

Trước khi pull/merge, xem `git status`, branch và diff để giữ công việc đang có.
Đọc conflict theo hành vi cuối cùng đã chốt; không chọn toàn bộ một phía chỉ
để hết conflict. Chỉ kết luận đã đồng bộ upstream sau khi kiểm tra Git thực tế.

Cập nhật tài liệu này khi người dùng thay đổi chính sách, ghi rõ phần được thay
thế và thêm ca kiểm thử phù hợp. Hướng dẫn Next.js nằm trong
[AGENTS.md của frontend](../ui/userUI/Frontend/AGENTS.md); kiến trúc backend ở
[Backend/ARCHITECTURE.md](../Backend/ARCHITECTURE.md).

## Danh sách voucher tại checkout — 09/11/2026

- `GET /api/customer/vouchers` lấy mã và điều kiện theo khách đã xác thực;
  UI không gửi mã khách và không đọc trực tiếp bảng voucher từ trình duyệt.
- `VoucherPicker` nằm dưới ô nhập mã: chọn một mã, xem mức giảm, đơn tối thiểu,
  hạn dùng và lý do chưa dùng được. Danh sách nhỏ có cuộn, không tải lại khi gõ mã.
- Ưu tiên mã dùng được cho giỏ hiện tại, sắp theo số tiền giảm thực tế giảm dần
  (làm tròn đến xu, áp trần phần trăm và không vượt tiền hàng). Sau đó đến mã
  chưa đạt đơn tối thiểu, cuối cùng là mã chưa đến hạn/hết hạn/hết lượt. Tính và
  sắp xếp lại trên RAM khi tiền hàng đổi, không truy vấn lại danh sách.
- Trạng thái `HOAT_DONG` chưa đủ: phải đúng thời gian chương trình, còn lượt
  toàn hệ thống/của khách và đủ giá trị giỏ. Báo giá và transaction đặt hàng vẫn
  kiểm tra lại; chỉ báo đã áp dụng sau khi quote xác nhận đúng mã.
- Migration `20261109135628_customer_voucher_choices.sql` chỉ thêm RPC đọc,
  chỉ `service_role` được gọi. Đã áp dụng trên Supabase của dự án, không sửa
  ngày chương trình hay tạo lượt dùng, đơn, hóa đơn hoặc thanh toán.
- Kiểm tra dữ liệu thật ngày 09/11: nhóm mã SEED kết thúc 31/10, nhóm mã mới
  bắt đầu 19/11. Không kéo dài chương trình tự động để làm mã áp dụng được.
- `Backend/tests/customer-vouchers-sql.test.cjs` dùng PostgreSQL RAM biệt lập
  để đối chiếu thời gian, giới hạn khách/toàn hệ thống và quote giảm phần trăm
  có trần. `checkout-voucher.e2e.cjs` dùng API fixtures, kiểm tra chọn mã,
  điều kiện giỏ, tổng gồm VAT, response lỗi/sai mã/đến muộn và màn hình nhỏ.
