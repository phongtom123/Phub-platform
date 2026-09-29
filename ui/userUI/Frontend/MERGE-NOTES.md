# Frontend merge — 699ff4c

## Vị trí hiện tại (2026-09-29)

Bản chính đã được chuyển từ `Frontend/` vào `ui/userUI/Frontend/`, gồm source, assets, cấu hình, `.env` và dependencies. Bản cũ tại đích được giữ nguyên trong `C:\Users\acebi\Documents\GitHub\Phub-userUI-Frontend-backup-20260929`. Các ghi chú gộp bên dưới mô tả thời điểm trước khi di chuyển.

## Quyết định gộp

Theo lựa chọn của người dùng: **giữ nguyên giao diện và dữ liệu của `Frontend/` ngoài `ui`; chỉ bổ sung trang/chức năng còn thiếu từ commit `699ff4cdc5448ce05ec9ddb1512ba04dda68da9c`.** Không thực hiện `git merge`, checkout/reset hoặc commit tự động.

Nguồn commit: `ui/userUI/Frontend`. Đích: `Frontend`. Bản trong `ui`, Backend, adminUI và warehouseUI không bị sửa. Thay đổi chưa commit ở `ui/userUI/Frontend/src/app/main/landing/page.tsx` được giữ nguyên và không lấy vào bản đích.

## Giữ nguyên

- Home `/`, Catalog Grid/List và toàn bộ fixture/asset hiện tại, kể cả laptop.
- About Us, FAQ, Dashboard/Profile, mega menu, component common và giao diện header/footer.
- Package versions, package-lock và cổng mặc định 3000 của bản ngoài.
- Các file `.env`, node_modules và nội dung generated `types/` cũ không bị chép đè hoặc xóa.

## Bổ sung / kết nối

| Phần | Cách gộp |
| --- | --- |
| `/auth/login` | Lấy form demo của commit vào route trước đây rỗng. Bổ sung thông báo chưa xác thực; submit chỉ chuyển sang Home. |
| `/auth/register` | Lấy trang placeholder của commit; **chưa phải form đăng ký hoàn chỉnh**. |
| `/main/landing` | Alias Home hiện tại, không chép đè bằng storefront cũ. |
| `/main/product/[id]` | Lấy bố cục detail từ commit, kết nối sản phẩm đúng ID, ảnh và đơn vị tiền của Home/Catalog hiện tại. ID lạ trả not-found, không tự thay bằng sản phẩm đầu tiên. |
| Legacy product IDs | Giữ dữ liệu `storefront-data.ts` làm fallback cho link PC/linh kiện cũ. Không đưa collection này vào thay thế Home/Catalog. |
| Xem nhanh | Thêm link `View product details` trong hộp xem nhanh Home và Catalog. |
| Menu tài khoản | Đổi nút placeholder thành link tới đăng nhập/đăng ký, giữ hình thức menu hiện tại. |
| Quantity / mua hàng | Component UI mẫu, điều chỉnh số lượng và phản hồi tại chỗ; không gọi API, gửi đơn, thu tiền hay đồng bộ giỏ hàng thật. |
| Type checking | Loại `types/` generated cũ ra khỏi TypeScript/ESLint; Next tự sinh type hợp lệ trong `.next`. Không xóa dữ liệu cũ. |

Trang detail bổ sung ở đây là bố cục từ commit, không phải triển khai mới thiết kế MSI Trident gửi trước yêu cầu gộp.

## Bản sao an toàn

Trước khi gộp đã sao lưu `src`, `public`, `types` và các cấu hình/package của Frontend vào:

`C:\Users\acebi\AppData\Local\Temp\phub-frontend-before-merge-ed0f1ac9`

Không sao chép `.env` vào bản sao này. Bản sao ở thư mục tạm chỉ phục vụ hoàn tác cục bộ; không phải cơ chế backup dài hạn.

## Chạy

```powershell
cd ui/userUI/Frontend
npm run dev
```

Mặc định `http://localhost:3000`. Khi chạy admin cùng lúc: `npm run dev -- -p 3001`, đảm bảo bản UI khách hàng cũ không chiếm cổng đó.

## Kết quả kiểm tra sau khi gộp

- `npm run build`: thành công, 12 trang static và các route động được tạo.
- TypeScript: không lỗi. ESLint: không lỗi, còn 1 cảnh báo `<img>` có sẵn trong `BrandTile.tsx`.
- Trình duyệt production: kiểm tra Home/alias, Catalog/Grid/List, About, FAQ, Profile, login/register và detail (ID hiện tại lẫn ID cũ), không có lỗi runtime.
- Đã thử luồng đăng nhập demo → Home, menu tài khoản → login, xem nhanh → chi tiết đúng sản phẩm, đổi số lượng và thông báo mua hàng mẫu; ID không tồn tại hiển thị not-found.
- So sánh hash với bản sao trước gộp: 11 file quan trọng gồm Home/Catalog/data/About/FAQ/Profile/package/lock được giữ nguyên. `ui/userUI/Frontend` vẫn chỉ có đúng thay đổi chưa commit ban đầu của người dùng.

Frontend ngoài `ui` vẫn là thư mục chưa được Git theo dõi tại thời điểm bàn giao; không stage/commit tự động. Bản production dùng để kiểm tra đang chạy trên cổng 3000; muốn sửa nóng, dừng tiến trình `next start` này rồi chạy `npm run dev`.
