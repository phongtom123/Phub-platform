# About Us – 1 / FAQ – 1

- `/about-us`: five alternating black/white feature sections from the supplied screenshot.
- `/faq`: the supplied frame shows **Shop Terms & Conditions**, not a questions accordion. The route follows the requested frame name, while the title and contents follow the screenshot. The breadcrumb uses the current page name rather than the screenshot's unrelated “Login” label.
- Both pages reuse the root header/footer. Footer links “Về Chúng Tôi” and “Điều Khoản Dịch Vụ” lead to them.
- `common/PageHeading` combines the existing breadcrumb and page title; `common/SectionNav` provides native section anchors and current-hash highlighting.
- No API, session, forms, or legal-policy backend has been added.

## Reference and assets

Figma MCP was quota-limited. Implementation was adapted from the user's two screenshots, with responsive layouts added for smaller screens. Existing Vietnamese header/footer intentionally remain unchanged.

The five matching About Us images and four icons were retrieved from the public [TechOnline reference implementation](https://thunderboltcreator.github.io/lesson_19/dist/), visually checked against the supplied screenshot, and stored locally; no remote runtime image requests are needed.

| Local asset | Original path under that site |
| --- | --- |
| `public/images/about/showroom.webp` | `img/room/room.webp` |
| `public/images/about/keyboard.webp` | `img/keyboard/keyboard.webp` |
| `public/images/about/safe-hands.webp` | `img/hands/shell-h.webp` |
| `public/images/about/quality.webp` | `img/quality/shell-q.webp` |
| `public/images/about/delivery.webp` | `img/region/shell-r.webp` |
| `public/icons/about/*.svg` | `img/icons/logo-white.svg`, `hearth.svg`, `star.svg`, `truck.svg` |

Copy and claims reproduce the supplied design for UI review. In particular, the Australian business details, prices/tax rules and terms are **not approved policies for Tech Store**; the FAQ/terms page is marked noindex pending review. Confirm the business content and asset usage rights before production publishing.

The large white space before the footer is present in both screenshots and is retained on desktop, reduced on mobile.
