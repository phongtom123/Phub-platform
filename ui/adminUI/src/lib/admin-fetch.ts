/** UI invalidation only. Authorization remains on every protected backend API. */
export const ADMIN_SESSION_EXPIRED = "phub-admin-session-expired";
let sessionEpoch = 0;

export const getSessionEpoch = () => sessionEpoch;
export const advanceSessionEpoch = () => ++sessionEpoch;

export async function adminFetch(input: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const epoch = getSessionEpoch();
  const response = await fetch(input, options);
  // A response started under a previous login must not affect the new session.
  if (epoch !== getSessionEpoch()) throw new DOMException("Phiên đăng nhập đã thay đổi.", "AbortError");
  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EXPIRED, { detail: epoch }));
  }
  // A resource-level 403 is a permission error, not evidence of an expired session.
  return response;
}
