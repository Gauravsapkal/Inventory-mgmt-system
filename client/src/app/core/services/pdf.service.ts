import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JsBarcode from 'jsbarcode';
import { Sale, Product, Purchase } from './inventory-api.service';

@Injectable({
  providedIn: 'root',
})
export class PdfService {
  /**
   * Generates and downloads a professional Tax Invoice PDF
   */
  generateInvoicePdf(sale: Sale): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = [37, 99, 235] as [number, number, number]; // #2563eb
    const darkColor = [15, 23, 42] as [number, number, number]; // #0f172a
    const grayColor = [100, 116, 139] as [number, number, number]; // #64748b

    // 1. Header & Store Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...darkColor);
    doc.text('INVENTORY ERP SYSTEM', 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text('123 College Campus Boulevard, Tech Block', 14, 26);
    doc.text('Phone: +91 98765 43210  |  Email: store@inventory.local', 14, 31);
    doc.text('GSTIN: 07AAAAA0000A1Z5', 14, 36);

    // 2. Invoice Tag on Right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text('TAX INVOICE', 196, 20, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...darkColor);
    doc.text(`Invoice No: ${sale.invoiceNumber}`, 196, 27, { align: 'right' });
    const formattedDate = new Date(sale.saleDate).toLocaleString();
    doc.text(`Date: ${formattedDate}`, 196, 33, { align: 'right' });
    doc.text(`Payment: ${sale.paymentMethod.toUpperCase()}`, 196, 39, { align: 'right' });

    // Decorative Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 43, 196, 43);

    // 3. Customer Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...darkColor);
    doc.text('Billed To (Customer):', 14, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...grayColor);
    doc.text(`Name: ${sale.customerName || 'Walk-in Customer'}`, 14, 56);
    if (sale.customerPhone) {
      doc.text(`Phone: ${sale.customerPhone}`, 14, 61);
    }

    // 4. Barcode on Invoice
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, sale.invoiceNumber, {
        format: 'CODE128',
        width: 1.5,
        height: 35,
        displayValue: false,
        margin: 0,
      });
      const barcodeDataUrl = canvas.toDataURL('image/png');
      doc.addImage(barcodeDataUrl, 'PNG', 130, 47, 66, 12);
    } catch {
      // Barcode generation optional fallback
    }

    // 5. Items Table
    const tableBody = sale.items.map((item, index) => [
      (index + 1).toString(),
      item.productName,
      item.sku,
      `₹${item.unitPrice.toFixed(2)}`,
      item.quantity.toString(),
      `₹${item.lineTotal.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 68,
      head: [['#', 'Item Description', 'SKU', 'Unit Price', 'Qty', 'Amount']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: darkColor,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 15, halign: 'center' },
        5: { cellWidth: 27, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    // 6. Summary Totals (below table)
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    const summaryX = 135;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...darkColor);

    doc.text('Subtotal:', summaryX, finalY + 10);
    doc.text(`₹${sale.subtotal.toFixed(2)}`, 196, finalY + 10, { align: 'right' });

    let currentY = finalY + 10;
    if (sale.discount > 0) {
      currentY += 6;
      doc.setTextColor(220, 38, 38);
      doc.text('Discount:', summaryX, currentY);
      doc.text(`-₹${sale.discount.toFixed(2)}`, 196, currentY, { align: 'right' });
    }

    if (sale.tax > 0) {
      currentY += 6;
      doc.setTextColor(...darkColor);
      doc.text('GST / Tax:', summaryX, currentY);
      doc.text(`+₹${sale.tax.toFixed(2)}`, 196, currentY, { align: 'right' });
    }

    currentY += 8;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(summaryX, currentY - 2, 196, currentY - 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text('Grand Total:', summaryX, currentY + 4);
    doc.text(`₹${sale.grandTotal.toFixed(2)}`, 196, currentY + 4, { align: 'right' });

    // 7. Footer & Terms
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text('Thank you for your business! Goods once sold can be exchanged within 7 days with this original invoice.', 14, pageHeight - 15);
    doc.text('This is a computer-generated tax invoice verified by MCA Inventory Management System.', 14, pageHeight - 10);

    // Save PDF file to device storage
    doc.save(`Invoice_${sale.invoiceNumber}.pdf`);
  }

  /**
   * Generates a printable Barcode Tag / Sticker PDF for a product
   */
  generateBarcodeStickerPdf(product: Product): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [80, 50], // Standard 80x50mm barcode sticker label
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(product.name.substring(0, 32), 40, 8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`SKU: ${product.sku} | Unit: ${product.uom}`, 40, 13, { align: 'center' });

    // Render Barcode
    const barcodeValue = product.barcode || product.sku;
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, barcodeValue, {
        format: product.barcode ? 'EAN13' : 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 12,
        margin: 0,
      });
      const barcodeDataUrl = canvas.toDataURL('image/png');
      doc.addImage(barcodeDataUrl, 'PNG', 8, 16, 64, 22);
    } catch {
      // Fallback to Code 128 if EAN checksum fails
      try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, barcodeValue, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 12,
          margin: 0,
        });
        const barcodeDataUrl = canvas.toDataURL('image/png');
        doc.addImage(barcodeDataUrl, 'PNG', 8, 16, 64, 22);
      } catch (err) {
        console.error('Barcode generation error:', err);
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text(`MRP: ₹${product.sellingPrice.toFixed(2)}`, 40, 45, { align: 'center' });

    doc.save(`Barcode_${product.sku}.pdf`);
  }

  /**
   * Generates and downloads a formal Purchase Order / Goods Receipt Note PDF
   */
  generatePurchaseOrderPdf(purchase: Purchase): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = [15, 118, 110] as [number, number, number]; // Teal #0f766e
    const darkColor = [15, 23, 42] as [number, number, number];
    const grayColor = [100, 116, 139] as [number, number, number];

    // 1. Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...darkColor);
    doc.text('INVENTORY ERP SYSTEM', 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text('Procurement & Supply Chain Division', 14, 26);
    doc.text('Warehouse Hub, Tech Zone | logistics@inventory.local', 14, 31);

    // 2. PO Badge on Right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.text(purchase.status === 'received' ? 'GOODS RECEIPT NOTE' : 'PURCHASE ORDER', 196, 20, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...darkColor);
    doc.text(`PO Number: ${purchase.purchaseNumber}`, 196, 27, { align: 'right' });
    doc.text(`Date: ${new Date(purchase.purchaseDate).toLocaleDateString()}`, 196, 33, { align: 'right' });
    doc.text(`Status: ${purchase.status.toUpperCase()}`, 196, 39, { align: 'right' });

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 43, 196, 43);

    // 3. Supplier Details
    const supplierName = purchase.supplier?.name || 'Authorized Supplier';
    const supplierPhone = purchase.supplier?.phone || '';
    const supplierEmail = purchase.supplier?.email || '';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...darkColor);
    doc.text('Vendor / Supplier Information:', 14, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...grayColor);
    doc.text(`Company: ${supplierName}`, 14, 56);
    if (supplierPhone) doc.text(`Phone: ${supplierPhone}`, 14, 61);
    if (supplierEmail) doc.text(`Email: ${supplierEmail}`, 14, 66);

    // 4. Items Table
    const tableBody = purchase.items.map((item, idx) => [
      (idx + 1).toString(),
      item.productName || 'Item',
      item.sku || '-',
      `₹${item.unitCost.toFixed(2)}`,
      item.quantity.toString(),
      `₹${item.totalCost.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: 72,
      head: [['#', 'Item Description', 'SKU', 'Unit Cost', 'Ordered Qty', 'Total Cost']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: darkColor,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 130;
    const summaryX = 135;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...darkColor);
    doc.text('Subtotal:', summaryX, finalY + 10);
    doc.text(`₹${purchase.subtotal.toFixed(2)}`, 196, finalY + 10, { align: 'right' });

    let currentY = finalY + 10;
    if (purchase.tax > 0) {
      currentY += 6;
      doc.text('Freight / Tax:', summaryX, currentY);
      doc.text(`₹${purchase.tax.toFixed(2)}`, 196, currentY, { align: 'right' });
    }

    currentY += 8;
    doc.setDrawColor(203, 213, 225);
    doc.line(summaryX, currentY - 2, 196, currentY - 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text('Total Cost:', summaryX, currentY + 4);
    doc.text(`₹${purchase.total.toFixed(2)}`, 196, currentY + 4, { align: 'right' });

    // Signatures
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text('_________________________', 25, pageHeight - 30);
    doc.text('Authorized Purchasing Officer', 25, pageHeight - 24);

    doc.text('_________________________', 140, pageHeight - 30);
    doc.text('Supplier Acknowledgment', 140, pageHeight - 24);

    doc.save(`PO_${purchase.purchaseNumber}.pdf`);
  }

  /**
   * Generates and downloads a complete Inventory Stock Valuation Report PDF
   */
  generateInventoryReportPdf(products: Product[]): void {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const primaryColor = [30, 58, 138] as [number, number, number]; // Navy #1e3a8a
    const darkColor = [15, 23, 42] as [number, number, number];
    const grayColor = [100, 116, 139] as [number, number, number];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...primaryColor);
    doc.text('INVENTORY STOCK AUDIT & VALUATION REPORT', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...grayColor);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Total Catalog Items: ${products.length}`, 14, 24);

    // Compute metrics
    const totalUnits = products.reduce((acc, p) => acc + (p.currentStock || 0), 0);
    const totalCostValue = products.reduce((acc, p) => acc + (p.currentStock || 0) * (p.purchasePrice || 0), 0);
    const totalRetailValue = products.reduce((acc, p) => acc + (p.currentStock || 0) * (p.sellingPrice || 0), 0);
    const lowStockCount = products.filter((p) => p.currentStock <= p.minStock).length;

    // Summary banner
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 28, 269, 14, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...darkColor);
    doc.text(`Total Units in Stock: ${totalUnits}`, 20, 36);
    doc.text(`Total Asset Cost: ₹${totalCostValue.toFixed(2)}`, 85, 36);
    doc.text(`Total Retail Valuation: ₹${totalRetailValue.toFixed(2)}`, 160, 36);
    doc.text(`Low/Out Stock Alerts: ${lowStockCount}`, 230, 36);

    const tableBody = products.map((p, idx) => [
      (idx + 1).toString(),
      p.sku,
      p.barcode || '-',
      p.name,
      typeof p.category === 'object' ? p.category.name : 'Category',
      `${p.currentStock} ${p.uom}`,
      `₹${p.purchasePrice.toFixed(2)}`,
      `₹${p.sellingPrice.toFixed(2)}`,
      `₹${(p.currentStock * p.purchasePrice).toFixed(2)}`,
      p.currentStock <= 0 ? 'OUT OF STOCK' : p.currentStock <= p.minStock ? 'LOW STOCK' : 'OK',
    ]);

    autoTable(doc, {
      startY: 46,
      head: [['#', 'SKU', 'Barcode', 'Product Name', 'Category', 'Stock Qty', 'Cost Price', 'Sell Price', 'Asset Value', 'Status']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: darkColor,
      },
      margin: { left: 14, right: 14 },
    });

    doc.save(`Inventory_Valuation_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}
