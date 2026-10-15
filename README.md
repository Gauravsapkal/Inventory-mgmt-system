# Inventory Management System with Phone-Camera Barcode Scanner Integration

[![Node.js](https://img.shields.io/badge/Node.js-v22+-green.svg)](https://nodejs.org/)
[![Angular](https://img.shields.io/badge/Angular-v21+-red.svg)](https://angular.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%2F%20Embedded-brightgreen.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/Academic-MCA%20Mini%20Project-blue.svg)]()

A complete, production-grade **Inventory Management & Point of Sale (POS) System** featuring real-time **phone-camera barcode scanning** (EAN-13, EAN-8, UPC-A, Code-128), atomic stock validation, append-only audit trail logging, print-ready tax invoices, and purpose-designed responsive interfaces for mobile (360x800px) and desktop (1366px+).

---

## 🌟 Key Features

1. **Phone-Camera Barcode Scanner:**
   - Zero additional hardware required; uses smartphone rear camera via WebRTC and ZXing engine.
   - Targeting reticle overlay, torch toggle, switch camera, and sound/vibration feedback.
   - Manual entry and USB keyboard-wedge barcode scanner fallbacks.
2. **Atomic Stock & POS Billing:**
   - Real-time stock validation at commit prevents overselling.
   - Live cart with automatic discount and tax calculations.
   - Print-ready A4 customer invoice generated with dedicated `@media print` CSS.
3. **Responsive Mobile-First Ergonomics:**
   - **Desktop View:** Fixed collapsible dark navy sidebar, two-pane POS layout, 4-column dashboard, and full data tables.
   - **Mobile View:** Header with slide-in navigation drawer, single-column flow with sticky bottom cart bar, and 5-action bottom navigation bar with elevated Scan action.
4. **Append-Only Stock History:**
   - Every purchase, sale, and authorized adjustment is logged immutably with previous/new stock levels, timestamps, user ID, and audit reasons.
5. **Role-Based Access Control (RBAC):**
   - **Administrator:** Full catalog CRUD, purchase orders, manual stock adjustments, user account management, and financial analytics.
   - **Staff:** Product lookup, phone-camera scanning, and POS customer checkouts.
6. **Executive Dashboard & Analytics:**
   - Real-time aggregation pipelines computing active items, units in stock, asset valuation, daily sales trend, top-selling items, and category distribution.
   - CSV export for inventory valuation, sales reports, and procurement records.

---

## 📂 Project Structure

```
ERP SYSTEM/
├── client/                     # Angular Standalone Client
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/           # Services (Auth, Layout, Toast, API), Guards, Interceptors
│   │   │   ├── features/       # Feature modules: Auth, Dashboard, Products, Sales, Scanner, etc.
│   │   │   ├── layout/         # Responsive app shell (Sidebar, Topbar, Mobile Bottom Nav, Drawer)
│   │   │   ├── app.config.ts   # Application config with HTTP client & interceptors
│   │   │   └── app.routes.ts   # Lazy-loaded route declarations
│   │   ├── styles.scss         # SCSS design tokens, responsive typography, and print styles
│   │   └── index.html          # Viewport-fit cover, Google Fonts Inter
│   └── package.json
│
├── server/                     # Express.js REST API Backend
│   ├── src/
│   │   ├── config/             # Zod environment parsing and MongoDB connection manager
│   │   ├── controllers/        # Business logic controllers (Auth, Products, Sales, Barcodes, etc.)
│   │   ├── middlewares/        # JWT auth, RBAC authorization, error handling, Zod validation
│   │   ├── models/             # Mongoose schemas (User, Product, Category, Supplier, Sale, Purchase)
│   │   ├── routes/             # Express API routes
│   │   ├── scripts/            # Automatic seed utility for default admin & test inventory
│   │   ├── tests/              # Vitest integration test suite
│   │   ├── app.ts              # Express app setup with Helmet, CORS, and Compression
│   │   └── server.ts           # Server bootstrap and graceful shutdown
│   ├── .env.example            # Environment variables template
│   └── package.json
│
├── docs/                       # Project Documentation & Viva Resources
│   ├── project-report.md       # Full MCA report, problem statement, DFD, and ER diagrams
│   ├── api-documentation.md    # REST API endpoint reference
│   ├── test-cases.md           # Backend and frontend verification matrix
│   ├── performance-report.md   # Bundle sizes and Lighthouse optimization audit
│   ├── mobile-testing-guide.md # Instructions for camera testing on physical Android phone
│   ├── viva-preparation.md     # 25+ MCA viva examination questions and answers
│   └── postman-collection.json # Exported Postman collection
│
├── .gitignore
└── README.md
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js** v18+ or v22+ (tested on Node v22.19.0)
- **NPM** v10+

### 2. Backend Setup
1. Open a terminal in the `server` directory:
   ```bash
   cd server
   ```
2. Verify or edit `.env` (a ready-to-run `.env` is already created):
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://127.0.0.1:27017/inventory_erp
   JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long_for_security_compliance
   CORS_ORIGIN=http://localhost:4200
   ```
   > **Note:** If you don't have a local MongoDB daemon running, the server automatically starts an embedded in-memory MongoDB instance with pre-seeded demo data so you can test immediately with zero configuration!

3. Run the backend dev server:
   ```bash
   npm run dev
   ```
   The backend will start at: `http://localhost:5000` (Health check: `http://localhost:5000/api/health`).

### 3. Frontend Setup
1. In a second terminal, navigate to the `client` directory:
   ```bash
   cd client
   ```
2. Start the Angular development server:
   ```bash
   npm start
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:4200
   ```

---

## 🔑 Default Credentials

The database auto-seeds the following administrator account on first startup:

- **Email:** `admin@inventory.local`
- **Password:** `Admin@123456`
- **Role:** `admin`

*(A "Quick Demo Login" button is also provided directly on the login screen to sign in with one click).*

---

## 📱 Barcode Scanning Demonstration

The demo inventory includes pre-seeded products with standard EAN-13 barcodes ready to scan:

| Product Name | SKU | Barcode | Stock | Price |
|---|---|---|---|---|
| Mineral Water 1L Bottle | `BEV-WAT-001` | `8901234567890` | 50 bottle | ₹20.00 |
| USB-C Fast Charging Cable 1m | `ELE-CAB-002` | `8909876543211` | 25 pcs | ₹299.00 |
| Executive Gel Pen Pack of 5 | `STA-PEN-003` | `8904567890123` | 40 box | ₹100.00 |
| Organic Roasted Almonds 200g | `SNK-ALM-004` | `8906789012345` | 4 pcs (Low!)| ₹260.00 |

You can scan these barcodes from another screen, display them on your phone, or type them in the manual entry bar.

To test camera scanning on a physical Android phone over your Wi-Fi network, refer to [`docs/mobile-testing-guide.md`](docs/mobile-testing-guide.md).

---

## 🧪 Running Tests & Quality Verification

### Run Backend Integration Tests
```bash
cd server
npm test
```
All 9 test suites verify authentication, duplicate SKU rejection, atomic stock reduction, oversell rejection, barcode lookups, and MongoDB aggregation pipelines.

### Run Client Production Build
```bash
cd client
npm run build
```
Generates production-optimized standalone chunks with zero compiler warnings and an initial compressed bundle size under **85 kB**!

---

## 📚 Examination & Viva Resources

For viva presentation preparation, refer to the documents in `docs/`:
- [Full Project Report & System Architecture](docs/project-report.md)
- [REST API Endpoint Documentation](docs/api-documentation.md)
- [Automated & Responsive Test Cases](docs/test-cases.md)
- [Performance & Bundle Analysis](docs/performance-report.md)
- [Mobile Phone Camera HTTPS Guide](docs/mobile-testing-guide.md)
- [25+ Viva Examination Questions & Answers](docs/viva-preparation.md)
- [Postman API Collection](docs/postman-collection.json)
