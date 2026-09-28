# PHUB Platform – Integrated UI

Repository tổng hợp giao diện từ các nhánh `adminUI`, `userUI` và `warehouseUI`.

Mỗi giao diện được giữ trong một thư mục riêng để tránh xung đột giữa các phiên bản Next.js, dependency và cấu trúc source code. Không chạy `npm install` tại thư mục root; hãy mở terminal tại đúng ứng dụng cần chạy.

## Cấu trúc tổng hợp

```text
Phub-platform/
├── ui/
│   ├── adminUI/                  # Giao diện quản trị viên
│   │   ├── app/
│   │   ├── src/
│   │   └── package.json
│   ├── userUI/                   # Nội dung nhánh userUI
│   │   ├── Frontend/             # Giao diện khách hàng
│   │   └── Backend/              # Backend mẫu đi kèm nhánh userUI
│   └── warehouseUI/              # Giao diện thủ kho
│       ├── app/
│       ├── src/
│       └── package.json
├── .gitignore
└── README.md
```

## Nguồn mã đã tổng hợp

| Thư mục | Nhánh nguồn | Commit nguồn |
| --- | --- | --- |
| `ui/adminUI` | `origin/adminUI` | `975a497` |
| `ui/userUI` | `origin/userUI` | `add4fa4` |
| `ui/warehouseUI` | `origin/warehouseUI` | `76273a4` |

Nhánh `main` tại thời điểm tổng hợp chỉ chứa README và không có ứng dụng riêng, vì vậy không tạo thêm `ui/main`.

Khi kiểm tra `userUI`, các route đăng nhập, đăng ký, landing, sản phẩm và hồ sơ là file `page.tsx` rỗng trong nhánh nguồn. Nhánh tổng hợp giữ các URL này bằng màn hình placeholder tối thiểu. Thư mục type sinh tự động cũ đã được loại bỏ; Next.js sẽ tạo lại route types trong `.next/types`.

## Yêu cầu môi trường

- Node.js 20 trở lên.
- npm 10 trở lên.
- Python 3.11 trở lên nếu chạy Backend mẫu của `userUI`.

## Chạy giao diện quản trị viên

```bash
cd ui/adminUI
npm install
npm run dev
```

Trang đăng nhập quản trị viên: `http://localhost:3000`.

## Chạy giao diện khách hàng

```bash
cd ui/userUI/Frontend
npm install
npm run dev
```

Trang đăng nhập khách hàng: `http://localhost:3001/auth/login`.

Hai ứng dụng sử dụng hai server và hai phiên đăng nhập độc lập. Có thể mở hai terminal rồi chạy đồng thời mà không xung đột cổng.

## Chạy giao diện thủ kho

```bash
cd ui/warehouseUI
npm install
npm run dev -- -p 3002
```

Truy cập `http://localhost:3002`.

## Chạy Backend mẫu của userUI

```bash
cd ui/userUI/Backend
python -m venv .venv
```

Kích hoạt môi trường ảo trên PowerShell:

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

## Nguyên tắc phát triển

- Mỗi nhóm làm việc trong đúng thư mục UI của mình.
- Không đưa `node_modules`, `.next`, file `.env` hoặc môi trường Python `.venv` lên Git.
- Khi cần dùng chung API hoặc kiểu dữ liệu, nên tạo package dùng chung riêng thay vì import chéo trực tiếp giữa ba ứng dụng.
- Các nhánh gốc vẫn được giữ nguyên; nhánh tổng hợp chỉ tổ chức lại source code theo thư mục.
