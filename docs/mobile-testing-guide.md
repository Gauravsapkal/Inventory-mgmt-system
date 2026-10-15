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

## 3. Sample Barcodes for Viva Demonstration

You can scan these barcodes from another screen, print them, or type them into the manual entry box:

| Product Name | Barcode | Format |
|---|---|---|
| Mineral Water 1L Bottle | `8901234567890` | EAN-13 |
| USB-C Fast Charging Cable 1m | `8909876543211` | EAN-13 |
| Executive Gel Pen Pack of 5 | `8904567890123` | EAN-13 |
| Organic Roasted Almonds 200g | `8906789012345` | EAN-13 |
