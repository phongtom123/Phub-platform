export interface MenuItem {
  id: string;
  label: string;
}

export interface MenuCategory extends MenuItem {
  children: MenuItem[];
}

// Không có taxonomy mẫu; MobileCategoryDrawer đọc loại sản phẩm từ API.
export const menuCategories: MenuCategory[] = [];

export function findMenuCategory(id: string) {
  return menuCategories.find(category => category.id === id);
}

export function findMenuItem(categoryId: string, itemId: string) {
  return findMenuCategory(categoryId)?.children.find(item => item.id === itemId);
}

export function menuItemHref(categoryId: string, itemId: string) {
  return `/main/product?menuCategory=${encodeURIComponent(categoryId)}&menuItem=${encodeURIComponent(itemId)}`;
}
