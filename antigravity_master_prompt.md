# MASTER PROMPT: MCA INVENTORY MANAGEMENT SYSTEM WITH PHONE-CAMERA BARCODE SCANNING (ENHANCED)

Act as a senior full-stack developer, software architect, UI/UX designer, performance engineer, database engineer, and QA engineer.

Develop a complete, functional MCA college mini project named:

**Inventory Management System with Phone-Camera Barcode Scanner Integration**

The project must use the specified technology stack, work **perfectly on both desktop and Android mobile browsers with purpose-designed screens for each**, load and respond **fast**, and be suitable for a live college demonstration and viva examination.

Do not generate a fake dashboard with static data. Build a working application with a real backend, MongoDB Atlas integration, validated business logic, and properly connected frontend features.

---

## 1. MANDATORY TECHNOLOGY STACK

**Frontend**
- Angular (latest stable) with TypeScript, standalone components.
- SCSS for styling, using design tokens (CSS variables) for colors, spacing, radius, and typography.
- Angular Router with lazy-loaded feature routes.
- Angular Reactive Forms.
- Angular services and HttpClient with interceptors (auth token, error handling, loading state).
- Responsive, mobile-first design (see Sections 11 and 12).

**Backend**
- Node.js, Express.js, REST APIs.
- Mongoose for MongoDB integration.
- Zod or an equivalent validation library.
- bcrypt for password hashing.
- JWT authentication with secure token handling.
- Helmet, CORS configuration, login rate limiting, and response compression.

**Database**
- MongoDB Atlas cloud database (free tier compatible).
- Proper schemas, validation, and indexes.
- Unique product SKU, optional unique barcode (sparse unique index), and unique invoice number.
- Consistent stock transactions and movement history.

**Barcode scanning**
- Use a maintained ZXing-based Angular-compatible barcode library.
- Support scanning through the Android phone camera (rear camera preferred).
- Support EAN-13, EAN-8, UPC-A, UPC-E, and Code 128 where supported by the selected library.
- Allow manual barcode entry when camera access is unavailable.
- Support USB barcode scanners (keyboard-wedge) as an optional enhancement.

**Development tools**
- Google Antigravity, Git and GitHub, Postman for API testing.

Do not replace Angular with React, MongoDB with Firebase, or the specified backend with another stack.

---

## 2. DEVELOPMENT WORKFLOW

First inspect the existing workspace, installed dependencies, existing files, and available project configuration. If the workspace is empty, initialize the project correctly.

Use this structure:

```
inventory-management-system/
  client/
  server/
  docs/
  .gitignore
  README.md
```

Keep frontend and backend separate.

Implement in phases:

- **Phase 1:** Project setup, responsive app shell (desktop sidebar + mobile layout), backend setup, database connection.
- **Phase 2:** Authentication, login, logout, admin and staff roles.
- **Phase 3:** Product and category management.
- **Phase 4:** Supplier and purchase management.
- **Phase 5:** Sales, invoices, and stock updates.
- **Phase 6:** Phone-camera barcode scanning.
- **Phase 7:** Dashboard, alerts, analytics, and reports.
- **Phase 8:** Performance pass, testing, security review, documentation, and deployment.

Before implementing a phase, explain its scope. After implementation, run available checks (build, lint, tests), fix errors, and summarize what actually works.

Do not stop after producing a plan. Implement and verify Phase 1, then continue with subsequent phases where practical. If the task is too large for one session, leave the repository in a working state and clearly identify the next phase. Do not replace working code unnecessarily.

---

## 3. USER AUTHENTICATION AND ROLES

Implement: login and logout, admin and staff roles, password hashing, protected Angular routes (guards), backend authentication middleware, server-side role authorization, validation for all authentication inputs, and account status checks (active/disabled).

**Admin can:** manage users; manage products, categories, suppliers; manage purchases and sales; view reports and inventory history; configure reorder thresholds.

**Staff can:** view products; scan barcodes; record permitted purchases and sales; view relevant inventory information.

Never rely only on hiding buttons in the frontend. Enforce permissions in the backend.

Do not create a public admin-registration endpoint. Provide a documented, secure way to create the initial admin account (for example a one-time seed script reading credentials from environment variables).

---

## 4. PRODUCT AND CATEGORY MANAGEMENT

Each product includes: name, unique SKU, optional unique barcode, category, description, purchase price, selling price, current stock quantity, minimum stock/reorder level, unit of measurement, optional image URL, created/updated timestamps, and active/archived status.

Features:
- Add, edit, search, filter, and view products.
- Server-side pagination for product lists (default 20 per page).
- Validate prices and quantities.
- Prevent duplicate SKUs and barcodes.
- Display low-stock and out-of-stock indicators.
- Support barcode lookup.

Do not hard-delete products that have historical sales or purchases. Use archiving or appropriate validation.

---

## 5. SUPPLIER MANAGEMENT

Supplier name, contact person, phone, email, address, notes, active status. Provide supplier search, editing, and purchase-history views.

---

## 6. PURCHASE MANAGEMENT

Purchase number, supplier, purchase date, product line items, quantity and unit purchase cost, subtotal and total, purchase status.

Required behavior:
- Draft purchases must not increase stock.
- Receiving a purchase must increase stock exactly once.
- Receiving the same purchase twice must not duplicate stock.
- Store stock movements for audit purposes.
- Validate quantities, prices, and supplier references.
- Preserve purchase history.

---

## 7. SALES AND BILLING

Unique invoice number, sale date, line items, quantity, unit selling price, line total, grand total, staff member who processed the sale, sale status.

Required behavior:
- Scan or search for products; add them to a sale.
- Change quantities and remove line items before confirmation.
- Calculate totals automatically.
- Validate available stock on the server at commit time.
- Prevent overselling.
- Reduce stock only when the sale is successfully completed.
- Store historical prices in sale records.
- Prevent duplicate processing of a sale (idempotency key or status check).
- Provide a print-friendly invoice view (dedicated `@media print` stylesheet).

Use database transactions where supported by the MongoDB Atlas deployment. If a transaction cannot be completed, do not leave partial stock updates or incomplete sales.

---

## 8. PHONE-CAMERA BARCODE SCANNER

This is a core feature and must work on a real Android phone.

Create a dedicated barcode scanning screen with:
- Start Camera / Stop Camera buttons.
- Camera permission handling (explicit user permission).
- Live camera preview with a clear scanning frame/guide overlay.
- Prefer the rear camera; allow camera switching when multiple cameras exist; optional torch toggle where supported.
- Display the detected barcode value.
- Backend product lookup, showing product name, SKU, selling price, and available stock.
- "Add to Sale" and "Add to Purchase" actions.
- Unknown barcode handling (offer to open "Create product with this barcode" for admins).
- Manual barcode entry as a fallback, plus USB scanner input support.
- Debounce/cooldown (e.g. 1.5 seconds) and same-code suppression so repeated detections do not add duplicate line items accidentally. Provide vibration/beep feedback on successful scan where supported.
- Stop all camera streams when scanning ends, when the component is destroyed, or when the user navigates away or the tab is hidden.
- Handle permission denial, no camera, insecure context, and unsupported devices gracefully with clear instructions.

Use HTTPS in deployment and localhost during local development. For testing on a real phone during development, document how to expose the dev server securely over HTTPS (e.g. a free tunnel or locally trusted certificate) because mobile browsers block camera access on plain HTTP.

Do not assume scanning a barcode automatically creates a product. Products must first be registered with their barcode values, unless the user explicitly creates a new product.

---

## 9. INVENTORY AND STOCK MOVEMENT

Create a stock movement collection recording: product, movement type (purchase, sale, adjustment, reversal), quantity change, previous quantity, new quantity, reference transaction, user, timestamp, optional reason.

Rules:
- Purchase receipt increases stock; completed sale decreases stock.
- Manual adjustments require authorization and a reason.
- Stock cannot become negative.
- Every successful stock change has a corresponding movement record.
- Repeated requests must not duplicate the same movement.
- Failed operations must not leave inconsistent records.

---

## 10. DASHBOARD AND REPORTS

Responsive dashboard showing real values from MongoDB through the backend.

**Cards:** total active products, total units in stock, today's sales, monthly sales, low-stock products, out-of-stock products, recent purchases, recent sales.

**Charts:** sales by day, monthly sales trend, best-selling products, stock distribution by category. Use a lightweight chart library, lazy-loaded only on the dashboard/reports routes. Charts must resize correctly on mobile.

**Reports:** current inventory, low-stock, out-of-stock, sales by date range, purchases by date range, product movement history.

Provide search, date filters, pagination, and CSV export where appropriate. Compute dashboard figures with MongoDB aggregation pipelines on the server (not by loading all documents into the client). Do not hardcode dashboard totals or chart values; everything displayed must come from actual API responses.

---

## 11. UI/UX REQUIREMENTS

Create a professional inventory administration interface: clean, modern dashboard; dark navy or slate sidebar with a light content area; restrained blue accent; readable typography; consistent spacing; reusable components; clear loading indicators (skeletons or spinners); empty states and error messages; confirmation dialogs for important actions; toast notifications for success; accessible form labels, focus states, and keyboard navigation; no excessive animations.

Sidebar / navigation items:
Dashboard, Products, Categories, Suppliers, Purchases, Sales, Barcode Scanner, Stock Movements, Reports, User Management, Settings, Logout.

Build a shared component library: page header, data table/card list, search bar, filter chips, pagination, status badge, stat card, confirm dialog, toast service, empty state, loading skeleton, form field wrapper.

---

## 12. RESPONSIVE DESIGN: SEPARATE, PROPER SCREENS FOR MOBILE AND DESKTOP (MANDATORY)

The application must not be a shrunken desktop site on a phone. Design each screen intentionally for both form factors and test both.

**Breakpoints (mobile-first):**
- Mobile: 0-767px (design baseline at 360x800, the common Android size)
- Tablet: 768-1023px
- Desktop: 1024px and above (verify at 1366x768 and 1920x1080)

**Global layout rules**
- Use CSS Grid/Flexbox, `rem`/`clamp()` for fluid typography, and `min-height: 100dvh` instead of `100vh` so Android browser toolbars do not break layouts.
- Include the viewport meta tag; no horizontal page scrolling at any width.
- Touch targets at least 44x44px on mobile; inputs at least 16px font size to prevent zoom on focus; correct `inputmode`/`type` attributes (numeric for quantities, tel for phones, email for email).
- Respect safe areas (`env(safe-area-inset-*)`) for bottom bars.
- Support landscape orientation on phones.
- Use a CSS-variable-based theme so spacing and colors stay consistent.

**App shell**
- *Desktop:* fixed dark navy sidebar (collapsible to icons), top bar with page title, search, and user menu, light scrollable content area.
- *Tablet:* collapsed icon sidebar or slide-in drawer.
- *Mobile:* top app bar with hamburger drawer for the full menu, plus a **bottom navigation bar** with the five most-used actions (Dashboard, Products, Scan, Sales, More). The Scan button is visually emphasized.

**Per-screen behavior**

| Screen | Desktop | Mobile |
|---|---|---|
| Dashboard | 4-column stat cards, 2-column chart grid, recent activity tables | 2-column compact stat cards, charts stacked full width, horizontally scrollable stat strip for low-stock alerts, recent activity as cards |
| Products list | Full data table with sortable columns, filters in a toolbar, inline actions | Card list (name, SKU, price, stock badge), search bar pinned at top, filters in a bottom sheet, floating "+" button |
| Product form | Two-column form inside a page or side panel | Single-column form, sticky Save button at the bottom, "Scan barcode into field" button next to the barcode input |
| Categories / Suppliers | Table with modal create/edit | Card list with full-screen create/edit form |
| Purchases | Table plus a two-pane editor (line items left, summary right) | Step-style flow: supplier, add items (scan/search), review, save; sticky total bar |
| Sales / Billing (POS) | **Two-pane POS layout:** product search/scan on the left, live cart and totals on the right, large Complete Sale button | **Single-column flow with a sticky bottom cart bar** (item count + total) that expands into a full-screen cart sheet; large quantity +/- steppers; scan button always reachable |
| Invoice | Print-ready A4 layout | Readable receipt-style view with Print/Share/Download options |
| Barcode Scanner | Camera preview in a card beside the product result panel | **Full-screen camera preview** with scanning frame, result bottom sheet sliding up with product details and "Add to sale/purchase" buttons, big Stop button, manual entry link |
| Stock Movements / Reports | Filterable tables, date-range pickers, CSV export button | Card list with collapsible filters, date range in a bottom sheet, export from the overflow menu |
| User Management / Settings | Table + modal | Card list + full-screen forms |
| Login | Centered card on a branded background | Full-width form with comfortable spacing, password show/hide toggle |

**Implementation guidance**
- Use Angular CDK `BreakpointObserver` (or a small `LayoutService` exposing an `isMobile` signal) to switch between table and card templates, so mobile does not render heavy tables and desktop does not render card lists.
- Tables on tablet may scroll horizontally inside their own container only.
- Provide a bottom-sheet component and a full-screen dialog component for mobile forms and filters.
- Verify every screen at 360px, 768px, 1366px wide before marking a phase complete, and list any layout issues that remain.

---

## 13. PERFORMANCE REQUIREMENTS: THE SYSTEM MUST BE FAST (MANDATORY)

**Targets:** initial load under 3 seconds on a mid-range Android phone over 4G; route transitions feel instant; API responses typically under 300 ms for list and lookup endpoints; barcode lookup under 200 ms; Lighthouse Performance score of 85 or higher on mobile for the main screens.

**Frontend**
- Lazy-load every feature route; use standalone components and `@defer` for heavy widgets (charts, scanner library).
- Load the ZXing scanner library only when the scanner screen opens.
- Use `ChangeDetectionStrategy.OnPush` and Angular signals where practical.
- Use `trackBy` / `track` in every list; use virtual scrolling or pagination for long lists.
- Debounce search inputs (300 ms) and cancel stale requests with `switchMap`.
- Avoid duplicate API calls; cache static lookups (categories, suppliers) in services with sensible invalidation.
- Use skeleton loaders and optimistic UI only where safe (never for stock changes).
- Set production build budgets, enable AOT, tree-shaking, and compression; use `NgOptimizedImage` or lazy-loaded images with fixed dimensions to prevent layout shift.
- Keep dependencies minimal; avoid heavy UI frameworks that bloat the bundle.
- Optional: add a PWA manifest and service worker for installability and cached static assets (do not cache authenticated API data unsafely).

**Backend**
- Enable `compression` middleware.
- Create MongoDB indexes for SKU, barcode, product name/category text search, invoice number, sale/purchase dates, and stock movement product/date queries.
- Use `.lean()`, field projection, and pagination on all list queries; never return unbounded result sets.
- Use aggregation pipelines for dashboard and reports; consider short in-memory caching (30-60 s) for dashboard aggregates, invalidated on stock-changing operations.
- Reuse a single MongoDB connection pool; avoid N+1 queries (use `populate` selectively or aggregation `$lookup`).
- Return only the fields each screen needs.

**Measure it:** in Phase 8, run a production build, report bundle sizes, run Lighthouse (mobile and desktop) on Login, Dashboard, Products, Sales, and Scanner, and record the scores and fixes in `docs/performance-report.md`. Do not claim a score that was not actually measured.

---

## 14. DATABASE COLLECTIONS

Implement suitable Mongoose models for User, Category, Product, Supplier, Purchase (with embedded line items or a separate PurchaseItem), Sale (with embedded line items or a separate SaleItem), and StockMovement.

Choose an appropriate data model and document the design. Use indexes for important lookup and uniqueness requirements. Use atomic operations or transactions for stock-changing operations. Validate stock at the time the sale is committed, not only when the frontend loads the product.

---

## 15. API DESIGN

Organize the Express API under `/api`: `/api/auth`, `/api/users`, `/api/products`, `/api/categories`, `/api/suppliers`, `/api/purchases`, `/api/sales`, `/api/barcodes`, `/api/stock-movements`, `/api/reports`, `/api/dashboard`, `/api/health`.

Use correct HTTP methods and status codes. Implement input validation, authentication and authorization, consistent JSON response structures, centralized error handling, pagination and filtering, and useful API documentation (Postman collection exported to `docs/`).

---

## 16. SECURITY

- Keep MongoDB credentials and JWT secrets in backend environment variables only; never expose them in Angular environment files.
- Add `.env` and secret files to `.gitignore`; provide `.env.example` files with placeholders only.
- Restrict CORS to the configured frontend origin.
- Use Helmet; apply login rate limiting.
- Validate all incoming data on the server; prevent unauthorized role access.
- Avoid leaking stack traces or secrets in production errors.
- Do not log passwords, tokens, or connection strings.
- Document MongoDB Atlas network access and database user configuration.

---

## 17. TESTING

Create and execute tests for: authentication success and failure; unauthorized access; product CRUD; duplicate SKU and barcode; purchase receipt increasing stock; sale reducing stock; insufficient stock rejection; low-stock calculations; barcode product lookup; duplicate purchase receipt prevention; duplicate sale processing prevention; failed transaction rollback or safe recovery; reports using date filters.

Use appropriate backend testing tools (e.g. Jest/Vitest with Supertest), and test critical frontend flows where practical.

**Responsive and scanner checks (manual checklist in `docs/`):** each main screen at 360px, 768px, and 1366px; bottom navigation and drawer on mobile; POS layout on desktop versus mobile; scanner on a real Android phone over HTTPS; camera stops when navigating away; permission denied flow; manual entry fallback.

Never claim a test passed unless it was actually executed and passed.

---

## 18. DOCUMENTATION AND MCA SUBMISSION

Create: README.md, installation instructions, environment variable documentation, database setup guide, API endpoint documentation, project abstract, problem statement, objectives and scope, functional and non-functional requirements, system architecture diagram, use-case diagram, DFD, database design (ER diagram), test-case table, screenshots checklist (desktop and mobile views for each major screen), performance report, limitations and future scope, and viva questions and answers.

The project must be understandable to an MCA student who needs to explain its architecture and demonstrate the source code. Add clear comments to critical logic (stock transactions, authentication, scanner lifecycle).

---

## 19. FREE-FIRST DEVELOPMENT

Prefer free development tools and free service tiers. Do not require a paid scanner, paid database, paid AI API, paid domain, or paid hosting for local development. Do not introduce a paid third-party service unless it is optional and clearly explained.

---

## 20. QUALITY BAR AND DEFINITION OF DONE

A phase is complete only when:
1. The code builds with no errors or warnings that matter.
2. Relevant tests were executed and pass.
3. The screens for that phase were checked at mobile (360px) and desktop (1366px) widths.
4. No unused code, dead routes, or placeholder data remain.
5. Loading, empty, and error states exist for every data-driven screen.
6. A short summary states exactly what works, what was verified, and what remains.

---

## 21. FINAL EXECUTION INSTRUCTIONS

Start by inspecting the workspace. Then:

1. Explain the implementation plan, including the responsive layout strategy and performance strategy.
2. Initialize or repair the project structure.
3. Implement Phase 1, including the responsive app shell (desktop sidebar, mobile top bar and bottom navigation).
4. Configure the MongoDB Atlas connection safely.
5. Start and test the Express server.
6. Run Angular and verify the initial interface at mobile and desktop widths.
7. Fix any errors you encounter.
8. Summarize completed files, commands, test results, and remaining configuration.
9. Proceed to the next phase without replacing working code unnecessarily.

Prioritize a real, functional, secure, fast, and properly responsive application over generating a large amount of untested code.

Begin now.
