# PHUB Customer Frontend

Frontend khách hàng tại `ui/userUI/Frontend`. Home, catalog và chi tiết sản phẩm lấy dữ liệu API; hồ sơ/đơn hàng dùng phiên đăng nhập thật. Không có sản phẩm, đánh giá, giỏ hàng hay hồ sơ mẫu thay thế.

`/main/landing` hiển thị cùng Home với `/`. Giỏ hàng, checkout, đăng ký và liên hệ chưa kết nối đầy đủ nghiệp vụ API; không báo gửi/đặt hàng thành công giả.

Hướng dẫn chạy catalog với Backend, bao gồm cách xử lý Windows chặn SWC native
và PowerShell chặn script, nằm trong [CATALOG-INTEGRATION.md](CATALOG-INTEGRATION.md#chạy-local).
Giao diện khách hàng dùng cổng 3001 để chạy cùng admin ở cổng 3000.

Các route chính: `/`, `/main/product`, `/main/product?view=list`, `/main/product/{id-thực}`, `/auth/login`, `/auth/register`, `/main/profile`, `/about-us`, `/faq`.

## Getting Started

First, run the development server:

```bash
npm run dev -- -p 3001
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


Phub-platform/
├── frontend/                    # Next.js UI
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (main)/
│   │   │   ├── feed/page.tsx
│   │   │   ├── recipes/page.tsx
│   │   │   ├── recipes/[id]/page.tsx
│   │   │   └── profile/[id]/page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                  # Button, Input, Modal, Card
│   │   ├── layout/              # Header, Sidebar, BottomNav
│   │   ├── recipe/              # RecipeCard, RecipeGrid
│   │   └── video/
│   ├── features/
│   │   ├── auth/
│   │   ├── recipes/
│   │   ├── feed/
│   │   └── profile/
│   ├── lib/
│   │   ├── api.ts               # API client
│   │   ├── auth.ts
│   │   └── constants.ts
│   ├── hooks/
│   ├── types/
│   └── public/
│
├── backend/                     # FastAPI MVC
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── models/              # Model: SQLAlchemy tables
│   │   │   ├── user.py
│   │   │   ├── recipe.py
│   │   │   └── comment.py
│   │   ├── schemas/             # Request/Response DTO
│   │   │   ├── user.py
│   │   │   └── recipe.py
│   │   ├── controllers/         # HTTP routes
│   │   │   ├── auth.py
│   │   │   ├── recipes.py
│   │   │   └── users.py
│   │   ├── services/            # Business logic
│   │   │   ├── auth_service.py
│   │   │   └── recipe_service.py
│   │   ├── repositories/        # Database queries
│   │   │   ├── user_repository.py
│   │   │   └── recipe_repository.py
│   │   └── tests/
│   ├── requirements.txt
│   └── .env
│
├── README.md
└── .gitignore

## UI local → API Render

Đặt `PHUB_API_BASE_URL=https://phub-api.onrender.com` trong `.env.local` rồi khởi động lại Next.js. Không cần secret Supabase trong UI. Xem yêu cầu Origin, cookie và phiên bản endpoint trong [README gốc](../../../README.md).
