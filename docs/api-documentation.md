# REST API Specification: Inventory Management System

Base URL: `http://localhost:5000/api`

All authenticated endpoints require an `Authorization: Bearer <token>` HTTP header.

---

## 1. Authentication Endpoints

### `POST /auth/login`
Authenticates a user and issues a JWT token.
- **Rate Limit:** 15 requests per 15 minutes per IP.
- **Request Body:**
  ```json
  {
    "email": "admin@inventory.local",
    "password": "Admin@123456"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "user": {
        "id": "67af123...",
        "name": "System Administrator",
        "email": "admin@inventory.local",
        "role": "admin",
        "status": "active"
      }
    }
  }
  ```

### `GET /auth/me`
Retrieves current authenticated user's profile.
- **Response (200 OK):** User object without password hash.

### `POST /auth/logout`
Discards server session.

---

## 2. Product Catalog Endpoints

### `GET /products`
Retrieves a paginated list of catalog products.
- **Query Parameters:**
  - `page` (number, default: 1)
  - `limit` (number, default: 20)
  - `search` (string: searches name, SKU, or barcode)
  - `category` (ObjectId string)
  - `stockFilter` (`low` | `out` | `all`)
  - `status` (`active` | `archived` | `all`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "67af...",
        "name": "Mineral Water 1L Bottle",
        "sku": "BEV-WAT-001",
        "barcode": "8901234567890",
        "purchasePrice": 12.00,
        "sellingPrice": 20.00,
        "currentStock": 50,
        "minStock": 10,
        "uom": "bottle",
        "status": "active"
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  }
  ```

### `POST /products` (Admin Only)
Creates a new product with duplicate SKU/barcode checks.
- **Request Body:**
  ```json
  {
    "name": "Organic Green Tea 100g",
    "sku": "BEV-TEA-005",
    "barcode": "8901112223334",
    "category": "67af123...",
    "purchasePrice": 85.00,
    "sellingPrice": 140.00,
    "currentStock": 30,
    "minStock": 5,
    "uom": "box"
  }
  ```

### `PUT /products/:id` (Admin Only)
Updates product metadata and logs stock changes if quantity modified.

### `DELETE /products/:id` (Admin Only)
Safely archives the product if linked to sales/purchases, or deletes if unused.

---

## 3. Barcode Scanning Endpoints

### `GET /barcodes/:code`
Fast barcode & SKU lookup.
- **Response (200 OK - Found):**
  ```json
  {
    "success": true,
    "data": {
      "found": true,
      "code": "8901234567890",
      "product": { ... }
    }
  }
  ```
- **Response (200 OK - Not Found):**
  ```json
  {
    "success": true,
    "data": {
      "found": false,
      "code": "9999999999999",
      "product": null
    }
  }
  ```

---

## 4. Sales & POS Billing Endpoints

### `POST /sales`
Commits an atomic customer sale with stock deduction.
- **Request Body:**
  ```json
  {
    "customerName": "Rohan Gupta",
    "customerPhone": "9876543210",
    "items": [
      {
        "product": "67af123...",
        "quantity": 2,
        "unitPrice": 20.00
      }
    ],
    "discount": 5.00,
    "tax": 2.50,
    "paymentMethod": "upi"
  }
  ```
- **Response (201 Created):** Full sale document with generated invoice number (e.g. `INV-20261015-8421`).

### `GET /sales`
Retrieves paginated past sales orders.

---

## 5. Procurement / Purchases Endpoints

### `POST /purchases`
Creates a purchase order (`draft` or `received`).
- **Request Body:** Line items, unit costs, supplier reference.

### `POST /purchases/:id/receive`
Receives goods from supplier, atomically increasing product stock and logging movements. Prevents duplicate receipt.

---

## 6. Dashboard & Analytics Endpoints

### `GET /dashboard/stats`
Executes parallel MongoDB aggregation pipelines returning active product counts, inventory valuation, daily sales trend, low-stock count, and category distributions.
