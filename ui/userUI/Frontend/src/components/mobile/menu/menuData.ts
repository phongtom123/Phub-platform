export interface MenuItem {
  id: string;
  label: string;
}

export interface MenuCategory extends MenuItem {
  children: MenuItem[];
}

// Menu 1 and the Desktop PCs branch in Menu 2 follow Figma.
// Other branches are UI sample categories until the product taxonomy is connected.
export const menuCategories: MenuCategory[] = [
  { id: "laptops", label: "Laptop", children: [
    { id: "msi-ps-series", label: "MSI PS Series" },
    { id: "msi-gs-series", label: "MSI GS Series" },
    { id: "laptop-van-phong", label: "Laptop văn phòng" },
    { id: "laptop-gaming", label: "Laptop gaming" },
  ] },
  { id: "desktop-pcs", label: "Máy tính để bàn", children: [
    { id: "custom-pcs", label: "PC lắp ráp" },
    { id: "servers", label: "Máy chủ" },
    { id: "msi-all-in-one", label: "PC All-in-One MSI" },
    { id: "hp-compaq", label: "PC HP/Compaq" },
    { id: "asus-pcs", label: "PC ASUS" },
    { id: "tecs-pcs", label: "PC TECS" },
  ] },
  { id: "networking", label: "Thiết bị mạng", children: [
    { id: "routers", label: "Bộ định tuyến" },
    { id: "switches", label: "Bộ chuyển mạch" },
    { id: "wifi", label: "Thiết bị Wi-Fi" },
  ] },
  { id: "printers", label: "Máy in và máy quét", children: [
    { id: "printers", label: "Máy in" },
    { id: "scanners", label: "Máy quét" },
  ] },
  { id: "pc-parts", label: "Linh kiện PC", children: [
    { id: "cpu", label: "Vi xử lý" },
    { id: "graphics", label: "Card đồ họa" },
    { id: "memory", label: "Bộ nhớ RAM" },
    { id: "storage", label: "Ổ cứng" },
  ] },
  { id: "other", label: "Sản phẩm khác", children: [
    { id: "monitors", label: "Màn hình" },
    { id: "accessories", label: "Phụ kiện" },
    { id: "audio", label: "Loa và tai nghe" },
  ] },
  { id: "repairs", label: "Sửa chữa", children: [
    { id: "desktop-repair", label: "Sửa máy tính để bàn" },
    { id: "laptop-repair", label: "Sửa laptop" },
  ] },
];

export function findMenuCategory(id: string) {
  return menuCategories.find(category => category.id === id);
}

export function findMenuItem(categoryId: string, itemId: string) {
  return findMenuCategory(categoryId)?.children.find(item => item.id === itemId);
}

export function menuItemHref(categoryId: string, itemId: string) {
  return `/main/product?menuCategory=${encodeURIComponent(categoryId)}&menuItem=${encodeURIComponent(itemId)}`;
}
