/** The customer portal is a separate application; never redirect Admin to itself. */
export function customerPortalUrl(configuredUrl: string, adminUrl: string): string {
  let target: URL;
  try {
    target = new URL(configuredUrl);
  } catch {
    throw new Error("Địa chỉ website khách hàng không hợp lệ.");
  }
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) {
    throw new Error("Địa chỉ website khách hàng không hợp lệ.");
  }
  if (target.origin === new URL(adminUrl).origin) {
    throw new Error("Phiên hiện tại là tài khoản khách hàng. Địa chỉ website khách hàng đang trùng trang Admin. Hãy đăng xuất để đăng nhập bằng tài khoản Admin.");
  }
  return target.href;
}
