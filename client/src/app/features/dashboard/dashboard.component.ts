import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InventoryApiService, DashboardStats } from '../../core/services/inventory-api.service';
import { LayoutService } from '../../core/services/layout.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-page">
      <!-- HEADER -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Executive Dashboard</h1>
          <p class="page-subtitle">Real-time inventory metrics and sales analytics</p>
        </div>
        <div class="header-actions">
          <a routerLink="/scanner" class="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            </svg>
            <span>Scan Barcode</span>
          </a>
          <button (click)="loadDashboard()" class="btn btn-secondary" title="Refresh Dashboard Data">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- LOW STOCK ALERT STRIP -->
      @if (stats()?.lowStockProducts || stats()?.outOfStockProducts) {
        <div class="alert-banner">
          <div class="alert-content">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>
              <strong>Inventory Attention Required:</strong>
              {{ stats()?.lowStockProducts }} product(s) below reorder threshold and {{ stats()?.outOfStockProducts }} completely out of stock.
            </span>
          </div>
          <a routerLink="/reports" [queryParams]="{ stockStatus: 'low' }" class="btn btn-sm btn-secondary">
            View Low Stock
          </a>
        </div>
      }

      <!-- STATS CARDS GRID -->
      <div class="stats-grid">
        <div class="card stat-card">
          <div class="stat-icon bg-blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
            </svg>
          </div>
          <div class="stat-body">
            <span class="stat-label">Active Products</span>
            <h3 class="stat-value">{{ stats()?.totalProducts ?? '--' }}</h3>
            <span class="stat-meta">{{ stats()?.totalUnitsInStock ?? 0 }} total units stored</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-icon bg-green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div class="stat-body">
            <span class="stat-label">Today's Sales</span>
            <h3 class="stat-value font-mono">₹{{ stats()?.todaySales?.amount?.toFixed(2) ?? '0.00' }}</h3>
            <span class="stat-meta">{{ stats()?.todaySales?.count ?? 0 }} orders processed today</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-icon bg-purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div class="stat-body">
            <span class="stat-label">This Month Sales</span>
            <h3 class="stat-value font-mono">₹{{ stats()?.monthlySales?.amount?.toFixed(2) ?? '0.00' }}</h3>
            <span class="stat-meta">{{ stats()?.monthlySales?.count ?? 0 }} total monthly invoices</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-icon bg-amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div class="stat-body">
            <span class="stat-label">Stock Alerts</span>
            <h3 class="stat-value text-warning">{{ (stats()?.lowStockProducts ?? 0) + (stats()?.outOfStockProducts ?? 0) }}</h3>
            <span class="stat-meta text-danger">{{ stats()?.outOfStockProducts ?? 0 }} out of stock</span>
          </div>
        </div>
      </div>

      <!-- CHARTS SECTION -->
      <div class="charts-grid">
        <div class="card chart-card">
          <div class="chart-header">
            <h4>Sales Trend (Last 7 Days)</h4>
          </div>
          <div class="chart-body">
            <canvas #salesChartCanvas></canvas>
          </div>
        </div>

        <div class="card chart-card">
          <div class="chart-header">
            <h4>Stock Distribution by Category</h4>
          </div>
          <div class="chart-body">
            <canvas #categoryChartCanvas></canvas>
          </div>
        </div>
      </div>

      <!-- RECENT ACTIVITY TABLES / CARDS -->
      <div class="activity-grid">
        <!-- Recent Sales -->
        <div class="card activity-card">
          <div class="card-header">
            <h4>Recent Sales</h4>
            <a routerLink="/sales" class="btn btn-ghost btn-sm">View All &rarr;</a>
          </div>

          @if (stats()?.recentSales?.length) {
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Processed By</th>
                  </tr>
                </thead>
                <tbody>
                  @for (sale of stats()?.recentSales; track sale._id) {
                    <tr>
                      <td class="font-mono font-bold">{{ sale.invoiceNumber }}</td>
                      <td>{{ sale.customerName }}</td>
                      <td class="font-mono font-bold text-success">₹{{ sale.grandTotal.toFixed(2) }}</td>
                      <td>{{ sale.processedBy?.name || 'Staff' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="empty-text">No recent sales recorded.</p>
          }
        </div>

        <!-- Best Selling Products -->
        <div class="card activity-card">
          <div class="card-header">
            <h4>Top Selling Products</h4>
            <a routerLink="/products" class="btn btn-ghost btn-sm">Manage Products &rarr;</a>
          </div>

          @if (stats()?.topSellingProducts?.length) {
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Qty Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of stats()?.topSellingProducts; track item._id) {
                    <tr>
                      <td class="font-bold">{{ item.name }}</td>
                      <td class="font-mono text-muted">{{ item.sku }}</td>
                      <td class="font-bold">{{ item.totalQuantitySold }}</td>
                      <td class="font-mono font-bold">₹{{ item.totalRevenue.toFixed(2) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="empty-text">No sales data recorded yet.</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;

      .page-title {
        font-size: var(--font-size-xl);
        font-weight: 800;
        color: var(--color-text-main);
      }

      .page-subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
    }

    .alert-banner {
      background-color: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: var(--radius-md);
      padding: 0.875rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
      color: #92400e;

      .alert-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: var(--font-size-sm);
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1.25rem;

      @media (max-width: 1023px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 480px) {
        grid-template-columns: 1fr;
      }
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 1.25rem;

      .stat-icon {
        width: 52px;
        height: 52px;
        border-radius: var(--radius-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.bg-blue { background-color: #eff6ff; color: #2563eb; }
        &.bg-green { background-color: #ecfdf5; color: #10b981; }
        &.bg-purple { background-color: #f5f3ff; color: #8b5cf6; }
        &.bg-amber { background-color: #fffbeb; color: #f59e0b; }
      }

      .stat-body {
        display: flex;
        flex-direction: column;

        .stat-label {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-text-main);
          margin: 0.2rem 0;
        }

        .stat-meta {
          font-size: 0.75rem;
          color: var(--color-text-subtle);
        }
      }
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;

      @media (max-width: 1023px) {
        grid-template-columns: 1fr;
      }
    }

    .chart-card {
      padding: 1.25rem;

      .chart-header {
        margin-bottom: 1rem;
        h4 {
          font-size: 1rem;
          font-weight: 600;
        }
      }

      .chart-body {
        position: relative;
        height: 260px;
        width: 100%;
      }
    }

    .activity-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;

      @media (max-width: 1023px) {
        grid-template-columns: 1fr;
      }
    }

    .activity-card {
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;

        h4 {
          font-size: 1rem;
          font-weight: 600;
        }
      }
    }

    .text-success { color: #10b981; }
    .text-warning { color: #f59e0b; }
    .text-danger { color: #ef4444; }
    .text-muted { color: #64748b; }
    .font-bold { font-weight: 600; }

    .empty-text {
      color: var(--color-text-subtle);
      font-size: 0.875rem;
      text-align: center;
      padding: 2rem 0;
    }
  `],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(InventoryApiService);
  layout = inject(LayoutService);

  stats = signal<DashboardStats | null>(null);

  @ViewChild('salesChartCanvas') salesChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChartCanvas') categoryChartCanvas!: ElementRef<HTMLCanvasElement>;

  private salesChartInstance: Chart | null = null;
  private categoryChartInstance: Chart | null = null;

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    // Canvas initialized; charts will render once stats data arrives
  }

  ngOnDestroy(): void {
    this.salesChartInstance?.destroy();
    this.categoryChartInstance?.destroy();
  }

  loadDashboard(): void {
    this.api.getDashboardStats().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.stats.set(res.data);
          this.renderCharts(res.data);
        }
      },
    });
  }

  private renderCharts(data: DashboardStats): void {
    if (!this.salesChartCanvas || !this.categoryChartCanvas) return;

    // 1. Sales Trend Line Chart
    this.salesChartInstance?.destroy();
    const salesLabels = data.dailySalesTrend.map((d) => d._id);
    const salesValues = data.dailySalesTrend.map((d) => d.totalSales);

    this.salesChartInstance = new Chart(this.salesChartCanvas.nativeElement, {
      type: 'line',
      data: {
        labels: salesLabels.length ? salesLabels : ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
        datasets: [
          {
            label: 'Sales Revenue (₹)',
            data: salesValues.length ? salesValues : [0, 0, 0, 0, 0, 0, data.todaySales?.amount || 0],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#2563eb',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });

    // 2. Category Distribution Doughnut Chart
    this.categoryChartInstance?.destroy();
    const catLabels = data.categoryDistribution.map((c) => c.categoryName);
    const catStock = data.categoryDistribution.map((c) => c.totalStock);

    this.categoryChartInstance = new Chart(this.categoryChartCanvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: catLabels.length ? catLabels : ['General'],
        datasets: [
          {
            data: catStock.length ? catStock : [1],
            backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
      },
    });
  }
}
