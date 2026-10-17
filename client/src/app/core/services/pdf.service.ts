import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import { Sale, Product, Purchase } from './inventory-api.service';

/**
 * Formats a number as Indian Rupee currency: ₹1,23,456.00
 * Uses integer-paise arithmetic to eliminate floating-point rounding errors.
 */
export function formatCurrency(value: number, symbol: string = '₹'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return `${symbol}0.00`;
  }
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
    const parts: string[] = [];
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

/** Cached base64 assets */
let cachedLogoBase64: string | null = null;
let logoLoadAttempted = false;

let cachedRegFontBase64: string | null = null;
let cachedBoldFontBase64: string | null = null;
let fontLoadAttempted = false;

async function getLogoBase64(): Promise<string | null> {
  if (logoLoadAttempted) return cachedLogoBase64;
  logoLoadAttempted = true;
  try {
    const response = await fetch('assets/store-logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        resolve(cachedLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function loadFontBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || dataUrl;
        resolve(base64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Ensures the custom Unicode font (with Indian Rupee symbol support) is registered in jsPDF.
 * Returns the font name to use ('StoreFont' if loaded, otherwise 'helvetica').
 */
async function setupPdfFonts(doc: jsPDF): Promise<{ fontName: string; currencySymbol: string }> {
  if (!fontLoadAttempted) {
    fontLoadAttempted = true;
    try {
      const [reg, bold] = await Promise.all([
        loadFontBase64('assets/fonts/custom-font.ttf'),
        loadFontBase64('assets/fonts/custom-font-bold.ttf'),
      ]);
      cachedRegFontBase64 = reg;
      cachedBoldFontBase64 = bold;
    } catch {
      // Ignore font loading errors; fallback to standard fonts
    }
  }

  if (cachedRegFontBase64) {
    try {
      doc.addFileToVFS('StoreFont-Regular.ttf', cachedRegFontBase64);
      doc.addFont('StoreFont-Regular.ttf', 'StoreFont', 'normal');
      if (cachedBoldFontBase64) {
        doc.addFileToVFS('StoreFont-Bold.ttf', cachedBoldFontBase64);
        doc.addFont('StoreFont-Bold.ttf', 'StoreFont', 'bold');
      }
      return { fontName: 'StoreFont', currencySymbol: '₹' };
    } catch {
      return { fontName: 'helvetica', currencySymbol: 'Rs. ' };
    }
  }

  return { fontName: 'helvetica', currencySymbol: 'Rs. ' };
}

/** Common PDF header with logo, store name, and document title */
function drawPdfHeader(
  doc: jsPDF,
  logoBase64: string | null,
  documentTitle: string,
  fontName: string,
  primaryColor: [number, number, number],
  darkColor: [number, number, number],
  grayColor: [number, number, number]
): void {
  const leftX = 14;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', leftX, 10, 18, 18);
    } catch {
      // Continue without logo if embedding fails
    }
  }

  const textStartX = logoBase64 ? 36 : leftX;

  // Store Name
  doc.setFont(fontName, 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...darkColor);
  doc.text('SHREE GANESH KIRANA STORE', textStartX, 18);

  // Subtitle
  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...grayColor);
  doc.text('Inventory Management System  •  Daily Groceries & Provisions', textStartX, 23.5);

  // Document Title on Right
  doc.setFont(fontName, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text(documentTitle, 196, 18, { align: 'right' });

  // Accent line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(leftX, 31, 196, 31);
}

/** Common PDF footer with store name and page numbers */
function drawPdfFooter(doc: jsPDF, fontName: string, grayColor: [number, number, number]): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...grayColor);
    doc.text('Shree Ganesh Kirana Store — Inventory Management System', 14, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, 196, pageHeight - 8, { align: 'right' });
  }
}

@Injectable({
  providedIn: 'root',
})
export class PdfService {
  /**
   * Generates and downloads a professional Tax Invoice PDF
   */
  async generateInvoicePdf(sale: Sale): Promise<void> {
    const [logoBase64] = await Promise.all([getLogoBase64()]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const { fontName, currencySymbol } = await setupPdfFonts(doc);

    const primaryColor = [26, 107, 52] as [number, number, number]; // Green #1a6b34
    const darkColor = [15, 23, 42] as [number, number, number];
    const grayColor = [100, 116, 139] as [number, number, number];

    // 1. Header
    drawPdfHeader(doc, logoBase64, 'TAX INVOICE', fontName, primaryColor, darkColor, grayColor);

    // 2. Invoice Details on Right
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...darkColor);
    doc.text(`Invoice No: ${sale.invoiceNumber}`, 196, 37, { align: 'right' });

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...grayColor);
    const formattedDate = new Date(sale.saleDate).toLocaleString('en-IN');
    doc.text(`Date: ${formattedDate}`, 196, 42.5, { align: 'right' });
    doc.text(`Payment: ${sale.paymentMethod.toUpperCase()}`, 196, 47.5, { align: 'right' });

    // 3. Customer Info
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...darkColor);
    doc.text('Billed To:', 14, 40);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text(`Customer: ${sale.customerName || 'Walk-in Customer'}`, 14, 45.5);
    if (sale.customerPhone) {
      doc.text(`Phone: ${sale.customerPhone}`, 14, 50.5);
    }

    // 4. Barcode on Invoice
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, sale.invoiceNumber, {
        format: 'CODE128',
        width: 1.5,
        height: 30,
        displayValue: false,
        margin: 0,
      });
      const barcodeDataUrl = canvas.toDataURL('image/png');
      doc.addImage(barcodeDataUrl, 'PNG', 136, 51, 60, 9);
    } catch {
      // Optional barcode fallback
    }

    // 5. Items Table
    const tableBody = sale.items.map((item, index) => [
      (index + 1).toString(),
      item.productName,
      item.sku,
      formatCurrency(item.unitPrice, currencySymbol),
      item.quantity.toString(),
      formatCurrency(item.lineTotal, currencySymbol),
    ]);

    autoTable(doc, {
      startY: 64,
      head: [['#', 'Item Description', 'SKU', 'Unit Rate', 'Qty', 'Amount']],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: fontName,
        fontSize: 8.5,
        textColor: darkColor,
        cellPadding: 2.5,
      },
      headStyles: {
        font: fontName,
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

    // 6. Summary Totals
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    const summaryX = 135;

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkColor);

    doc.text('Subtotal:', summaryX, finalY + 8);
    doc.text(formatCurrency(sale.subtotal, currencySymbol), 196, finalY + 8, { align: 'right' });

    let currentY = finalY + 8;
    if (sale.discount > 0) {
      currentY += 5.5;
      doc.setFont(fontName, 'normal');
      doc.setTextColor(220, 38, 38);
      doc.text('Discount:', summaryX, currentY);
      doc.text(`-${formatCurrency(sale.discount, currencySymbol)}`, 196, currentY, { align: 'right' });
    }

    if (sale.tax > 0) {
      currentY += 5.5;
      doc.setFont(fontName, 'normal');
      doc.setTextColor(...darkColor);
      doc.text('GST / Tax:', summaryX, currentY);
      doc.text(`+${formatCurrency(sale.tax, currencySymbol)}`, 196, currentY, { align: 'right' });
    }

    currentY += 7;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(summaryX, currentY - 2, 196, currentY - 2);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text('Grand Total:', summaryX, currentY + 3.5);
    doc.text(formatCurrency(sale.grandTotal, currencySymbol), 196, currentY + 3.5, { align: 'right' });

    // 7. Footer note & pagination
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...grayColor);
    doc.text(
      'Thank you for shopping at Shree Ganesh Kirana Store! Goods once sold can be exchanged within 7 days with this invoice.',
      14,
      pageHeight - 16
    );

    drawPdfFooter(doc, fontName, grayColor);

    doc.save(`Invoice_${sale.invoiceNumber}.pdf`);
  }

  /**
   * Generates a printable Barcode Tag / Sticker PDF for a product
   */
  async generateBarcodeStickerPdf(product: Product): Promise<void> {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [80, 50],
    });

    const { fontName, currencySymbol } = await setupPdfFonts(doc);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.text(product.name.substring(0, 32), 40, 7, { align: 'center' });

    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`SKU: ${product.sku} | Unit: ${product.uom}`, 40, 12, { align: 'center' });

    // Render Barcode
    const barcodeValue = product.barcode || product.sku;
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, barcodeValue, {
        format: product.barcode ? 'EAN13' : 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 11,
        margin: 0,
      });
      const barcodeDataUrl = canvas.toDataURL('image/png');
      doc.addImage(barcodeDataUrl, 'PNG', 8, 15, 64, 22);
    } catch {
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 11,
          margin: 0,
        });
        const barcodeDataUrl = canvas.toDataURL('image/png');
        doc.addImage(barcodeDataUrl, 'PNG', 8, 15, 64, 22);
      } catch (err) {
        console.error('Barcode sticker generation error:', err);
      }
    }

    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 107, 52);
    doc.text(`MRP: ${formatCurrency(product.sellingPrice, currencySymbol)}`, 40, 44, { align: 'center' });

    doc.save(`Barcode_${product.sku}.pdf`);
  }

  /**
   * Generates and downloads a formal Goods Receipt Note (GRN) or Purchase Order (PO) PDF
   * strictly adhering to the requested structure:
   * - Header: Store logo on left, SHREE GANESH KIRANA STORE, Subtitle: Inventory Management System, Document title: GOODS RECEIPT NOTE
   * - Document details: GRN number, Purchase order number, Receipt date, Receipt status
   * - Supplier details: Supplier name, contact info
   * - Items table: Sr. No., Item Description, SKU / Barcode, Unit Cost, Ordered Quantity, Received Quantity, Total Cost
   * - Summary: Subtotal, Taxes/freight, Grand Total
   * - Footer: Authorized / received by, Supplier acknowledgment, page numbering
   */
  async generatePurchaseOrderPdf(purchase: Purchase): Promise<void> {
    const [logoBase64] = await Promise.all([getLogoBase64()]);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const { fontName, currencySymbol } = await setupPdfFonts(doc);

    const primaryColor = [26, 107, 52] as [number, number, number]; // Green #1a6b34
    const darkColor = [15, 23, 42] as [number, number, number];
    const grayColor = [100, 116, 139] as [number, number, number];

    const isGRN = purchase.status === 'received';
    const docTitle = isGRN ? 'GOODS RECEIPT NOTE' : 'PURCHASE ORDER';
    const grnNumber = isGRN ? `GRN-${purchase.purchaseNumber.replace(/^PO-?/, '')}` : purchase.purchaseNumber;

    // 1. Header with logo, store name, subtitle, and title
    drawPdfHeader(doc, logoBase64, docTitle, fontName, primaryColor, darkColor, grayColor);

    // 2. Document details on right
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...darkColor);
    doc.text(`${isGRN ? 'GRN Number' : 'PO Number'}: ${grnNumber}`, 196, 37, { align: 'right' });

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...grayColor);
    if (isGRN) {
      doc.text(`PO Reference: ${purchase.purchaseNumber}`, 196, 42, { align: 'right' });
    }
    const receiptDate = new Date(purchase.receivedDate || purchase.purchaseDate).toLocaleDateString('en-IN');
    doc.text(`Receipt Date: ${receiptDate}`, 196, isGRN ? 47 : 42, { align: 'right' });

    // Status badge
    const statusY = isGRN ? 52 : 47;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(8.5);
    if (purchase.status === 'received') {
      doc.setTextColor(16, 185, 129); // green
    } else if (purchase.status === 'cancelled') {
      doc.setTextColor(239, 68, 68); // red
    } else {
      doc.setTextColor(245, 158, 11); // amber
    }
    doc.text(`Status: ${purchase.status.toUpperCase()}`, 196, statusY, { align: 'right' });

    // 3. Supplier Details
    const supplierName = purchase.supplier?.name || 'Authorized Supplier';
    const supplierContact = purchase.supplier?.contactPerson || '';
    const supplierPhone = purchase.supplier?.phone || '';
    const supplierEmail = purchase.supplier?.email || '';
    const supplierAddress = purchase.supplier?.address || '';

    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...darkColor);
    doc.text('Supplier Details:', 14, 38);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...grayColor);
    doc.text(`Supplier: ${supplierName}`, 14, 43.5);
    let supplierY = 43.5;

    if (supplierContact) {
      supplierY += 4.5;
      doc.text(`Contact Person: ${supplierContact}`, 14, supplierY);
    }
    if (supplierPhone || supplierEmail) {
      supplierY += 4.5;
      const contactText = [supplierPhone && `Phone: ${supplierPhone}`, supplierEmail && `Email: ${supplierEmail}`]
        .filter(Boolean)
        .join(' | ');
      doc.text(contactText, 14, supplierY);
    }
    if (supplierAddress) {
      supplierY += 4.5;
      doc.text(`Address: ${supplierAddress.substring(0, 50)}`, 14, supplierY);
    }

    // 4. Items Table
    const tableBody = purchase.items.map((item, idx) => [
      (idx + 1).toString(),
      item.productName || 'Grocery Item',
      item.sku || '-',
      formatCurrency(item.unitCost, currencySymbol),
      item.quantity.toString(),
      isGRN ? item.quantity.toString() : 'Pending',
      formatCurrency(item.totalCost, currencySymbol),
    ]);

    const tableStartY = Math.max(supplierY + 8, 62);

    autoTable(doc, {
      startY: tableStartY,
      head: [['Sr.', 'Item Description', 'SKU / Barcode', 'Unit Cost', 'Ordered Qty', 'Received Qty', 'Total Cost']],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: fontName,
        fontSize: 8.5,
        textColor: darkColor,
        cellPadding: 2.5,
      },
      headStyles: {
        font: fontName,
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

    // 5. Summary Totals
    const finalY = (doc as any).lastAutoTable?.finalY || 130;
    const summaryX = 135;

    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkColor);

    doc.text('Subtotal:', summaryX, finalY + 8);
    doc.text(formatCurrency(purchase.subtotal, currencySymbol), 196, finalY + 8, { align: 'right' });

    let currentY = finalY + 8;
    if (purchase.tax > 0) {
      currentY += 5.5;
      doc.setFont(fontName, 'normal');
      doc.setTextColor(...darkColor);
      doc.text('Tax / Freight:', summaryX, currentY);
      doc.text(formatCurrency(purchase.tax, currencySymbol), 196, currentY, { align: 'right' });
    }

    currentY += 7;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(summaryX, currentY - 2, 196, currentY - 2);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...primaryColor);
    doc.text('Grand Total:', summaryX, currentY + 3.5);
    doc.text(formatCurrency(purchase.total, currencySymbol), 196, currentY + 3.5, { align: 'right' });

    // 6. Signatures (Authorized / Received by & Supplier Acknowledgment)
    const pageHeight = doc.internal.pageSize.getHeight();
    const sigY = Math.min(currentY + 28, pageHeight - 32);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...grayColor);

    const receivedByName = purchase.receivedBy?.name ? `(${purchase.receivedBy.name})` : '(Store Manager)';
    doc.text('_________________________________', 20, sigY);
    doc.text(`Authorized / Received By ${receivedByName}`, 20, sigY + 5.5);

    doc.text('_________________________________', 130, sigY);
    doc.text('Supplier / Deliverer Acknowledgment', 130, sigY + 5.5);

    // 7. Footer & page numbers
    drawPdfFooter(doc, fontName, grayColor);

    // Save PDF
    const filenamePrefix = isGRN ? 'GRN' : 'PO';
    doc.save(`${filenamePrefix}_${purchase.purchaseNumber}.pdf`);
  }

  /**
   * Generates and downloads a complete Inventory Stock Valuation Report PDF
   */
  async generateInventoryReportPdf(products: Product[]): Promise<void> {
    const [logoBase64] = await Promise.all([getLogoBase64()]);

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const { fontName, currencySymbol } = await setupPdfFonts(doc);

    const primaryColor = [26, 107, 52] as [number, number, number];
    const darkColor = [15, 23, 42] as [number, number, number];
    const grayColor = [100, 116, 139] as [number, number, number];

    // Header
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 14, 8, 14, 14);
      } catch {
        // Continue without logo
      }
    }

    const textX = logoBase64 ? 32 : 14;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text('INVENTORY STOCK AUDIT & VALUATION REPORT', textX, 15);

    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...grayColor);
    doc.text('Shree Ganesh Kirana Store — Inventory Management System', textX, 20.5);

    doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Total Items: ${products.length}`, 283, 15, {
      align: 'right',
    });

    // Compute metrics
    const totalUnits = products.reduce((acc, p) => acc + (p.currentStock || 0), 0);
    const totalCostValue = products.reduce((acc, p) => acc + (p.currentStock || 0) * (p.purchasePrice || 0), 0);
    const totalRetailValue = products.reduce((acc, p) => acc + (p.currentStock || 0) * (p.sellingPrice || 0), 0);
    const lowStockCount = products.filter((p) => p.currentStock <= p.minStock).length;

    // Summary banner
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 25, 269, 13, 2, 2, 'F');

    doc.setFont(fontName, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...darkColor);
    doc.text(`Total Units: ${totalUnits}`, 20, 33);
    doc.text(`Asset Cost: ${formatCurrency(totalCostValue, currencySymbol)}`, 85, 33);
    doc.text(`Retail Value: ${formatCurrency(totalRetailValue, currencySymbol)}`, 165, 33);
    doc.text(`Low/Out Stock: ${lowStockCount}`, 240, 33);

    const tableBody = products.map((p, idx) => [
      (idx + 1).toString(),
      p.sku,
      p.barcode || '-',
      p.name,
      typeof p.category === 'object' ? p.category.name : 'Category',
      `${p.currentStock} ${p.uom}`,
      formatCurrency(p.purchasePrice, currencySymbol),
      formatCurrency(p.sellingPrice, currencySymbol),
      formatCurrency(p.currentStock * p.purchasePrice, currencySymbol),
      p.currentStock <= 0 ? 'OUT OF STOCK' : p.currentStock <= p.minStock ? 'LOW STOCK' : 'OK',
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['#', 'SKU', 'Barcode', 'Product Name', 'Category', 'Stock Qty', 'Cost Price', 'Sell Price', 'Asset Value', 'Status']],
      body: tableBody,
      theme: 'grid',
      styles: {
        font: fontName,
        fontSize: 8,
        textColor: darkColor,
        cellPadding: 2,
      },
      headStyles: {
        font: fontName,
        fontStyle: 'bold',
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 28 },
        3: { cellWidth: 55 },
        4: { cellWidth: 32 },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 24, halign: 'right' },
        7: { cellWidth: 24, halign: 'right' },
        8: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        9: { cellWidth: 22, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });

    drawPdfFooter(doc, fontName, grayColor);

    doc.save(`Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}
