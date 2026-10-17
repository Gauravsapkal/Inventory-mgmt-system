/**
 * Comprehensive Barcode Scanner & Validation Test Suite
 * Shree Ganesh Kirana Store Inventory Management System
 */

const http = require('http');

// 1. Barcode normalization and checksum algorithms (mirrors BarcodeScannerService)
function cleanBarcode(raw) {
  if (!raw) return '';
  return raw.trim();
}

function identifyFormat(code) {
  if (!code) return 'Unknown';
  const isDigitsOnly = /^\d+$/.test(code);

  if (isDigitsOnly) {
    if (code.length === 13) return 'EAN-13';
    if (code.length === 12) return 'UPC-A';
    if (code.length === 8) return 'EAN-8';
    if (code.length === 6) return 'UPC-E';
    if (code.length === 14) return 'ITF-14';
  }

  if (/^[0-9A-Z\-.$/+% ]+$/.test(code) && code.length >= 3 && code.length <= 43) {
    return 'Code-39';
  }

  if (/^[\x00-\x7F]+$/.test(code)) {
    return 'Code-128';
  }

  return 'Barcode';
}

function validateChecksum(code) {
  if (!/^\d+$/.test(code)) {
    return { valid: true, format: identifyFormat(code) };
  }

  if (code.length === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code.charAt(i), 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const isValid = checkDigit === parseInt(code.charAt(12), 10);
    return { valid: isValid, format: 'EAN-13' };
  }

  if (code.length === 12) {
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(code.charAt(i), 10);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const isValid = checkDigit === parseInt(code.charAt(11), 10);
    return { valid: isValid, format: 'UPC-A' };
  }

  if (code.length === 8) {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(code.charAt(i), 10);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const isValid = checkDigit === parseInt(code.charAt(7), 10);
    return { valid: isValid, format: 'EAN-8' };
  }

  return { valid: true, format: identifyFormat(code) };
}

// HTTP request helper
function apiRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('🔍 RUNNING BARCODE SCANNER TEST SUITE: SHREE GANESH KIRANA');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- UNIT TESTS: Barcode Formatting, Symbology & Checksums ---
  console.log('--- TEST GROUP 1: Barcode Formats & Checksum Validation ---');

  // Test 1: Indian Retail EAN-13 Checksum
  // Parle-G 800g: 8901030383700 (890 is India GS1 prefix)
  const ean13Test = validateChecksum('8901030383700');
  assert(ean13Test.valid && ean13Test.format === 'EAN-13', 'EAN-13 Parle-G checksum correctly validates as true');

  // Test 2: Invalid EAN-13 Checksum
  const invalidEan13 = validateChecksum('8901030383709');
  assert(!invalidEan13.valid, 'EAN-13 with corrupted check-digit correctly fails validation');

  // Test 3: UPC-A 12-digit standard checksum
  const upcATest = validateChecksum('012345678905');
  assert(upcATest.valid && upcATest.format === 'UPC-A', 'UPC-A standard 12-digit validates checksum');

  // Test 4: EAN-8 compact retail barcode
  const ean8Test = validateChecksum('96385074');
  assert(ean8Test.valid && ean8Test.format === 'EAN-8', 'EAN-8 compact product barcode validates checksum');

  // Test 5: Leading Zeros Preservation
  const leadingZeroCode = '0012345678905';
  const cleaned = cleanBarcode(`  ${leadingZeroCode}  \n`);
  assert(typeof cleaned === 'string' && cleaned === leadingZeroCode, 'Leading zeros are strictly preserved and never coerced to number');

  // Test 6: Code-128 & Code-39 internal labels
  assert(identifyFormat('SGK-SUGAR-5KG') === 'Code-39', 'Alphanumeric Code-39 SKU label identified');
  assert(identifyFormat('kirana-store-prod-99') === 'Code-128', 'Full ASCII Code-128 identified');

  // --- INTEGRATION TESTS: Live MongoDB Backend & Duplicate Prevention ---
  console.log('\n--- TEST GROUP 2: Live Backend Barcode Lookup & Duplicate Handling ---');

  // Step 1: Login as Admin
  console.log('Logging in as Admin on http://localhost:5000/api/auth/login...');
  const loginRes = await apiRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'admin@inventory.local', password: 'Admin@123456' }
  );

  assert(loginRes.status === 200 && loginRes.data.success, 'Admin authenticated successfully');
  const token = loginRes.data?.data?.token;

  if (!token) {
    console.error('No JWT token received; skipping authenticated tests.');
    process.exit(1);
  }

  // Step 2: Query an existing barcode from inventory
  // Seeded product: Tata Salt 1kg has barcode 8901234567890 or similar
  const lookupRes = await apiRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/barcodes/8901234567890',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  assert(lookupRes.status === 200, 'Barcode lookup endpoint responds with HTTP 200');
  console.log('  Lookup result found:', lookupRes.data?.data?.found, 'Product:', lookupRes.data?.data?.product?.name);

  // Step 3: Query an unknown barcode
  const unknownCode = '8909999999999';
  const unknownRes = await apiRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/barcodes/${unknownCode}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  assert(
    unknownRes.status === 200 && unknownRes.data?.data?.found === false,
    `Unregistered barcode '${unknownCode}' returns found: false without errors`
  );

  // Step 4: Test UPC-A / EAN-13 Equivalence in Backend
  // If barcode in DB is 012345678905 (UPC-A), querying 0012345678905 (EAN-13) generates candidates
  const candidateCheck = await apiRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/barcodes/012345678905',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(
    candidateCheck.data?.data?.candidates?.includes('0012345678905'),
    'Backend candidate generator expands 12-digit UPC-A to 13-digit EAN-13 (leading 0)'
  );

  // Step 5: Test duplicate barcode prevention on product creation
  console.log('\n--- TEST GROUP 3: Duplicate Barcode Prevention ---');
  // Fetch existing categories to create a product
  const catRes = await apiRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/categories',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const categoryId = catRes.data?.data?.[0]?._id;
  assert(!!categoryId, 'Found valid category for testing product creation');

  if (lookupRes.data?.data?.product?.barcode) {
    const existingBarcode = lookupRes.data.data.product.barcode;
    // Attempt to create a duplicate product with the same barcode
    const dupRes = await apiRequest(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/products',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      {
        name: 'Duplicate Test Item',
        sku: 'TEST-DUP-' + Date.now(),
        barcode: existingBarcode,
        category: categoryId,
        purchasePrice: 10,
        sellingPrice: 15,
        currentStock: 5,
        minStock: 2,
        uom: 'pcs',
      }
    );

    assert(
      dupRes.status === 409,
      `Backend blocks duplicate product creation with existing barcode (HTTP 409 Conflict): "${dupRes.data?.message}"`
    );
  }

  console.log('\n===============================================================');
  console.log(`🏁 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
