/**
 * Comprehensive Production Verification Suite
 * Shree Ganesh Kirana Store Inventory Management System
 * Tests live deployed Render API + Atlas Cloud Database from Vercel Frontend Origin
 */
const https = require('https');

const RENDER_BASE = 'https://shree-ganesh-kirana-api.onrender.com/api';
const VERCEL_ORIGIN = 'https://client-six-mu-91.vercel.app';

function request(urlPath, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(RENDER_BASE + urlPath);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Origin': VERCEL_ORIGIN,
        'Accept': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      const json = JSON.stringify(data);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(json);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            rawBody: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runProductionAudit() {
  console.log('===============================================================');
  console.log('🌟 LIVE PRODUCTION AUDIT: SHREE GANESH KIRANA STORE');
  console.log(`Backend URL:  https://shree-ganesh-kirana-api.onrender.com`);
  console.log(`Frontend URL: ${VERCEL_ORIGIN}`);
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message, detail = '') {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${message} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message} ${detail ? `(${detail})` : ''}`);
    }
  }

  // 1. Health Check
  const health = await request('/health');
  assert(
    health.statusCode === 200 && health.body?.data?.database?.status === 'connected',
    'Health Check & MongoDB Atlas Cloud Connection',
    `Database state: ${health.body?.data?.database?.status}`
  );
  assert(
    health.headers['access-control-allow-origin'] === VERCEL_ORIGIN,
    'CORS policy allows Vercel frontend origin',
    `Allow-Origin: ${health.headers['access-control-allow-origin']}`
  );

  // 2. Authentication
  const login = await request('/auth/login', 'POST', {
    email: 'admin@inventory.local',
    password: 'Admin@123456',
  });
  assert(
    login.statusCode === 200 && login.body?.success === true,
    'Administrator Authentication',
    `User: ${login.body?.data?.user?.name}`
  );

  const token = login.body?.data?.token;

  // 3. User Profile
  const me = await request('/auth/me', 'GET', null, token);
  assert(
    me.statusCode === 200 && me.body?.data?.role === 'admin',
    'Protected Route: Verify Admin Profile',
    `Role: ${me.body?.data?.role}`
  );

  // 4. Products Catalog
  const products = await request('/products?page=1&limit=20', 'GET', null, token);
  assert(
    products.statusCode === 200 && products.body?.data?.length > 0,
    'Fetch Products Catalog from Atlas',
    `Found ${products.body?.meta?.total} products`
  );

  // 5. Barcode Resolution
  const barcode = await request('/barcodes/8901234567890', 'GET', null, token);
  assert(
    barcode.statusCode === 200 && barcode.body?.data?.found === true,
    'EAN-13 Barcode Lookup (Mineral Water)',
    `Product: "${barcode.body?.data?.product?.name}" | Price: ₹${barcode.body?.data?.product?.sellingPrice}`
  );

  // 6. Categories
  const categories = await request('/categories', 'GET', null, token);
  assert(
    categories.statusCode === 200 && categories.body?.data?.length === 5,
    'Categories Catalog Retrieval',
    `${categories.body?.data?.length} categories active`
  );

  // 7. Dashboard Analytics
  const dashboard = await request('/dashboard/stats', 'GET', null, token);
  assert(
    dashboard.statusCode === 200 && dashboard.body?.data?.totalProducts >= 8,
    'Dashboard Real-time Statistics',
    `Stock Value: ₹${dashboard.body?.data?.totalStockValue} | Items: ${dashboard.body?.data?.totalProducts}`
  );

  // 8. Sales Invoices
  const sales = await request('/sales?page=1&limit=10', 'GET', null, token);
  assert(
    sales.statusCode === 200 && sales.body?.data?.length === 9,
    'Sales Invoice History Retrieval',
    `${sales.body?.meta?.total} historical invoices verified`
  );

  // 9. Stock Movements
  const movements = await request('/stock-movements?page=1&limit=20', 'GET', null, token);
  assert(
    movements.statusCode === 200 && movements.body?.data?.length === 14,
    'Stock Audit Trail History Retrieval',
    `${movements.body?.meta?.total} stock movements recorded`
  );

  console.log('\n===============================================================');
  console.log(`🏁 PRODUCTION AUDIT RESULTS: ${passed}/${total} Checks Passed`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runProductionAudit().catch(err => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
