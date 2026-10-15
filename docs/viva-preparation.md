# MCA Viva Examination: Questions & Answers Preparation Guide

### Project Title
**Inventory Management System with Phone-Camera Barcode Scanner Integration**

---

### Q1: What is the high-level architecture of your project?
**Answer:** The project follows a modern three-tier decoupled client-server architecture:
1. **Frontend Presentation Tier:** Built with Angular (Standalone components, TypeScript, reactive forms, SCSS design tokens, and Signals for fine-grained reactivity).
2. **Application Logic Tier:** Built with Node.js and Express.js REST APIs with Helmet security headers, CORS origin whitelisting, Zod schema validation, and login rate limiting.
3. **Data Tier:** Powered by MongoDB Atlas (or in-memory MongoDB for local zero-config testing) with Mongoose schemas, sparse unique barcode indexes, and aggregation pipelines.

---

### Q2: Why did you choose Phone-Camera Barcode Scanning instead of requiring a USB scanner?
**Answer:** Traditional warehouse and retail setups require dedicated laser handheld scanners costing $100–$400 per terminal, tethering employees to fixed counter PCs. By using the WebRTC MediaDevices API and ZXing (Zebra Crossing) multi-format barcode library, our application transforms any standard employee smartphone into an industrial-grade scanner at zero additional hardware cost. For desktop workstations, we also support manual entry and standard keyboard-wedge USB scanners as seamless fallbacks.

---

### Q3: How do you prevent inventory overselling during concurrent sales checkouts?
**Answer:** We prevent overselling through atomic database operations at the commit stage:
1. During checkout, we execute Mongoose atomic updates with a stock condition:
   ```javascript
   Product.findOneAndUpdate(
     { _id: productId, currentStock: { $gte: requestedQty } },
     { $inc: { currentStock: -requestedQty } },
     { new: true }
   );
   ```
2. If another transaction purchases the stock between cart addition and checkout, the query returns `null`, the transaction fails safely, any partially updated items are rolled back, and the client receives a clear error message.

---

### Q4: Why is the barcode index defined as `sparse: true` in your Mongoose schema?
**Answer:** In retail and wholesale inventory, some bulk products (e.g., loose grains, custom hardware) do not have a manufacturer-printed barcode, but every registered barcode must be strictly unique. A standard unique index in MongoDB would treat multiple `null` values as duplicates, preventing more than one product without a barcode. A **sparse unique index** only indexes documents where the `barcode` field actually exists, guaranteeing uniqueness for scanned codes while safely allowing multiple products without barcodes.

---

### Q5: How do you handle camera security and permissions on mobile devices?
**Answer:** The HTML5 `navigator.mediaDevices.getUserMedia()` API is restricted by modern browsers strictly to **Secure Contexts (HTTPS and localhost)**. On plain HTTP, mobile browsers completely block camera access. We guide users through HTTPS tunneling (via Cloudflare or ngrok) or Chrome USB Port Forwarding. We also explicitly release all video tracks (`track.stop()`) on component destruction or route change to preserve device battery life and user privacy.

---

### Q6: How does the system differentiate between Mobile and Desktop screens?
**Answer:** We built a dedicated `LayoutService` that monitors CSS media queries (`max-width: 767px` for mobile and `min-width: 1024px` for desktop):
- **Desktop View:** Features a persistent dark navy collapsible sidebar, 4-column dashboard cards, 2-column Chart.js analytics, and a two-pane POS terminal (catalog on left, cart on right).
- **Mobile View:** Features a top header with slide-in drawer, stacked full-width cards, a sticky bottom cart bar, and a persistent 5-action bottom navigation bar with a visually elevated central Scan action.

---

### Q7: What is an append-only Stock Movement audit trail and why is it important?
**Answer:** In enterprise ERPs, directly overwriting stock quantities creates accountability issues. Our system records every unit change in an immutable `StockMovement` collection with previous quantity, new quantity, movement type (`purchase`, `sale`, `adjustment`), user reference, timestamp, and audit reason. This guarantees that accountants and managers can reconstruct the exact inventory history at any point in time.

---

### Q8: What security measures did you implement against unauthorized access and brute-force attacks?
**Answer:**
1. **Password Hashing:** Passwords are never stored in plain text; we use `bcryptjs` with salt work factor of 10.
2. **Rate Limiting:** `express-rate-limit` caps login attempts to 15 tries per 15-minute window per IP to prevent dictionary and brute-force attacks.
3. **Role-Based Access Control (RBAC):** Backend middleware strictly enforces permissions (`authorize('admin')`). Critical endpoints like user management, manual stock adjustments, and product deletion return HTTP 403 if accessed by staff users.
4. **JWT Expiration & Verification:** Secure stateless JSON Web Tokens expire in 7 days and verify cryptographic signature on every request.
5. **Helmet:** Injects security headers like `X-Content-Type-Options`, `X-Frame-Options`, and Content Security Policies.

---

### Q9: How are dashboard statistics calculated without crashing client memory?
**Answer:** Instead of loading thousands of product documents into the browser to compute sums with JavaScript, we leverage **MongoDB Aggregation Pipelines** (`$match`, `$group`, `$sum`, `$lookup`) executed on the database server. The client receives only pre-computed summary objects (total asset value, today's revenue, category distribution), resulting in sub-30ms response times and minimal network traffic.

---

### Q10: How does the print stylesheet work for invoices?
**Answer:** We use an `@media print` CSS block that hides all application chrome (sidebar, top bar, navigation buttons, toast container, action icons) and formats the receipt as a clean, black-and-white standard A4/receipt voucher formatted with company header, itemized breakdown, tax computation, and terms.
