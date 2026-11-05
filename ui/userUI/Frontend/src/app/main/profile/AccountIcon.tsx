import type { AccountView } from "./accountData";

const paths: Record<AccountView, string> = {
  account: "M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  addresses: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  orders: "M6 3h12l3 5v13H3V8l3-5Z M3 8h18 M8 12a4 4 0 0 0 8 0",
};

export function AccountIcon({ name }: { name: AccountView }) {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
