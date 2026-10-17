const path = require('path');
module.paths.push(path.join(__dirname, '../client/node_modules'));

const fs = require('fs');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default;
const JsBarcode = require('jsbarcode');
// Removed unused canvas require

// Path constants
const ROOT = path.resolve(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const ARTIFACTS_DIR = 'C:/Users/User/.gemini/antigravity-ide/brain/f94adb6f-5bba-48a8-a4b4-30b2ad5d2978';
const OUT_DIR = path.join(ARTIFACTS_DIR, 'sample_pdfs');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Load fonts
const regFontBase64 = fs.readFileSync(path.join(CLIENT_DIR, 'public/assets/fonts/custom-font.ttf')).toString('base64');
const boldFontBase64 = fs.readFileSync(path.join(CLIENT_DIR, 'public/assets/fonts/custom-font-bold.ttf')).toString('base64');
const logoBase64 = 'data:image/png;base64,' + fs.readFileSync(path.join(CLIENT_DIR, 'public/assets/store-logo.png')).toString('base64');

function formatCurrency(value, symbol = '₹') {
  if (value === null || value === undefined || isNaN(value)) return symbol + '0.00';
  const isNegative = value < 0;
  const paise = Math.round(Math.abs(value) * 100);
  const rupees = Math.floor(paise / 100);
  const cents = (paise % 100).toString().padStart(2, '0');
  const intStr = rupees.toString();
  let formattedInt = '';
  if (intStr.length <= 3) {
    formattedInt = intStr;
  } else {
    const last3 = intStr.slice(-3);
    const rem = intStr.slice(0, -3);
    const parts = [];
    let i = rem.length;
    while (i > 0) {
      const start = Math.max(0, i - 2);
      parts.unshift(rem.slice(start, i));
      i = start;
    }
    formattedInt = parts.join(',') + ',' + last3;
  }
  const sign = isNegative ? '-' : '';
  return `${sign}${symbol}${formattedInt}.${cents}`;
}

function initDoc(orientation = 'portrait') {
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });
  doc.addFileToVFS('StoreFont-Regular.ttf', regFontBase64);
  doc.addFont('StoreFont-Regular.ttf', 'StoreFont', 'normal');
  doc.addFileToVFS('StoreFont-Bold.ttf', boldFontBase64);
  doc.addFont('StoreFont-Bold.ttf', 'StoreFont', 'bold');
  return doc;
}

function drawHeader(doc, title, primaryColor, darkColor, grayColor) {
  doc.addImage(logoBase64, 'PNG', 14, 10, 18, 18);
  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...darkColor);
  doc.text('SHREE GANESH KIRANA STORE', 36, 18);

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...grayColor);
  doc.text('Inventory Management System  •  Daily Groceries & Provisions', 36, 23.5);

  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text(title, 196, 18, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 31, 196, 31);
}

function drawFooter(doc, grayColor) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('StoreFont', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...grayColor);
    doc.text('Shree Ganesh Kirana Store — Inventory Management System', 14, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, 196, pageHeight - 8, { align: 'right' });
  }
}

// 1. GENERATE GOODS RECEIPT NOTE (GRN)
function generateSampleGRN() {
  const doc = initDoc('portrait');
  const primaryColor = [26, 107, 52];
  const darkColor = [15, 23, 42];
  const grayColor = [100, 116, 139];

  drawHeader(doc, 'GOODS RECEIPT NOTE', primaryColor, darkColor, grayColor);

  // Document details
  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);
  doc.text('GRN Number: GRN-2026-0042', 196, 37, { align: 'right' });

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...grayColor);
  doc.text('PO Reference: PO-2026-0042', 196, 42, { align: 'right' });
  doc.text('Receipt Date: 16/10/2026', 196, 47, { align: 'right' });

  doc.setFont('StoreFont', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('Status: RECEIVED', 196, 52, { align: 'right' });

  // Supplier details
  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);
  doc.text('Supplier Details:', 14, 38);

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...grayColor);
  doc.text('Supplier: Annapurna Agro Traders Ltd.', 14, 43.5);
  doc.text('Contact Person: Rameshwar Patil', 14, 48);
  doc.text('Phone: +91 98220 12345 | Email: sales@annapurnaagro.in', 14, 52.5);
  doc.text('Address: Plot 14, APMC Grain Market, Sector 19, Vashi, Navi Mumbai', 14, 57);

  const items = [
    ['1', 'Fortune Sunlite Refined Sunflower Oil 1L Pouch', 'OIL-SUN-001', formatCurrency(135.00), '50', '50', formatCurrency(6750.00)],
    ['2', 'India Gate Basmati Rice Premium Feast 5kg Bag', 'RIC-BAS-005', formatCurrency(580.00), '20', '20', formatCurrency(11600.00)],
    ['3', 'Tata Salt Vacuum Evaporated Iodised Salt 1kg', 'SLT-TAT-001', formatCurrency(24.00), '100', '100', formatCurrency(2400.00)],
    ['4', 'Aashirvaad Shudh Chakki Whole Wheat Atta 10kg', 'FLR-ATT-010', formatCurrency(420.00), '30', '30', formatCurrency(12600.00)],
    ['5', 'Madhur Pure & Hygienic Granulated Sugar 5kg', 'SGR-MDH-005', formatCurrency(225.00), '25', '25', formatCurrency(5625.00)],
    ['6', 'Tata Tea Gold Rich Taste Leaf Tea 500g Pack', 'BEV-TEA-500', formatCurrency(260.00), '40', '40', formatCurrency(10400.00)],
  ];

  autoTable(doc, {
    startY: 63,
    head: [['Sr.', 'Item Description', 'SKU / Barcode', 'Unit Cost', 'Ordered Qty', 'Received Qty', 'Total Cost']],
    body: items,
    theme: 'grid',
    styles: {
      font: 'StoreFont',
      fontSize: 8.5,
      textColor: darkColor,
      cellPadding: 2.5,
    },
    headStyles: {
      font: 'StoreFont',
      fontStyle: 'bold',
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 58 },
      2: { cellWidth: 28 },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY || 130;
  const summaryX = 135;

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkColor);
  doc.text('Subtotal:', summaryX, finalY + 8);
  doc.text(formatCurrency(49375.00), 196, finalY + 8, { align: 'right' });

  doc.text('Tax / Freight:', summaryX, finalY + 13.5);
  doc.text(formatCurrency(450.00), 196, finalY + 13.5, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(summaryX, finalY + 18, 196, finalY + 18);

  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('Grand Total:', summaryX, finalY + 23.5);
  doc.text(formatCurrency(49825.00), 196, finalY + 23.5, { align: 'right' });

  const pageHeight = doc.internal.pageSize.getHeight();
  const sigY = pageHeight - 34;

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...grayColor);
  doc.text('_________________________________', 20, sigY);
  doc.text('Authorized / Received By (Store Manager)', 20, sigY + 5.5);

  doc.text('_________________________________', 130, sigY);
  doc.text('Supplier / Deliverer Acknowledgment', 130, sigY + 5.5);

  drawFooter(doc, grayColor);

  const filePath = path.join(OUT_DIR, 'Sample_Goods_Receipt_Note_GRN.pdf');
  fs.writeFileSync(filePath, Buffer.from(doc.output('arraybuffer')));
  console.log('Generated GRN:', filePath);
  return filePath;
}

// 2. GENERATE TAX INVOICE
function generateSampleInvoice() {
  const doc = initDoc('portrait');
  const primaryColor = [26, 107, 52];
  const darkColor = [15, 23, 42];
  const grayColor = [100, 116, 139];

  drawHeader(doc, 'TAX INVOICE', primaryColor, darkColor, grayColor);

  // Invoice Details
  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);
  doc.text('Invoice No: INV-2026-0189', 196, 37, { align: 'right' });

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...grayColor);
  doc.text('Date: 16/10/2026, 07:45 PM', 196, 42.5, { align: 'right' });
  doc.text('Payment: UPI (GPay)', 196, 47.5, { align: 'right' });

  // Customer Details
  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);
  doc.text('Billed To:', 14, 40);

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  doc.text('Customer: Smt. Sunita Sharma', 14, 45.5);
  doc.text('Phone: +91 98765 43210', 14, 50.5);

  const items = [
    ['1', 'Fortune Sunlite Sunflower Oil 1L Pouch', 'OIL-SUN-001', formatCurrency(145.00), '2', formatCurrency(290.00)],
    ['2', 'Aashirvaad Whole Wheat Atta 10kg Bag', 'FLR-ATT-010', formatCurrency(460.00), '1', formatCurrency(460.00)],
    ['3', 'Tata Salt Vacuum Evaporated 1kg', 'SLT-TAT-001', formatCurrency(28.00), '2', formatCurrency(56.00)],
    ['4', 'Madhur Pure Refined Sugar 5kg', 'SGR-MDH-005', formatCurrency(250.00), '1', formatCurrency(250.00)],
    ['5', 'Tata Tea Gold Leaf Tea 500g', 'BEV-TEA-500', formatCurrency(310.00), '1', formatCurrency(310.00)],
  ];

  autoTable(doc, {
    startY: 62,
    head: [['#', 'Item Description', 'SKU', 'Unit Rate', 'Qty', 'Amount']],
    body: items,
    theme: 'grid',
    styles: {
      font: 'StoreFont',
      fontSize: 8.5,
      textColor: darkColor,
      cellPadding: 2.5,
    },
    headStyles: {
      font: 'StoreFont',
      fontStyle: 'bold',
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 32 },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY || 120;
  const summaryX = 135;

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkColor);
  doc.text('Subtotal:', summaryX, finalY + 8);
  doc.text(formatCurrency(1366.00), 196, finalY + 8, { align: 'right' });

  doc.setTextColor(220, 38, 38);
  doc.text('Discount:', summaryX, finalY + 13.5);
  doc.text(`-${formatCurrency(66.00)}`, 196, finalY + 13.5, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(summaryX, finalY + 18, 196, finalY + 18);

  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('Grand Total:', summaryX, finalY + 23.5);
  doc.text(formatCurrency(1300.00), 196, finalY + 23.5, { align: 'right' });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...grayColor);
  doc.text(
    'Thank you for shopping at Shree Ganesh Kirana Store! Goods once sold can be exchanged within 7 days with this invoice.',
    14,
    pageHeight - 16
  );

  drawFooter(doc, grayColor);

  const filePath = path.join(OUT_DIR, 'Sample_Tax_Invoice.pdf');
  fs.writeFileSync(filePath, Buffer.from(doc.output('arraybuffer')));
  console.log('Generated Invoice:', filePath);
  return filePath;
}

// 3. GENERATE MULTI-PAGE STRESS TEST
function generateMultiPageGRN() {
  const doc = initDoc('portrait');
  const primaryColor = [26, 107, 52];
  const darkColor = [15, 23, 42];
  const grayColor = [100, 116, 139];

  drawHeader(doc, 'GOODS RECEIPT NOTE', primaryColor, darkColor, grayColor);

  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);
  doc.text('GRN Number: GRN-2026-BULK-99', 196, 37, { align: 'right' });

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...grayColor);
  doc.text('PO Reference: PO-2026-BULK-99', 196, 42, { align: 'right' });
  doc.text('Receipt Date: 16/10/2026', 196, 47, { align: 'right' });
  doc.setFont('StoreFont', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('Status: RECEIVED', 196, 52, { align: 'right' });

  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkColor);
  doc.text('Supplier: Maharashtra Wholesale Grain & Provision Corporation Ltd.', 14, 38);

  const items = [];
  let totalSum = 0;
  for (let i = 1; i <= 35; i++) {
    const rate = 50 + (i * 12.5);
    const qty = 10 + (i % 5);
    const lineTotal = rate * qty;
    totalSum += lineTotal;
    items.push([
      i.toString(),
      `Wholesale Kirana SKU ${i} - Extra Long Description Premium Quality Packaging ${i}kg`,
      `SKU-KIR-${String(i).padStart(4, '0')}`,
      formatCurrency(rate),
      qty.toString(),
      qty.toString(),
      formatCurrency(lineTotal),
    ]);
  }

  autoTable(doc, {
    startY: 58,
    head: [['Sr.', 'Item Description', 'SKU / Barcode', 'Unit Cost', 'Ordered Qty', 'Received Qty', 'Total Cost']],
    body: items,
    theme: 'grid',
    styles: {
      font: 'StoreFont',
      fontSize: 8,
      textColor: darkColor,
      cellPadding: 2.2,
    },
    headStyles: {
      font: 'StoreFont',
      fontStyle: 'bold',
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 60 },
      2: { cellWidth: 28 },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY || 130;
  const summaryX = 135;

  doc.setFont('StoreFont', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkColor);
  doc.text('Subtotal:', summaryX, finalY + 8);
  doc.text(formatCurrency(totalSum), 196, finalY + 8, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(summaryX, finalY + 12, 196, finalY + 12);

  doc.setFont('StoreFont', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('Grand Total:', summaryX, finalY + 17);
  doc.text(formatCurrency(totalSum), 196, finalY + 17, { align: 'right' });

  drawFooter(doc, grayColor);

  const filePath = path.join(OUT_DIR, 'Sample_MultiPage_GRN_StressTest.pdf');
  fs.writeFileSync(filePath, Buffer.from(doc.output('arraybuffer')));
  console.log('Generated Multi-page GRN:', filePath);
  return filePath;
}

generateSampleGRN();
generateSampleInvoice();
generateMultiPageGRN();
console.log('All sample PDFs successfully generated in:', OUT_DIR);
