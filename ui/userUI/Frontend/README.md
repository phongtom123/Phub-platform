# PHUB Customer Frontend

Đây là bản Frontend chính tại `ui/userUI/Frontend`, được chuyển từ thư mục `Frontend` ngoài `ui`, giữ nguyên Home, Catalog Grid/List, About Us, FAQ, Dashboard và dữ liệu mẫu hiện tại.

Đã bổ sung đăng nhập mẫu, trang đăng ký tạm và route chi tiết sản phẩm từ commit `699ff4c`. `/main/landing` hiển thị cùng Home với `/`. Chi tiết đầy đủ về cách gộp và giới hạn nằm trong [MERGE-NOTES.md](MERGE-NOTES.md).

Chạy từ thư mục này bằng `npm run dev` → `http://localhost:3000`. Nếu admin đang dùng cổng 3000, chạy `npm run dev -- -p 3001` (và dừng bản UI khách hàng cũ trên cổng đó nếu cần).

Các route chính: `/`, `/main/product`, `/main/product?view=list`, `/main/product/ps-001`, `/auth/login`, `/auth/register`, `/main/profile`, `/about-us`, `/faq`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
├── docker-compose.yml
├── README.md
└── .gitignore
