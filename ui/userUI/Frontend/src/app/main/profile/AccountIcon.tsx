import type { AccountView } from "./accountData";

type AccountIconName = AccountView | "surveys" | "reviews";
const paths: Record<AccountIconName, string> = {
  account: "M20 21v-2a7 7 0 0 0-14 0v2 M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  addresses: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  orders: "M6 3h12l3 5v13H3V8l3-5Z M3 8h18 M8 12a4 4 0 0 0 8 0",
  surveys: "M9 4H5v17h14V4h-4 M9 2h6v4H9V2Z M8 11l1 1 2-2 M13 11h3 M8 16l1 1 2-2 M13 16h3",
  reviews: "m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.4l-5.6 3 1.1-6.3L3 9.6l6.2-.9L12 3Z",
};

export function AccountIcon({ name }: { name: AccountIconName }) {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
