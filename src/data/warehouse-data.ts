import type { FormFieldDefinition, ModuleDefinition, ModuleKey } from "@/src/types/warehouse";

export const moduleNames: Record<ModuleKey, string> = {
  dashboard: "Tổng quan", inventory: "Tồn kho", receipts: "Phiếu nhập", dispatches: "Phiếu xuất", transfers: "Chuyển kho", products: "Sản phẩm", history: "Lịch sử kho", pending: "Phiếu chờ xử lý", account: "Tài khoản", settings: "Cài đặt",
};

export const modules: Partial<Record<ModuleKey, ModuleDefinition>> = {
  inventory: {
    title: "Tồn kho", description: "Theo dõi số lượng sản phẩm tại Kho trung tâm.", searchPlaceholder: "Tìm tên hoặc mã sản phẩm...", filters: ["Tình trạng", "Khu vực"],
    columns: [{ key: "name", label: "SẢN PHẨM", kind: "product" }, { key: "location", label: "VỊ TRÍ" }, { key: "quantity", label: "TỒN HIỆN TẠI", kind: "strong" }, { key: "status", label: "TÌNH TRẠNG", kind: "status" }],
    rows: [
      { id: "SP-001", name: "NVIDIA GeForce RTX 4070 SUPER", code: "SP-001 · Card đồ họa", location: "A-01-02", quantity: 24, status: "Còn hàng" },
      { id: "SP-002", name: "AMD Ryzen 7 7800X3D", code: "SP-002 · Bộ vi xử lý", location: "A-02-06", quantity: 18, status: "Còn hàng" },
      { id: "SP-003", name: "Corsair Vengeance RGB 32GB", code: "SP-003 · RAM DDR5", location: "A-02-14", quantity: 5, status: "Còn hàng" },
      { id: "SP-005", name: "PHUB Creator Pro X1", code: "SP-005 · PC nguyên bộ", location: "—", quantity: 0, status: "Hết hàng" },
      { id: "SP-028", name: "Samsung 990 PRO 2TB", code: "SP-028 · SSD NVMe", location: "C-03-02", quantity: 4, status: "Còn hàng" },
    ], note: "Tồn kho thay đổi qua phiếu nhập, xuất đơn hoặc chuyển kho.",
  },
  receipts: {
    title: "Phiếu nhập", description: "Lập phiếu, tiếp nhận hàng và xác nhận số lượng thực nhận.", searchPlaceholder: "Tìm mã phiếu hoặc nhà cung cấp...", addLabel: "Tạo phiếu nhập", filters: ["Kho nhập", "Trạng thái"],
    columns: [{ key: "id", label: "MÃ PHIẾU", kind: "link" }, { key: "supplier", label: "NHÀ CUNG CẤP", kind: "strong" }, { key: "warehouse", label: "KHO NHẬP" }, { key: "items", label: "SẢN PHẨM" }, { key: "created", label: "NGÀY TẠO" }, { key: "status", label: "TRẠNG THÁI", kind: "status" }],
    rows: [
      { id: "PN-260927-03", supplier: "ASUS Việt Nam", warehouse: "Kho trung tâm", items: "4 SKU · 12 SP", created: "27/09/2026", status: "Chờ xác nhận" },
      { id: "PN-260926-01", supplier: "AMD Distribution VN", warehouse: "Kho trung tâm", items: "3 SKU · 18 SP", created: "26/09/2026", status: "Đã nhập" },
      { id: "PN-260925-02", supplier: "Corsair Việt Nam", warehouse: "Kho trung tâm", items: "5 SKU · 26 SP", created: "25/09/2026", status: "Nháp" },
    ], note: "Chỉ xác nhận nhập sau khi đối chiếu hàng thực nhận. Phiếu đã nhập không được cộng tồn lần nữa.",
  },
  transfers: {
    title: "Chuyển kho", description: "Theo dõi hàng luân chuyển giữa các kho và xác nhận giao nhận.", searchPlaceholder: "Tìm mã phiếu hoặc kho...", addLabel: "Tạo phiếu chuyển", filters: ["Trạng thái", "Kho nhận"],
    columns: [{ key: "id", label: "MÃ PHIẾU", kind: "link" }, { key: "from", label: "KHO XUẤT", kind: "strong" }, { key: "to", label: "KHO NHẬN", kind: "strong" }, { key: "items", label: "SỐ SKU" }, { key: "created", label: "NGÀY TẠO" }, { key: "status", label: "TRẠNG THÁI", kind: "status" }],
    rows: [
      { id: "CK-260927-02", from: "Kho trung tâm", to: "Kho Quận 1", items: "6 SKU · 28 SP", created: "27/09/2026", status: "Đang chuyển" },
      { id: "CK-260927-01", from: "Kho trung tâm", to: "Kho Thủ Đức", items: "3 SKU · 12 SP", created: "27/09/2026", status: "Chờ xác nhận" },
      { id: "CK-260924-02", from: "Kho trung tâm", to: "Kho Quận 1", items: "4 SKU · 16 SP", created: "24/09/2026", status: "Đã nhận" },
    ], note: "Kho xuất phải khác kho nhận. Tồn kho nhận chỉ tăng sau khi xác nhận nhận đủ hàng.",
  },
  dispatches: {
    title: "Phiếu xuất", description: "Theo dõi và xuất hàng từ các đơn hàng đã được tạo.", searchPlaceholder: "Tìm mã phiếu, đơn hàng hoặc người nhận...", filters: ["Kho xuất", "Trạng thái"],
    columns: [{ key: "id", label: "MÃ PHIẾU", kind: "link" }, { key: "order", label: "ĐƠN HÀNG", kind: "strong" }, { key: "warehouse", label: "KHO XUẤT" }, { key: "items", label: "SẢN PHẨM" }, { key: "created", label: "NGÀY TẠO" }, { key: "status", label: "TRẠNG THÁI", kind: "status" }],
    rows: [
      { id: "PX-260927-08", order: "PH240931", warehouse: "Kho trung tâm", items: "4 SKU · 7 SP", created: "27/09/2026", status: "Chờ xác nhận" },
      { id: "PX-260926-04", order: "PH240918", warehouse: "Kho trung tâm", items: "2 SKU · 3 SP", created: "26/09/2026", status: "Đã xuất" },
      { id: "PX-260925-02", order: "PH240905", warehouse: "Kho trung tâm", items: "1 SKU · 1 SP", created: "25/09/2026", status: "Đang soạn" },
    ], note: "Phiếu xuất được tạo từ đơn hàng. Đối chiếu đơn hàng và số lượng thực tế trước khi xác nhận xuất kho.",
  },
  products: {
    title: "Sản phẩm", description: "Tra cứu mã hàng, danh mục và thông tin sản phẩm trong kho.", searchPlaceholder: "Tìm tên hoặc mã sản phẩm...", filters: ["Danh mục", "Tình trạng tồn"],
    columns: [{ key: "name", label: "SẢN PHẨM", kind: "product" }, { key: "category", label: "DANH MỤC" }, { key: "brand", label: "THƯƠNG HIỆU" }, { key: "quantity", label: "TỒN KHO", kind: "strong" }, { key: "status", label: "TRẠNG THÁI", kind: "status" }],
    rows: [
      { id: "SP-001", name: "NVIDIA GeForce RTX 4070 SUPER", code: "SP-001", category: "Card đồ họa", brand: "ASUS", quantity: 24, status: "Còn hàng" },
      { id: "SP-002", name: "AMD Ryzen 7 7800X3D", code: "SP-002", category: "CPU", brand: "AMD", quantity: 18, status: "Còn hàng" },
      { id: "SP-003", name: "Corsair Vengeance RGB 32GB", code: "SP-003", category: "RAM", brand: "Corsair", quantity: 5, status: "Còn hàng" },
      { id: "SP-005", name: "PHUB Creator Pro X1", code: "SP-005", category: "PC nguyên bộ", brand: "PHUB", quantity: 0, status: "Hết hàng" },
    ],
  },
  history: {
    title: "Lịch sử kho", description: "Tra cứu các giao dịch làm thay đổi số lượng tồn kho.", searchPlaceholder: "Tìm mã giao dịch hoặc sản phẩm...", filters: ["Loại giao dịch", "Khoảng ngày"],
    columns: [{ key: "id", label: "MÃ GIAO DỊCH", kind: "link" }, { key: "type", label: "LOẠI" }, { key: "product", label: "SẢN PHẨM", kind: "strong" }, { key: "quantity", label: "SỐ LƯỢNG" }, { key: "user", label: "NGƯỜI THỰC HIỆN" }, { key: "created", label: "THỜI GIAN" }],
    rows: [
      { id: "PN-260927-03", type: "Nhập kho", product: "ASUS GeForce RTX 4070", quantity: "8", user: "Trần Đức Phong", created: "27/09/2026 09:42" },
      { id: "XK-260927-08", type: "Xuất đơn", product: "AMD Ryzen 7 7800X3D", quantity: "−2", user: "Trần Đức Phong", created: "27/09/2026 08:22" },
      { id: "CK-260924-02", type: "Nhận chuyển kho", product: "Corsair Vengeance RGB", quantity: "4", user: "Hoàng Thùy Linh", created: "24/09/2026 14:18" },
    ],
  },
  pending: {
    title: "Phiếu chờ xử lý", description: "Các phiếu nhập và chuyển kho đang cần thủ kho xác nhận.", searchPlaceholder: "Tìm mã phiếu hoặc kho...", filters: ["Loại phiếu", "Trạng thái"],
    columns: [{ key: "id", label: "MÃ PHIẾU", kind: "link" }, { key: "type", label: "LOẠI PHIẾU", kind: "strong" }, { key: "partner", label: "NHÀ CUNG CẤP / KHO", }, { key: "items", label: "SẢN PHẨM" }, { key: "created", label: "NGÀY TẠO" }, { key: "status", label: "TRẠNG THÁI", kind: "status" }],
    rows: [
      { id: "PN-260927-03", type: "Phiếu nhập", partner: "ASUS Việt Nam", items: "4 SKU · 12 SP", created: "27/09/2026", status: "Chờ xác nhận" },
      { id: "PN-260925-02", type: "Phiếu nhập", partner: "Corsair Việt Nam", items: "5 SKU · 26 SP", created: "25/09/2026", status: "Nháp" },
      { id: "PN-260924-04", type: "Phiếu nhập", partner: "AMD Distribution VN", items: "3 SKU · 18 SP", created: "24/09/2026", status: "Chờ xác nhận" },
      { id: "CK-260927-02", type: "Chuyển kho", partner: "Kho trung tâm → Kho Quận 1", items: "6 SKU · 28 SP", created: "27/09/2026", status: "Đang chuyển" },
      { id: "CK-260927-01", type: "Chuyển kho", partner: "Kho trung tâm → Kho Thủ Đức", items: "3 SKU · 12 SP", created: "27/09/2026", status: "Chờ xác nhận" },
    ], note: "Danh sách gộp các phiếu nhập và phiếu chuyển đang chờ thao tác.",
  },
};

export const formFields: Partial<Record<ModuleKey, FormFieldDefinition[]>> = {
  receipts: [
    { name: "supplier", label: "Nhà cung cấp", placeholder: "Chọn hoặc nhập nhà cung cấp" },
    { name: "warehouse", label: "Kho nhập", placeholder: "Kho trung tâm" },
    { name: "items", label: "Sản phẩm và số lượng", placeholder: "Tìm sản phẩm để thêm vào phiếu", wide: true },
    { name: "note", label: "Ghi chú giao nhận", placeholder: "Ghi chú nếu có", type: "textarea", wide: true },
  ],
  transfers: [
    { name: "from", label: "Kho xuất", placeholder: "Chọn kho nguồn" },
    { name: "to", label: "Kho nhận", placeholder: "Chọn kho nhận (khác kho xuất)" },
    { name: "items", label: "Sản phẩm và số lượng", placeholder: "Tìm sản phẩm để thêm vào phiếu", wide: true },
    { name: "note", label: "Ghi chú vận chuyển", placeholder: "Ghi chú nếu có", type: "textarea", wide: true },
  ],
  dispatches: [
    { name: "order", label: "Mã đơn hàng", placeholder: "Nhập hoặc tìm mã đơn hàng" },
    { name: "warehouse", label: "Kho xuất", placeholder: "Kho trung tâm" },
    { name: "items", label: "Sản phẩm và số lượng", placeholder: "Thêm sản phẩm, số lượng cần xuất", wide: true },
    { name: "receiver", label: "Người nhận / đơn vị vận chuyển", placeholder: "Nhập tên người nhận" },
    { name: "note", label: "Ghi chú xuất hàng", placeholder: "Ghi chú nếu có", type: "textarea", wide: true },
  ],
};
