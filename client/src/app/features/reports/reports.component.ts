import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { InventoryApiService, Product, Sale, Purchase } from '../../core/services/inventory-api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reports-page">
      <div class="page-header no-print">
        <div>
          <h1 class="page-title">Analytics &amp; Reports</h1>
          <p class="page-subtitle">Exportable financial and stock auditing summaries</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="exportCSV()">📥 Export CSV</button>
        </div>
      </div>

      <!-- TABS -->
      <div class="report-tabs no-print">
        <button
          class="tab-btn"
          [class.active]="activeTab === 'inventory'"
          (click)="setTab('inventory')"
        >
          📦 Inventory Valuation
        </button>
        <button
          class="tab-btn"
          [class.active]="activeTab === 'sales'"
          (click)="setTab('sales')"
        >
          💰 Sales Performance
        </button>
        <button
          class="tab-btn"
          [class.active]="activeTab === 'purchases'"
          (click)="setTab('purchases')"
        >
          📑 Procurement Costs
        </button>
      </div>

      <!-- INVENTORY VALUATION REPORT -->
      @if (activeTab === 'inventory') {
        <div class="card table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Asset Valuation (Cost)</th>
                <th>Potential Revenue</th>
              </tr>
            </thead>
            <tbody>
              @for (prod of inventoryReport(); track prod._id) {
                <tr>
                  <td class="font-bold">{{ prod.name }}</td>
                  <td class="font-mono text-muted">{{ prod.sku }}</td>
                  <td class="font-bold font-mono">{{ prod.currentStock }} {{ prod.uom }}</td>
                  <td class="font-mono">₹{{ prod.purchasePrice.toFixed(2) }}</td>
                  <td class="font-mono">₹{{ prod.sellingPrice.toFixed(2) }}</td>
                  <td class="font-mono font-bold">₹{{ (prod.currentStock * prod.purchasePrice).toFixed(2) }}</td>
                  <td class="font-mono font-bold text-success">₹{{ (prod.currentStock * prod.sellingPrice).toFixed(2) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- SALES SUMMARY REPORT -->
      @if (activeTab === 'sales') {
        <div class="sales-report-container">
          @if (salesSummary()) {
            <div class="stats-grid">
              <div class="card stat-box">
                <span class="stat-label">Total Invoices</span>
                <span class="stat-value">{{ salesSummary().totalSalesCount }}</span>
              </div>
              <div class="card stat-box">
                <span class="stat-label">Total Revenue</span>
                <span class="stat-value font-mono text-success">₹{{ salesSummary().totalRevenue.toFixed(2) }}</span>
              </div>
              <div class="card stat-box">
                <span class="stat-label">Total Discounts Given</span>
                <span class="stat-value font-mono text-danger">₹{{ salesSummary().totalDiscount.toFixed(2) }}</span>
              </div>
              <div class="card stat-box">
                <span class="stat-label">Total Tax Collected</span>
                <span class="stat-value font-mono">₹{{ salesSummary().totalTax.toFixed(2) }}</span>
              </div>
            </div>
          }

          <div class="card table-container" style="margin-top: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items Sold</th>
                  <th>Grand Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                @for (sale of salesReport(); track sale._id) {
                  <tr>
                    <td class="font-mono font-bold">{{ sale.invoiceNumber }}</td>
                    <td>{{ sale.saleDate | date:'mediumDate' }}</td>
                    <td>{{ sale.customerName }}</td>
                    <td>{{ sale.items.length }} line items</td>
                    <td class="font-mono font-bold">₹{{ sale.grandTotal.toFixed(2) }}</td>
                    <td><span class="badge badge-info">{{ sale.paymentMethod | uppercase }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- PROCUREMENT REPORT -->
      @if (activeTab === 'purchases') {
        <div class="purchases-report-container">
          @if (purchasesSummary()) {
            <div class="stats-grid">
              <div class="card stat-box">
                <span class="stat-label">Purchase Orders</span>
                <span class="stat-value">{{ purchasesSummary().totalPurchasesCount }}</span>
              </div>
              <div class="card stat-box">
                <span class="stat-label">Total Expenditure</span>
                <span class="stat-value font-mono text-primary">₹{{ purchasesSummary().totalExpenditure.toFixed(2) }}</span>
              </div>
              <div class="card stat-box">
                <span class="stat-label">Orders Received</span>
                <span class="stat-value text-success">{{ purchasesSummary().totalReceivedCount }}</span>
              </div>
            </div>
          }

          <div class="card table-container" style="margin-top: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Total Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (p of purchasesReport(); track p._id) {
                  <tr>
                    <td class="font-mono font-bold">{{ p.purchaseNumber }}</td>
                    <td>{{ p.purchaseDate | date:'mediumDate' }}</td>
                    <td>{{ p.supplier?.name || 'Vendor' }}</td>
                    <td>{{ p.items.length }}</td>
                    <td class="font-mono font-bold">₹{{ p.total.toFixed(2) }}</td>
                    <td><span class="badge" [class.badge-success]="p.status === 'received'">{{ p.status | uppercase }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .reports-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
    .page-title { font-size: var(--font-size-xl); font-weight: 800; }
    .page-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }

    .report-tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 0.5rem;

      .tab-btn {
        padding: 0.65rem 1.25rem;
        border-radius: var(--radius-md);
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-text-muted);

        &:hover {
          background-color: var(--color-surface-hover);
          color: var(--color-text-main);
        }

        &.active {
          background-color: var(--color-primary-light);
          color: var(--color-primary);
        }
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;

      .stat-box {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;

        .stat-label {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          font-weight: 600;
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 1.4rem;
          font-weight: 800;
        }
      }
    }

    .font-bold { font-weight: 600; }
    .text-muted { color: var(--color-text-muted); }
    .text-success { color: #10b981; }
    .text-danger { color: #ef4444; }
    .text-primary { color: var(--color-primary); }
  `],
})
export class ReportsComponent implements OnInit {
  private api = inject(InventoryApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);

  activeTab: 'inventory' | 'sales' | 'purchases' = 'inventory';

  inventoryReport = signal<Product[]>([]);
  salesReport = signal<Sale[]>([]);
  salesSummary = signal<any>(null);
  purchasesReport = signal<Purchase[]>([]);
  purchasesSummary = signal<any>(null);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['stockStatus']) {
        this.loadInventoryReport(params['stockStatus']);
      } else {
        this.loadInventoryReport();
      }
    });
  }

  setTab(tab: 'inventory' | 'sales' | 'purchases'): void {
    this.activeTab = tab;
    if (tab === 'inventory') this.loadInventoryReport();
    else if (tab === 'sales') this.loadSalesReport();
    else if (tab === 'purchases') this.loadPurchasesReport();
  }

  loadInventoryReport(status?: string): void {
    this.api.getInventoryReport({ stockStatus: status }).subscribe({
      next: (res) => { if (res.success) this.inventoryReport.set(res.data); },
    });
  }

  loadSalesReport(): void {
    this.api.getSalesReport().subscribe({
      next: (res) => {
        if (res.success) {
          this.salesReport.set(res.data.sales);
          this.salesSummary.set(res.data.summary);
        }
      },
    });
  }

  loadPurchasesReport(): void {
    this.api.getPurchasesReport().subscribe({
      next: (res) => {
        if (res.success) {
          this.purchasesReport.set(res.data.purchases);
          this.purchasesSummary.set(res.data.summary);
        }
      },
    });
  }

  exportCSV(): void {
    let csv = '';
    let filename = 'report.csv';

    if (this.activeTab === 'inventory') {
      csv = 'Name,SKU,Barcode,Stock,UOM,CostPrice,SellingPrice,AssetValuation\n';
      this.inventoryReport().forEach((p) => {
        csv += `"${p.name}","${p.sku}","${p.barcode || ''}",${p.currentStock},"${p.uom}",${p.purchasePrice},${p.sellingPrice},${p.currentStock * p.purchasePrice}\n`;
      });
      filename = 'inventory-report.csv';
    } else if (this.activeTab === 'sales') {
      csv = 'InvoiceNumber,Date,Customer,GrandTotal,PaymentMethod\n';
      this.salesReport().forEach((s) => {
        csv += `"${s.invoiceNumber}","${s.saleDate}","${s.customerName}",${s.grandTotal},"${s.paymentMethod}"\n`;
      });
      filename = 'sales-report.csv';
    } else {
      csv = 'PurchaseNumber,Date,Supplier,Total,Status\n';
      this.purchasesReport().forEach((p) => {
        csv += `"${p.purchaseNumber}","${p.purchaseDate}","${p.supplier?.name || ''}",${p.total},"${p.status}"\n`;
      });
      filename = 'purchases-report.csv';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success(`Exported ${filename}`);
  }
}
