# Mobile Testing Guide: Phone-Camera Barcode Scanning

## 1. Why HTTPS is Required for Mobile Camera Access
Modern web browsers (including Google Chrome for Android and Chromium WebViews) enforce a strict security policy for `getUserMedia()` and WebRTC camera access:
- **Allowed:** `http://localhost` or `http://127.0.0.1` (treated as secure origin for local development).
- **Allowed:** Any `https://` origin with a valid SSL/TLS certificate.
- **Blocked:** Plain `http://<LAN-IP>:4200` accessed from a physical phone on your local Wi-Fi.

To test camera scanning seamlessly on your Android phone during evaluation, use one of the two free methods below:

---

## Method 1: Using Cloudflare Tunnel or Localtunnel (Recommended & Free)
This is the easiest method requiring zero certificate installation.

1. In your terminal, start the Angular client with host listening enabled:
   ```bash
   cd client
   npx ng serve --host 0.0.0.0 --port 4200
   ```
2. In a second terminal, start the backend server:
   ```bash
   cd server
   npm run dev
   ```
3. Expose the frontend securely over free HTTPS using `localtunnel` or `ngrok`:
   ```bash
   npx localtunnel --port 4200
   ```
   *Or with Cloudflare Tunnel:*
   ```bash
   npx -y cloudflared tunnel --url http://localhost:4200
   ```
4. Copy the resulting `https://...` URL into Google Chrome on your Android smartphone.
5. Tap **"Start Camera"** when prompted, tap **"Allow"** for camera permissions.
6. The phone's rear camera will activate with the scanning reticle.

---

## Method 2: Chrome Remote Debugging & Port Forwarding via USB
If you connect your Android phone to your PC via USB cable:

1. Enable **Developer Options** and **USB Debugging** on your Android phone.
2. Connect your phone to your PC via USB.
3. In Chrome on your PC, navigate to: `chrome://inspect/#devices`.
4. Click **Port forwarding...** and add:
   - Port: `4200` &rarr; `localhost:4200`
   - Port: `5000` &rarr; `localhost:5000`
5. On your phone's Chrome browser, navigate directly to:
   `http://localhost:4200`
6. Because Chrome routes `localhost` over USB to the PC, Chrome recognizes it as a **secure origin** and enables full camera access with zero warnings!

---

---

## 4. Testing Omni-Channel Mobile Workflows

### A. Point of Sale (POS) Continuous Mobile Scanning
1. On your phone, tap **Sales** from the bottom navigation bar.
2. In the POS screen, tap the **📷 Camera Scanner** button above the cart.
3. The continuous scanning camera modal opens. Aim at products sequentially:
   - Each scan triggers an audible beep and 100ms haptic vibration.
   - The item is immediately appended to the active cart with available stock checks.
4. Tap **Checkout** &rarr; select payment method (Cash / UPI / Card) &rarr; tap **Complete Checkout**.
5. On the completion screen:
   - Tap **📥 Download PDF** to save `Invoice_<number>.pdf` directly into the phone's Downloads folder.
   - Tap **📱 Share** to share the receipt via WhatsApp or native Android share sheet.
   - Tap **🖨️ Print Invoice** to trigger standard Android print preview (Cloud Print / thermal receipt printer).

### B. Barcode Sticker Printing & Product Registration
1. In **Products**, tap the **🏷️ Barcode** button on any product card.
2. An 80x50mm barcode sticker label PDF is generated with the item's title, SKU, barcode, and MRP.
3. When adding a new product, tap the **📷 Scan** button next to the barcode input field to capture the barcode on physical packaging directly into the form.

### C. Inward Stock Receiving (Purchases)
1. In **Purchases**, tap **+ New Purchase Order**.
2. Tap **📷 Scan Barcode** next to "Add Product".
3. Point phone camera at incoming inventory cartons to auto-select products and populate unit costs.
4. Tap **📥 PDF** on any purchase order in the list to generate and download a formal Goods Receipt Note (GRN).

---

## 5. Sample Demo Barcodes for Viva & Testing

You can display these barcodes on another monitor or print them for physical scanning:

| Product Name | Barcode | Format | Category |
|---|---|---|---|
| Mineral Water 1L Bottle | `8901234567890` | EAN-13 | Beverages |
| USB-C Fast Charging Cable 1m | `8909876543211` | EAN-13 | Electronics |
| Executive Gel Pen Pack of 5 | `8904567890123` | EAN-13 | Stationery |
| Organic Roasted Almonds 200g | `8906789012345` | EAN-13 | Groceries |
