# Test Cases & Verification Table: Inventory Management System

The following test cases have been implemented and executed across both automated backend test suites (`vitest`) and responsive browser validation passes.

---

## 1. Automated Backend Test Matrix (`server/src/tests/api.test.ts`)

| Test ID | Test Scenario | Input / Action | Expected Result | Status |
|---|---|---|---|---|
| **TC-01** | Health Check API | `GET /api/health` | Returns HTTP 200, status `healthy`, MongoDB readyState `1` | **PASS** |
| **TC-02** | Valid Authentication | `POST /api/auth/login` with correct credentials | Returns HTTP 200, valid JWT token, user object without password | **PASS** |
| **TC-03** | Invalid Authentication | `POST /api/auth/login` with incorrect password | Returns HTTP 401 Unauthorized, descriptive error message | **PASS** |
| **TC-04** | JWT Profile Lookup | `GET /api/auth/me` with Bearer token | Returns HTTP 200 with admin role and account details | **PASS** |
| **TC-05** | Category Listing | `GET /api/categories` | Returns HTTP 200 with seeded product categories | **PASS** |
| **TC-06** | Product Creation | `POST /api/products` with valid SKU | Returns HTTP 201 Created with saved product record | **PASS** |
| **TC-07** | Duplicate SKU Rejection | `POST /api/products` with existing SKU | Returns HTTP 409 Conflict with error "SKU already in use" | **PASS** |
| **TC-08** | Barcode Lookup | `GET /api/barcodes/8901234567890` | Returns HTTP 200, `found: true`, product SKU `BEV-WAT-001` | **PASS** |
| **TC-09** | Atomic Stock Deduction | `POST /api/sales` with 5 units | Returns HTTP 201, reduces stock by exactly 5 in DB | **PASS** |
| **TC-10** | Oversell Prevention | `POST /api/sales` with quantity > available | Returns HTTP 400 with "Insufficient stock" error | **PASS** |
| **TC-11** | Dashboard Aggregates | `GET /api/dashboard/stats` | Returns HTTP 200 with non-empty product count & trends | **PASS** |

---

## 2. Frontend Responsive & Functional Test Matrix

| Screen | Viewport | Verification Item | Observed Behavior | Status |
|---|---|---|---|---|
| **Login** | Mobile (360px) | Full-width responsive card & password toggle | Elements fit viewport cleanly without horizontal overflow | **PASS** |
| **Login** | Desktop (1366px) | Centered card on slate gradient | Responsive centered card with quick demo login button | **PASS** |
| **App Shell** | Desktop (1366px) | Collapsible dark navy sidebar | Smooth collapse to icon view, main content expands | **PASS** |
| **App Shell** | Mobile (360px) | Bottom nav + drawer | 5-item bottom bar with prominent elevated Scan button; hamburger drawer for full navigation | **PASS** |
| **Dashboard** | Desktop (1366px) | 4-column stat cards & 2-column charts | Charts and cards arrange in 4/2 grid with high visibility | **PASS** |
| **Dashboard** | Mobile (360px) | 1-2 column stacked cards & charts | Touch-scrollable layout, charts auto-resize to device width | **PASS** |
| **Scanner** | Mobile (360px) | Camera reticle & ZXing detection | Live video feed with red scanner sweep and targeting brackets | **PASS** |
| **Scanner** | Desktop (1366px) | Two-pane camera + result panel | Clean side-by-side video viewfinder and product result sheet | **PASS** |
| **Sales (POS)**| Desktop (1366px) | Two-pane catalog & live cart | Instant product add, automatic GST/discount computation | **PASS** |
| **Sales (POS)**| Mobile (360px) | Single column + sticky bottom cart bar | Sticky bottom cart badge opens full checkout sheet on tap | **PASS** |
| **Invoice** | Print (@media print) | Print dialog preview | Strips navigation, headers, and buttons; prints clean A4 receipt | **PASS** |
