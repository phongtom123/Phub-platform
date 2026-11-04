# Jira QA Report Draft

Tiện ích Chrome/Edge tạo khung báo cáo từ ticket đang mở và điền vào ô Comment.
**Dừng ở bản nháp: không nhấn Save, không gọi API đăng comment, không đổi trạng thái ticket.**
Bạn kiểm tra, điền kết quả thực tế và tự bấm Save trên Jira.

## Cài đặt

1. Mở `chrome://extensions` hoặc `edge://extensions`.
2. Bật **Developer mode** → **Load unpacked**.
3. Chọn thư mục `tools/jira-report-draft` trong repo này.
4. Tải lại trang Jira đang đăng nhập. Nút **QA Draft** xuất hiện ở góc dưới phải.

Hỗ trợ Jira Cloud trên `*.atlassian.net`, trang `/browse/KEY-123` và board có
`?selectedIssue=KEY-123`. Không cần API token hoặc dịch vụ AI bên ngoài.

## Dùng trực tiếp

1. Mở đúng ticket → **QA Draft**.
2. Chọn English hoặc Tiếng Việt → **1. Tạo khung**.
3. Xem/sửa khung rồi bấm **2. Điền vào Comment — chưa lưu**.
4. Kiểm tra nội dung trong editor Jira, điền kết quả và bằng chứng thật.
5. Khi đồng ý, **bạn tự nhấn Save** của Jira.

Khung gồm thông tin ticket, môi trường, tiêu chí chấp nhận, bước kiểm tra,
kết quả mong đợi/thực tế, bằng chứng, hồi quy, giới hạn và kết luận.
Mặc định kết quả là `NOT TESTED` / `CHƯA KIỂM TRA`, kể cả ticket đang Done.
Tool tạo khung, **không tự chạy kiểm thử hoặc tự kết luận PASS/FAIL**.

Nếu đã có bản nháp, tool giữ nguyên nội dung và từ chối ghi đè. Nếu Jira dùng
editor chưa nhận diện được, bấm **Sao chép**, dán thủ công vào Comment.
Tool không chuyển sang ticket khác để chèn và không đoán chọn khi có nhiều editor.

## Cho AI agent thao tác qua trình duyệt

Yêu cầu agent: “Mở các ticket tôi chỉ định, đọc yêu cầu và tạo khung báo cáo trong
Comment bằng QA Draft. Chỉ điền kết quả nào đã thực sự kiểm tra. Dừng trước Save
để tôi xem lại, không đăng comment hoặc đổi trạng thái.”

Các nút có tên cố định và thuộc tính phục vụ browser automation:

- `data-qa-draft-action="prepare"`: đọc ticket bằng GET và tạo khung.
- `data-qa-draft-action="insert"`: điền vào editor, không submit.
- Ô `Bản nháp báo cáo` có thể chỉnh sửa trước khi chèn.

Agent cần trình duyệt có tiện ích này và phiên Jira đã đăng nhập. Chỉ cài tiện ích
không tạo ra một AI agent tự chạy nền; agent hoặc người dùng phải mở ticket và
thao tác các nút trên. Các thay đổi trong editor vẫn chờ bạn duyệt/lưu.

Xem [prompt và hướng dẫn cho AI](AGENT_WORKFLOW.md). Xử lý từng ticket và giữ
nguyên tab để bạn duyệt bản nháp trước khi chuyển sang ticket tiếp theo.

## Kiểm tra

```powershell
node --test tools/jira-report-draft/tests/core.test.cjs
node tools/jira-report-draft/tests/browser.test.cjs
```

Browser test cần `playwright` và Chrome. Có thể trỏ biến `QA_PLAYWRIGHT_MODULE` tới
package Playwright có sẵn, `QA_CHROME_PATH` tới Chrome/Edge. Tests dùng trang Jira
giả lập và API bị chặn bằng Playwright, không đăng nhập hay ghi lên Jira thật.

Nếu chưa có Playwright, cài riêng cho tool rồi chạy browser test:

```powershell
npm install --no-save --no-package-lock --prefix tools/jira-report-draft playwright
node tools/jira-report-draft/tests/browser.test.cjs
```

## Giới hạn

Jira có nhiều phiên bản editor; chưa kiểm tra trên editor của tenant Jira thật.
Tests kiểm tra textarea, contenteditable, mở ô comment, bảo toàn bản nháp và
không submit. Nếu tenant có editor khác hoặc trong iframe, dùng Sao chép/dán;
không tắt kiểm tra để ghi vào một ô không xác định.

Tài liệu nền:

- [Jira Cloud: đọc issue](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/).
- [Atlassian Document Format](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/).
- [Chrome: content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
