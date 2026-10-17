/**
 * ZXing Multi-Format Decoding Verification
 * Tests decoding of retail product barcodes: EAN-13, EAN-8, UPC-A, Code-128, Code-39
 */

const path = require('path');
module.paths.push(path.join(__dirname, '../client/node_modules'));

const { JSDOM } = require('jsdom');
const jsdom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = jsdom.window.document;
global.window = jsdom.window;
global.HTMLCanvasElement = jsdom.window.HTMLCanvasElement;
global.HTMLImageElement = jsdom.window.HTMLImageElement;
global.HTMLVideoElement = jsdom.window.HTMLVideoElement;

const JsBarcode = require('jsbarcode');
const {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} = require('@zxing/library');

async function testBarcodeDecoding() {
  console.log('===============================================================');
  console.log('🧪 ZXING 1D RETAIL BARCODE DECODING VERIFICATION');
  console.log('===============================================================\n');

  // Configure MultiFormatReader exactly as in BarcodeScannerService
  const hints = new Map();
  const formats = [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.QR_CODE,
  ];
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new MultiFormatReader();
  reader.setHints(hints);

  // Test cases: Real retail barcodes commonly found in Indian Kirana stores
  const testCases = [
    { format: 'EAN13', code: '8901030383700', desc: 'Parle-G 800g (Indian EAN-13)' },
    { format: 'EAN13', code: '8901058852738', desc: 'Maggi 2-Minute Noodles (EAN-13)' },
    { format: 'EAN13', code: '8901234567890', desc: 'Tata Salt 1kg (Catalog EAN-13)' },
    { format: 'EAN8', code: '96385074', desc: 'Compact Kirana Item (EAN-8)' },
    { format: 'UPC', code: '012345678905', desc: 'Imported Retail Item (UPC-A 12-digit)' },
    { format: 'CODE128', code: 'SGK-SUGAR-5KG', desc: 'Packaged Grocery Bag (Code-128)' },
    { format: 'CODE39', code: 'STORE123', desc: 'Alphanumeric Shelf Label (Code-39)' },
  ];

  let passed = 0;
  let total = testCases.length;

  for (const tc of testCases) {
    try {
      // 1. Generate SVG representation using JsBarcode in jsdom
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(svg, tc.code, {
        format: tc.format,
        width: 2,
        height: 60,
        displayValue: false,
        margin: 15,
        background: '#ffffff',
        lineColor: '#000000',
      });

      const width = parseInt(svg.getAttribute('width'), 10);
      const height = parseInt(svg.getAttribute('height'), 10);
      const lumArray = new Uint8ClampedArray(width * height);
      lumArray.fill(255); // Default white background

      // Render all rects taking each parent <g transform="translate(x, y)"> into account
      svg.querySelectorAll('rect').forEach((r) => {
        if (r.getAttribute('fill') === '#ffffff') return; // Skip background
        let gx = 0;
        let gy = 0;
        const parentG = r.closest('g');
        if (parentG) {
          const match = (parentG.getAttribute('transform') || '').match(/translate\((\d+),\s*(\d+)\)/);
          if (match) {
            gx = parseInt(match[1], 10);
            gy = parseInt(match[2], 10);
          }
        }
        const rx = parseFloat(r.getAttribute('x')) + gx;
        const ry = parseFloat(r.getAttribute('y')) + gy;
        const rw = parseFloat(r.getAttribute('width'));
        const rh = parseFloat(r.getAttribute('height'));

        for (let y = Math.floor(ry); y < Math.min(height, Math.ceil(ry + rh)); y++) {
          for (let x = Math.floor(rx); x < Math.min(width, Math.ceil(rx + rw)); x++) {
            lumArray[y * width + x] = 0; // Black bar
          }
        }
      });

      // 2. Create Luminance Source & BinaryBitmap
      const lumSource = new RGBLuminanceSource(lumArray, width, height);
      const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));

      // 3. Decode using configured MultiFormatReader
      const result = reader.decode(bitmap);
      const decodedText = result.getText();
      const detectedFormat = BarcodeFormat[result.getBarcodeFormat()];

      if (decodedText === tc.code) {
        console.log(`  ✅ PASS: ${tc.desc}`);
        console.log(`     Value: "${decodedText}" | Symbology: ${detectedFormat}`);
        passed++;
      } else {
        console.error(`  ❌ MISMATCH: ${tc.desc}`);
        console.error(`     Expected: ${tc.code} | Got: ${decodedText}`);
      }
    } catch (err) {
      console.error(`  ❌ FAIL: ${tc.desc} -> ${err.message}`);
    }
  }

  console.log('\n===============================================================');
  console.log(`🏁 ZXING DECODING RESULTS: ${passed}/${total} Barcodes Verified`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

testBarcodeDecoding().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
