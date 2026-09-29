# Account – 1: UI preview

Route: `/main/profile`. Reproduces the supplied screenshot's My Dashboard layout; reuses the existing root header/footer and `PageHeading`, `Button`, `TextField`, `Checkbox` components. Figma was quota-limited, so the supplied screenshot is the visual reference.

- Sidebar includes all 10 entries and the compare/wishlist empty summaries.
- Default view shows contact information, newsletters, default billing and shipping addresses.
- Edit buttons open accessible native dialogs. Contact/address validation is browser-side; newsletter is a local checkbox.
- Save updates React state only. Cancel/Escape discards changes and restores focus. Reload restores the fixture.
- Password changes show an explicit unavailable message: no passwords are collected or saved.
- Other navigation entries show empty preview states, not invented orders or payments.
- No API, authentication, localStorage, cookies, database writes or real subscriptions.
- Header remains in guest mode; a dashboard preview is not an authenticated session.

Data lives in `accountData.ts`; dashboard composition and interactions in `AccountDashboard.tsx`; forms in `AccountEditor.tsx`. The feature-specific components stay here instead of being added to `common` prematurely.
