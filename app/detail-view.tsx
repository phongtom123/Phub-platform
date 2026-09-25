"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  Package,
  Pencil,
  Printer,
  ReceiptText,
  ShieldCheck,
  Truck,
  UserRound,
  Warehouse,
} from "lucide-react";

type DetailConfig = {
  label: string;
  title: string;
  subtitle: string;
  status: string;
  icon: React.ElementType;
  fields: Array<[string, string]>;
  note: string;
};

const labels: Record<string, string> = {
  orders: "Đơn hàng",
  accounts: "Tài khoản",
  products: "Sản phẩm",
  categories: "Danh mục",
  promotions: "Khuyến mãi",
  vouchers: "Voucher",
  branches: "Chi nhánh",
  warehouses: "Kho hàng",
  employees: "Nhân viên",
  customers: "Khách hàng",
  suppliers: "Nhà cung cấp",
  receipts: "Phiếu nhập",
  transfers: "Chuyển kho",
  payments: "Thanh toán",
  invoices: "Hóa đơn",
};

function getConfig(section: string, id: string): DetailConfig {
  const common = {
    label: labels[section] ?? "Chi tiết",
    title: id,
    subtitle: `Mã bản ghi ${id}`,
    status: "Hoạt động",
    icon: FileText,
    fields: [
      ["Mã bản ghi", id],
      ["Ngày cập nhật", "25/09/2026, 10:24"],
      ["Người cập nhật", "Nguyễn Minh Thịnh · NV001"],
      ["Trạng thái", "Hoạt động"],
    ] as Array<[string, string]>,
    note: "Dữ liệu đang hiển thị là dữ liệu mô phỏng cho giao diện tĩnh.",
  };

  const configs: Record<string, Partial<DetailConfig>> = {
    orders: {
      title: `#${id}`,
      subtitle: "Đặt lúc 10:24, ngày 25/09/2026 · Kênh ONLINE",
      status: "Mới",
      icon: ReceiptText,
      fields: [
        ["Khách hàng", "Nguyễn Hoàng Nam · KH00128"],
        ["Chi nhánh tiếp nhận", "Chi nhánh Quận 1"],
        ["Nhân viên xử lý", "Chưa phân công"],
        ["Thanh toán", "Chuyển khoản · Thành công"],
        ["Người nhận", "Nguyễn Hoàng Nam · 0903 456 789"],
        ["Địa chỉ giao hàng", "28 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP.HCM"],
      ],
      note: "Đơn chỉ được trừ tồn khi toàn bộ dòng hàng chuyển sang trạng thái Đã xuất kho.",
    },
    accounts: {
      title: id,
      subtitle: "Tài khoản nhân viên · Đăng nhập gần nhất hôm nay, 08:12",
      status: "Hoạt động",
      icon: ShieldCheck,
      fields: [
        ["Chủ tài khoản", "Nguyễn Minh Thịnh · NV001"],
        ["Email", "thinh@phub.vn"],
        ["Vai trò", "ADMIN"],
        ["Phạm vi", "Toàn hệ thống"],
        ["Ngày tạo", "12/01/2026"],
        ["Trạng thái", "Hoạt động"],
      ],
      note: "Một tài khoản chỉ liên kết với một khách hàng hoặc một nhân viên, không đồng thời cả hai.",
    },
    products: {
      title: id === "SP-001" ? "NVIDIA GeForce RTX 4070 SUPER" : id,
      subtitle: `${id} · LINH_KIEN · Card đồ họa`,
      status: "Đang bán",
      icon: Package,
      fields: [
        ["Thương hiệu", "ASUS"],
        ["Giá bán hiện tại", "18.990.000đ"],
        ["Đơn vị", "Cái"],
        ["Bảo hành", "36 tháng"],
        ["Tổng tồn", "24 sản phẩm tại 3 kho"],
        ["Danh mục", "Card đồ họa · GPU"],
      ],
      note: "Giá và tên sản phẩm đã chốt trên đơn cũ không thay đổi khi cập nhật sản phẩm.",
    },
    categories: {
      title: id === "GPU" ? "Card đồ họa" : id,
      subtitle: `Danh mục ${id}`,
      icon: Package,
      fields: [
        ["Mã danh mục", id],
        ["Số sản phẩm", "32"],
        ["Đang kinh doanh", "29"],
        ["Ngừng kinh doanh", "3"],
      ],
    },
    promotions: {
      title: "Chào thu – Build PC cực chất",
      subtitle: `Chương trình #${id} · 01/09/2026 – 30/09/2026`,
      status: "Đang diễn ra",
      icon: CircleAlert,
      fields: [
        ["Người tạo", "Nguyễn Minh Thịnh · NV001"],
        ["Số voucher", "3"],
        ["Đã sử dụng", "342 / 500 lượt"],
        ["Phạm vi", "Toàn bộ sản phẩm và chi nhánh"],
      ],
    },
    vouchers: {
      title: id,
      subtitle: "Voucher thuộc chương trình Chào thu – Build PC cực chất",
      icon: CreditCard,
      fields: [
        ["Loại giảm", "PHAN_TRAM"],
        ["Giá trị", "10% · Tối đa 300.000đ"],
        ["Đơn tối thiểu", "5.000.000đ"],
        ["Giới hạn", "300 lượt · 1 lượt/khách"],
        ["Đã sử dụng", "210 lượt"],
        ["Còn lại", "90 lượt"],
      ],
      note: "Mỗi đơn chỉ áp dụng tối đa một voucher và lượt dùng chỉ được ghi nhận khi xác nhận đơn.",
    },
    branches: {
      title: "Chi nhánh Quận 1",
      subtitle: `${id} · Đơn vị tiếp nhận đơn và ghi nhận doanh thu`,
      icon: Building2,
      fields: [
        ["Địa chỉ", "28 Nguyễn Huệ, P. Bến Nghé, Quận 1"],
        ["Điện thoại", "028 3822 8899"],
        ["Số kho", "2"],
        ["Nhân viên", "8"],
        ["Đơn tháng này", "186"],
        ["Doanh thu tháng", "2,18 tỷ đồng"],
      ],
    },
    warehouses: {
      title: id === "KHO-00" ? "Kho trung tâm" : "Kho bán hàng Quận 1",
      subtitle: `${id} · Địa điểm lưu trữ hàng hóa`,
      icon: Warehouse,
      fields: [
        [
          "Chi nhánh quản lý",
          id === "KHO-00" ? "Không thuộc chi nhánh" : "Chi nhánh Quận 1",
        ],
        ["Địa chỉ", "KCN Tân Tạo, Quận Bình Tân"],
        ["Số SKU", "236"],
        ["Tổng số lượng", "1.842"],
        ["Phiếu đang xử lý", "4"],
        ["Nhân viên phụ trách", "Trần Đức Phong · NV002"],
      ],
    },
    employees: {
      title: id === "NV001" ? "Nguyễn Minh Thịnh" : "Trần Đức Phong",
      subtitle: `${id} · Hồ sơ nhân viên`,
      icon: UserRound,
      fields: [
        ["Loại nhân viên", id === "NV001" ? "ADMIN" : "THU_KHO"],
        ["Chi nhánh chính", id === "NV001" ? "Trung tâm" : "Chi nhánh Quận 1"],
        ["CCCD", "0792••••••42"],
        ["Email", "employee@phub.vn"],
        ["Số điện thoại", "0903 111 222"],
        ["Mức lương", "12.000.000đ"],
      ],
    },
    customers: {
      title: "Nguyễn Hoàng Nam",
      subtitle: `${id} · Khách hàng từ tháng 01/2026`,
      icon: UserRound,
      fields: [
        ["Số điện thoại", "0903 456 789"],
        ["Địa chỉ mặc định", "P. Bến Nghé, Quận 1, TP.HCM"],
        ["Tổng đơn", "8"],
        ["Đơn hoàn thành", "7"],
        ["Tổng chi tiêu", "86.420.000đ"],
        ["Tài khoản", "Hoạt động"],
      ],
    },
    suppliers: {
      title: "ASUS Việt Nam",
      subtitle: `${id} · Đối tác cung cấp hàng hóa`,
      icon: Truck,
      fields: [
        ["Điện thoại", "028 7300 1234"],
        ["Email", "sales@asus.vn"],
        ["Địa chỉ", "Quận 7, TP. Hồ Chí Minh"],
        ["Tổng phiếu nhập", "18"],
        ["Giá trị đã nhập", "2,84 tỷ đồng"],
        ["Phiếu gần nhất", "25/09/2026"],
      ],
    },
    receipts: {
      title: id,
      subtitle: "Phiếu nhập từ ASUS Việt Nam · Tạo ngày 25/09/2026",
      status: "Nháp",
      icon: ReceiptText,
      fields: [
        ["Nhà cung cấp", "ASUS Việt Nam · NCC-001"],
        ["Kho nhập", "Kho trung tâm · KHO-00"],
        ["Người tạo", "Nguyễn Minh Thịnh · NV001"],
        ["Số sản phẩm", "4 SKU"],
        ["Tổng số lượng", "24"],
        ["Tổng giá trị nhập", "286.400.000đ"],
      ],
      note: "Tồn kho chỉ tăng một lần khi phiếu được xác nhận Đã nhập.",
    },
    transfers: {
      title: id,
      subtitle: "Phiếu điều chuyển nội bộ · Tạo ngày 25/09/2026",
      status: "Đang chuyển",
      icon: Truck,
      fields: [
        ["Kho xuất", "Kho trung tâm · KHO-00"],
        ["Kho nhận", "Kho bán hàng Quận 1 · KHO-01"],
        ["Người tạo", "Nguyễn Minh Thịnh · NV001"],
        ["Người xuất", "Trần Đức Phong · NV002"],
        ["Số sản phẩm", "6 SKU · 28 sản phẩm"],
        ["Ngày xuất", "25/09/2026, 09:40"],
      ],
      note: "Kho nguồn đã trừ tồn; kho đích chỉ cộng tồn sau khi xác nhận Đã nhận.",
    },
    payments: {
      title: id,
      subtitle: "Giao dịch thu cho đơn hàng #PH240901",
      status: "Thành công",
      icon: CreditCard,
      fields: [
        ["Đơn hàng", "#PH240901"],
        ["Loại giao dịch", "THU"],
        ["Phương thức", "CHUYỂN KHOẢN"],
        ["Số tiền", "24.380.000đ"],
        ["Mã đối soát", "VCB2609251024"],
        ["Thời gian", "25/09/2026, 10:25"],
      ],
      note: "Mã đối soát là duy nhất; thông báo thành công lặp lại không được ghi nhận tiền thêm lần nữa.",
    },
    invoices: {
      title: id,
      subtitle: "Hóa đơn của đơn hàng #PH240901 · Lập ngày 25/09/2026",
      status: "Đã lập",
      icon: ReceiptText,
      fields: [
        ["Người mua", "Nguyễn Hoàng Nam"],
        ["Mã số thuế", "Không cung cấp"],
        ["Tổng trước thuế", "22.163.636đ"],
        ["Tiền thuế", "2.216.364đ"],
        ["Tổng sau thuế", "24.380.000đ"],
        ["Người lập", "Nguyễn Minh Thịnh · NV001"],
      ],
      note: "Nội dung hóa đơn đã chốt không thay đổi khi tên hoặc giá sản phẩm được cập nhật sau đó.",
    },
  };

  return {
    ...common,
    ...configs[section],
    label: labels[section] ?? common.label,
  };
}

function Status({ children }: { children: string }) {
  return (
    <span className="detail-status-badge">
      <i /> {children}
    </span>
  );
}

export default function DetailView({
  section,
  id,
}: {
  section: string;
  id: string;
}) {
  const router = useRouter();
  const detail = getConfig(section, id);
  const Icon = detail.icon;
  const isOrder = section === "orders";
  const isDocument = section === "receipts" || section === "transfers";

  return (
    <div className="detail-page">
      <header className="detail-topbar">
        <Link href="/" className="detail-logo" aria-label="Về Tổng quan">
          <b>P</b>
          <strong>PHUB</strong>
          <em>admin</em>
        </Link>
        <nav>
          <Link href="/">Quản trị</Link>
          <ChevronRight />
          <span>{detail.label}</span>
          <ChevronRight />
          <b>{id}</b>
        </nav>
        <div className="detail-user">
          <button aria-label="Thông báo">
            <Bell />
          </button>
          <i>NT</i>
          <span>
            <b>Minh Thịnh</b>
            <small>Quản trị viên</small>
          </span>
        </div>
      </header>

      <main className="detail-content">
        <button className="detail-back" onClick={() => router.back()}>
          <ArrowLeft /> Quay lại danh sách
        </button>

        <section className="detail-hero">
          <div className="detail-hero-icon">
            <Icon />
          </div>
          <div>
            <span>{detail.label.toUpperCase()}</span>
            <h1>{detail.title}</h1>
            <p>{detail.subtitle}</p>
          </div>
          <Status>{detail.status}</Status>
          <div className="detail-hero-actions">
            <button>
              <Printer /> In / Xuất
            </button>
            <Link
              className="detail-primary"
              href={`/${section}/${encodeURIComponent(id)}/edit`}
            >
              <Pencil /> Chỉnh sửa
            </Link>
          </div>
        </section>

        {isOrder && (
          <section className="detail-progress">
            {["Mới", "Xác nhận", "Chuẩn bị", "Xuất kho", "Hoàn thành"].map(
              (step, index) => (
                <div className={index === 0 ? "active" : ""} key={step}>
                  <i>{index === 0 ? <Check /> : index + 1}</i>
                  <span>{step}</span>
                </div>
              ),
            )}
          </section>
        )}

        <div className="detail-layout">
          <section className="detail-card detail-information">
            <header>
              <h2>Thông tin chi tiết</h2>
              <span>Cập nhật gần nhất hôm nay</span>
            </header>
            <div className="detail-fields">
              {detail.fields.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          </section>

          <aside className="detail-card detail-activity">
            <header>
              <h2>Lịch sử hoạt động</h2>
            </header>
            <ol>
              <li>
                <i>
                  <Check />
                </i>
                <p>
                  <b>Tạo bản ghi</b>
                  <span>Nguyễn Minh Thịnh · 25/09/2026, 10:24</span>
                </p>
              </li>
              <li>
                <i>
                  <Clock3 />
                </i>
                <p>
                  <b>Cập nhật thông tin</b>
                  <span>Hệ thống · 25/09/2026, 10:25</span>
                </p>
              </li>
              <li>
                <i>
                  <ShieldCheck />
                </i>
                <p>
                  <b>Kiểm tra hợp lệ</b>
                  <span>Tất cả ràng buộc đều hợp lệ</span>
                </p>
              </li>
            </ol>
          </aside>
        </div>

        {(isOrder || isDocument) && (
          <section className="detail-card detail-items">
            <header>
              <h2>Danh sách sản phẩm</h2>
              <span>2 dòng hàng</span>
            </header>
            <div className="detail-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SẢN PHẨM</th>
                    <th>KHO</th>
                    <th>SỐ LƯỢNG</th>
                    <th>ĐƠN GIÁ</th>
                    <th>THÀNH TIỀN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <b>NVIDIA GeForce RTX 4070 SUPER</b>
                      <small>SP-001</small>
                    </td>
                    <td>Kho trung tâm</td>
                    <td>1</td>
                    <td>18.990.000đ</td>
                    <td>
                      <b>18.990.000đ</b>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <b>Corsair Vengeance RGB 32GB</b>
                      <small>SP-003</small>
                    </td>
                    <td>Kho Quận 1</td>
                    <td>2</td>
                    <td>2.845.000đ</td>
                    <td>
                      <b>5.690.000đ</b>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="detail-rule">
          <CircleAlert />
          <div>
            <b>Quy tắc nghiệp vụ</b>
            <p>{detail.note}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
