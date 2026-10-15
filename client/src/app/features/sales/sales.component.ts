import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { InventoryApiService, Product, Sale } from '../../core/services/inventory-api.service';
import { LayoutService } from '../../core/services/layout.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="sales-pos-page">
      <!-- HEADER -->
      <div class="page-header no-print">
        <div>
          <h1 class="page-title">Point of Sale (POS) &amp; Billing</h1>
          <p class="page-subtitle">Fast checkout, phone-camera scanning, real-time stock verification, and invoice printing</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="showSalesHistory.set(!showSalesHistory())">
            {{ showSalesHistory() ? '← Return to Terminal' : 'Past Invoices History' }}
          </button>
        </div>
      </div>

      @if (!showSalesHistory()) {
        <!-- POS TERMINAL VIEW (Desktop Two-Pane / Mobile Flow) -->
        <div class="pos-workspace no-print">
          <!-- LEFT PANE: PRODUCT SEARCH, BARCODE LOOKUP & CATALOG SELECTION -->
          <div class="pos-products-pane card">
            <div class="pos-search-header">
              <div class="barcode-quick-scan">
                <input
                  type="text"
                  class="form-control font-mono"
                  placeholder="Scan barcode or type SKU &amp; press Enter..."
                  [(ngModel)]="scanInput"
                  (keyup.enter)="onScanLookup()"
                />
                <a routerLink="/scanner" class="btn btn-secondary btn-sm" title="Scan with Phone Camera">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  </svg>
                  <span>Camera</span>
                </a>
              </div>

              <div class="filter-row">
                <input
                  type="text"
                  class="form-control"
                  placeholder="Filter catalog by product name..."
                  [(ngModel)]="catalogSearch"
                  (ngModelChange)="filterCatalog()"
                />
              </div>
            </div>

            <!-- PRODUCT QUICK PICK GRID -->
            <div class="pos-catalog-grid">
              @for (prod of filteredProducts(); track prod._id) {
                <div
                  class="catalog-item-card"
                  [class.out-of-stock]="prod.currentStock <= 0"
                  (click)="addToCart(prod)"
                >
                  <div class="item-top">
                    <span class="item-name">{{ prod.name }}</span>
                    <span class="font-mono item-price">₹{{ prod.sellingPrice.toFixed(2) }}</span>
                  </div>
                  <div class="item-bottom font-mono">
                    <span class="item-sku">{{ prod.sku }}</span>
                    <span
                      class="item-stock-tag"
                      [class.text-danger]="prod.currentStock <= 0"
                      [class.text-warning]="prod.currentStock > 0 && prod.currentStock <= prod.minStock"
                    >
                      {{ prod.currentStock }} in stock
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- RIGHT PANE: LIVE BILLING CART & CHECKOUT TOTALS -->
          <div class="pos-cart-pane card" [class.mobile-expanded]="mobileCartExpanded()">
            <div class="cart-header">
              <div class="cart-title-row">
                <h3>Current Sale Cart</h3>
                <span class="badge badge-info">{{ cart().length }} items</span>
              </div>
              @if (layout.isMobile()) {
                <button class="icon-btn" (click)="mobileCartExpanded.set(false)">&times;</button>
              }
            </div>

            <!-- CUSTOMER DETAILS -->
            <div class="customer-info-grid">
              <input
                type="text"
                class="form-control"
                placeholder="Customer Name (Walk-in)"
                [(ngModel)]="customerName"
              />
              <input
                type="tel"
                class="form-control"
                placeholder="Phone (optional)"
                [(ngModel)]="customerPhone"
              />
            </div>

            <!-- CART ITEMS LIST -->
            <div class="cart-items-container">
              @if (cart().length === 0) {
                <div class="empty-cart">
                  <div class="cart-icon">🛒</div>
                  <p>Cart is currently empty.</p>
                  <span>Scan barcode or tap products on the left to add items.</span>
                </div>
              } @else {
                @for (item of cart(); track item.product._id) {
                  <div class="cart-item-row">
                    <div class="cart-item-meta">
                      <span class="cart-item-name">{{ item.product.name }}</span>
                      <span class="cart-item-rate font-mono">₹{{ item.unitPrice.toFixed(2) }} each</span>
                    </div>

                    <div class="cart-qty-stepper">
                      <button class="step-btn" (click)="decreaseQty(item)">&minus;</button>
                      <span class="qty-val font-mono">{{ item.quantity }}</span>
                      <button
                        class="step-btn"
                        (click)="increaseQty(item)"
                        [disabled]="item.quantity >= item.product.currentStock"
                      >+</button>
                    </div>

                    <div class="cart-item-total font-mono">
                      ₹{{ item.lineTotal.toFixed(2) }}
                    </div>

                    <button class="icon-action-btn text-danger" (click)="removeFromCart(item)">&times;</button>
                  </div>
                }
              }
            </div>

            <!-- BILLING SUMMARY & SETTLEMENT -->
            <div class="cart-summary-section">
              <div class="summary-line">
                <span>Subtotal</span>
                <span class="font-mono">₹{{ subtotal().toFixed(2) }}</span>
              </div>

              <div class="summary-line">
                <span class="summary-label-input">
                  Discount (₹)
                  <input type="number" min="0" class="mini-input" [(ngModel)]="discount" (ngModelChange)="computeTotals()" />
                </span>
                <span class="font-mono text-danger">-₹{{ discount.toFixed(2) }}</span>
              </div>

              <div class="summary-line">
                <span class="summary-label-input">
                  Tax / GST (₹)
                  <input type="number" min="0" class="mini-input" [(ngModel)]="tax" (ngModelChange)="computeTotals()" />
                </span>
                <span class="font-mono">+₹{{ tax.toFixed(2) }}</span>
              </div>

              <div class="summary-total-row">
                <span>Grand Total</span>
                <span class="total-amount font-mono">₹{{ grandTotal().toFixed(2) }}</span>
              </div>

              <div class="payment-selector">
                <label class="form-label">Payment Mode</label>
                <div class="payment-options">
                  <button
                    type="button"
                    class="pay-pill"
                    [class.active]="paymentMethod === 'cash'"
                    (click)="paymentMethod = 'cash'"
                  >💵 Cash</button>
                  <button
                    type="button"
                    class="pay-pill"
                    [class.active]="paymentMethod === 'upi'"
                    (click)="paymentMethod = 'upi'"
                  >📱 UPI</button>
                  <button
                    type="button"
                    class="pay-pill"
                    [class.active]="paymentMethod === 'card'"
                    (click)="paymentMethod = 'card'"
                  >💳 Card</button>
                </div>
              </div>

              <button
                class="btn btn-success btn-block btn-lg complete-sale-btn"
                [disabled]="cart().length === 0 || isProcessingSale()"
                (click)="completeSale()"
              >
                {{ isProcessingSale() ? 'Processing...' : 'Complete & Generate Invoice' }}
              </button>
            </div>
          </div>
        </div>

        <!-- STICKY BOTTOM CART BAR FOR MOBILE ONLY -->
        @if (layout.isMobile()) {
          <div class="mobile-sticky-cart-bar no-print" (click)="mobileCartExpanded.set(true)">
            <div class="mobile-cart-preview">
              <span class="badge badge-info">{{ cart().length }} Items</span>
              <span class="preview-total font-mono">₹{{ grandTotal().toFixed(2) }}</span>
            </div>
            <button class="btn btn-primary btn-sm">
              Checkout &rarr;
            </button>
          </div>
        }
      } @else {
        <!-- HISTORICAL INVOICES TABLE -->
        <div class="card no-print">
          <div class="history-header">
            <h3>Completed Sales Invoices</h3>
            <input
              type="text"
              class="form-control"
              style="max-width: 300px;"
              placeholder="Search by invoice number or customer..."
              [(ngModel)]="historySearch"
              (ngModelChange)="loadSalesHistory()"
            />
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date &amp; Time</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Grand Total</th>
                  <th>Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                @for (sale of salesHistory(); track sale._id) {
                  <tr>
                    <td class="font-mono font-bold">{{ sale.invoiceNumber }}</td>
                    <td>{{ sale.saleDate | date:'medium' }}</td>
                    <td>{{ sale.customerName }}</td>
                    <td>{{ sale.items.length }} items</td>
                    <td class="font-mono font-bold text-success">₹{{ sale.grandTotal.toFixed(2) }}</td>
                    <td><span class="badge badge-info">{{ sale.paymentMethod | uppercase }}</span></td>
                    <td>
                      <button class="btn btn-secondary btn-sm" (click)="viewInvoice(sale)">View Invoice</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- PRINT-FRIENDLY INVOICE DIALOG / PRINT RECEIPT -->
      @if (activeInvoice()) {
        <div class="modal-backdrop no-print" (click)="activeInvoice.set(null)">
          <div class="modal-dialog card invoice-print-container" (click)="$event.stopPropagation()">
            <div class="modal-header no-print">
              <h3>Invoice Receipt</h3>
              <div class="modal-actions">
                <button class="btn btn-primary btn-sm" (click)="printInvoice()">🖨️ Print Receipt</button>
                <button class="icon-btn" (click)="activeInvoice.set(null)">&times;</button>
              </div>
            </div>

            <!-- INVOICE SHEET (Printed directly via window.print) -->
            <div class="invoice-sheet" id="printable-invoice">
              <div class="invoice-top">
                <div class="store-info">
                  <h2>MCA INVENTORY SYSTEM</h2>
                  <p>123 College Campus Boulevard, Tech Block</p>
                  <p>GSTIN: 07AAAAA0000A1Z5 &bull; Phone: +91 98765 43210</p>
                </div>
                <div class="invoice-meta-tag">
                  <h3>TAX INVOICE</h3>
                  <span class="font-mono invoice-num">{{ activeInvoice()?.invoiceNumber }}</span>
                  <span class="invoice-date">{{ activeInvoice()?.saleDate | date:'medium' }}</span>
                </div>
              </div>

              <div class="customer-bill-to">
                <strong>Billed To:</strong>
                <span>{{ activeInvoice()?.customerName }}</span>
                @if (activeInvoice()?.customerPhone) {
                  <span>Phone: {{ activeInvoice()?.customerPhone }}</span>
                }
              </div>

              <table class="invoice-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of activeInvoice()?.items; track item.sku) {
                    <tr>
                      <td>{{ item.productName }}</td>
                      <td class="font-mono">{{ item.sku }}</td>
                      <td class="font-mono" style="text-align: right;">₹{{ item.unitPrice.toFixed(2) }}</td>
                      <td class="font-mono" style="text-align: center;">{{ item.quantity }}</td>
                      <td class="font-mono" style="text-align: right;">₹{{ item.lineTotal.toFixed(2) }}</td>
                    </tr>
                  }
                </tbody>
              </table>

              <div class="invoice-summary-block">
                <div class="inv-sum-row">
                  <span>Subtotal:</span>
                  <span class="font-mono">₹{{ activeInvoice()?.subtotal?.toFixed(2) }}</span>
                </div>
                @if (activeInvoice()?.discount) {
                  <div class="inv-sum-row">
                    <span>Discount:</span>
                    <span class="font-mono">-₹{{ activeInvoice()?.discount?.toFixed(2) }}</span>
                  </div>
                }
                @if (activeInvoice()?.tax) {
                  <div class="inv-sum-row">
                    <span>Tax (GST):</span>
                    <span class="font-mono">+₹{{ activeInvoice()?.tax?.toFixed(2) }}</span>
                  </div>
                }
                <div class="inv-sum-row grand font-mono">
                  <span>Grand Total:</span>
                  <span>₹{{ activeInvoice()?.grandTotal?.toFixed(2) }}</span>
                </div>
              </div>

              <div class="invoice-footer-message">
                <p>Thank you for shopping with us!</p>
                <p class="terms">Goods once sold can only be exchanged within 7 days with valid receipt.</p>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .sales-pos-page {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;

      .page-title { font-size: var(--font-size-xl); font-weight: 800; }
      .page-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }
    }

    .pos-workspace {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 1.25rem;
      align-items: flex-start;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    /* PRODUCTS PANE */
    .pos-products-pane {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .barcode-quick-scan {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .pos-catalog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
      max-height: 520px;
      overflow-y: auto;
      padding-right: 0.25rem;
    }

    .catalog-item-card {
      background: #f8fafc;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.75rem;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.5rem;
      transition: all 0.15s ease;

      &:hover:not(.out-of-stock) {
        border-color: var(--color-primary);
        box-shadow: var(--shadow-sm);
        background: #ffffff;
      }

      &.out-of-stock {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .item-top {
        display: flex;
        flex-direction: column;

        .item-name {
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--color-text-main);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .item-price {
          font-weight: 700;
          color: var(--color-primary);
          margin-top: 0.25rem;
        }
      }

      .item-bottom {
        display: flex;
        justify-content: space-between;
        font-size: 0.7rem;
        color: var(--color-text-subtle);
      }
    }

    /* CART PANE */
    .pos-cart-pane {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      position: sticky;
      top: calc(var(--topbar-height) + 1rem);

      @media (max-width: 900px) {
        display: none;

        &.mobile-expanded {
          display: flex;
          position: fixed;
          inset: 0;
          z-index: 200;
          border-radius: 0;
          overflow-y: auto;
        }
      }
    }

    .cart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--color-border);

      .cart-title-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        h3 { font-size: 1.15rem; font-weight: 700; }
      }
    }

    .customer-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .cart-items-container {
      min-height: 180px;
      max-height: 280px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .empty-cart {
      text-align: center;
      padding: 2.5rem 1rem;
      color: var(--color-text-muted);

      .cart-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
      span { font-size: 0.75rem; color: var(--color-text-subtle); }
    }

    .cart-item-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem;
      background: #f8fafc;
      border-radius: var(--radius-sm);

      .cart-item-meta {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;

        .cart-item-name {
          font-size: 0.8rem;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cart-item-rate {
          font-size: 0.7rem;
          color: var(--color-text-muted);
        }
      }

      .cart-qty-stepper {
        display: flex;
        align-items: center;
        gap: 0.25rem;

        .step-btn {
          width: 26px;
          height: 26px;
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .qty-val {
          font-size: 0.85rem;
          font-weight: 600;
          width: 24px;
          text-align: center;
        }
      }

      .cart-item-total {
        font-size: 0.85rem;
        font-weight: 700;
        min-width: 60px;
        text-align: right;
      }
    }

    .cart-summary-section {
      border-top: 1px solid var(--color-border);
      padding-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .summary-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;

      .summary-label-input {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .mini-input {
        width: 65px;
        padding: 0.2rem 0.4rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        font-size: 0.8rem;
      }
    }

    .summary-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.5rem;
      border-top: 1px dashed var(--color-border);
      font-size: 1.1rem;
      font-weight: 700;

      .total-amount {
        font-size: 1.4rem;
        color: var(--color-primary);
      }
    }

    .payment-options {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.25rem;

      .pay-pill {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: 0.8rem;
        font-weight: 600;

        &.active {
          border-color: var(--color-primary);
          background-color: var(--color-primary-light);
          color: var(--color-primary);
        }
      }
    }

    .complete-sale-btn {
      font-size: 1.1rem;
      font-weight: 700;
      padding: 0.85rem;
    }

    /* MOBILE STICKY BAR */
    .mobile-sticky-cart-bar {
      position: fixed;
      bottom: calc(var(--bottomnav-height) + var(--safe-bottom) + 0.5rem);
      left: 1rem;
      right: 1rem;
      background: #0f172a;
      color: #ffffff;
      border-radius: var(--radius-xl);
      padding: 0.75rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: var(--shadow-float);
      z-index: 85;
      cursor: pointer;

      .mobile-cart-preview {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        .preview-total {
          font-size: 1.1rem;
          font-weight: 700;
        }
      }
    }

    /* INVOICE SHEET FOR SCREEN AND PRINT */
    .invoice-sheet {
      background: #ffffff;
      padding: 1.5rem;
      color: #000000;
      font-size: 0.85rem;

      .invoice-top {
        display: flex;
        justify-content: space-between;
        border-bottom: 2px solid #000;
        padding-bottom: 1rem;
        margin-bottom: 1rem;

        h2 { font-size: 1.25rem; font-weight: 800; }
        .invoice-num { display: block; font-weight: 700; font-size: 1.1rem; }
      }

      .customer-bill-to {
        display: flex;
        flex-direction: column;
        margin-bottom: 1rem;
      }

      .invoice-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1rem;

        th, td {
          padding: 0.5rem 0.25rem;
          border-bottom: 1px solid #ddd;
        }

        th {
          border-bottom: 2px solid #000;
          text-transform: uppercase;
          font-size: 0.75rem;
        }
      }

      .invoice-summary-block {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.25rem;
        margin-bottom: 1.5rem;

        .inv-sum-row {
          display: flex;
          gap: 1.5rem;
          &.grand {
            font-size: 1.15rem;
            font-weight: 800;
            border-top: 2px solid #000;
            padding-top: 0.25rem;
          }
        }
      }

      .invoice-footer-message {
        text-align: center;
        border-top: 1px dashed #aaa;
        padding-top: 0.75rem;
        font-size: 0.75rem;
      }
    }
  `],
})
export class SalesComponent implements OnInit {
  private api = inject(InventoryApiService);
  layout = inject(LayoutService);
  private toastService = inject(ToastService);
  private route = inject(ActivatedRoute);

  products = signal<Product[]>([]);
  filteredProducts = signal<Product[]>([]);
  cart = signal<CartItem[]>([]);

  // Totals
  subtotal = signal<number>(0);
  discount = 0;
  tax = 0;
  grandTotal = signal<number>(0);

  // Customer & Payment
  customerName = '';
  customerPhone = '';
  paymentMethod: 'cash' | 'card' | 'upi' | 'other' = 'cash';

  scanInput = '';
  catalogSearch = '';
  mobileCartExpanded = signal<boolean>(false);
  isProcessingSale = signal<boolean>(false);

  // Invoices & History
  showSalesHistory = signal<boolean>(false);
  salesHistory = signal<Sale[]>([]);
  historySearch = '';
  activeInvoice = signal<Sale | null>(null);

  ngOnInit(): void {
    this.loadCatalog();

    // Check if query params pre-selects product from scanner
    this.route.queryParams.subscribe((params) => {
      if (params['addProductId']) {
        this.api.getProductById(params['addProductId']).subscribe({
          next: (res) => {
            if (res.success && res.data) {
              this.addToCart(res.data);
            }
          },
        });
      }
    });
  }

  loadCatalog(): void {
    this.api.getProducts({ limit: 100, status: 'active' }).subscribe({
      next: (res) => {
        if (res.success) {
          this.products.set(res.data);
          this.filteredProducts.set(res.data);
        }
      },
    });
  }

  filterCatalog(): void {
    const q = this.catalogSearch.trim().toLowerCase();
    if (!q) {
      this.filteredProducts.set(this.products());
      return;
    }
    this.filteredProducts.set(
      this.products().filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
      )
    );
  }

  onScanLookup(): void {
    const code = this.scanInput.trim();
    if (!code) return;

    this.api.lookupBarcode(code).subscribe({
      next: (res) => {
        if (res.data.found && res.data.product) {
          this.addToCart(res.data.product);
          this.toastService.success(`Added ${res.data.product.name} to cart`);
          this.scanInput = '';
        } else {
          this.toastService.error(`No product found for code '${code}'`);
        }
      },
    });
  }

  addToCart(product: Product): void {
    if (product.currentStock <= 0) {
      this.toastService.error(`'${product.name}' is out of stock!`);
      return;
    }

    const currentCart = [...this.cart()];
    const index = currentCart.findIndex((i) => i.product._id === product._id);

    if (index > -1) {
      if (currentCart[index].quantity >= product.currentStock) {
        this.toastService.error(`Cannot exceed current available stock (${product.currentStock})`);
        return;
      }
      currentCart[index].quantity += 1;
      currentCart[index].lineTotal = Number(
        (currentCart[index].quantity * currentCart[index].unitPrice).toFixed(2)
      );
    } else {
      currentCart.push({
        product,
        quantity: 1,
        unitPrice: product.sellingPrice,
        lineTotal: product.sellingPrice,
      });
    }

    this.cart.set(currentCart);
    this.computeTotals();
  }

  increaseQty(item: CartItem): void {
    if (item.quantity >= item.product.currentStock) {
      this.toastService.error(`Cannot add more. Max stock available: ${item.product.currentStock}`);
      return;
    }
    item.quantity += 1;
    item.lineTotal = Number((item.quantity * item.unitPrice).toFixed(2));
    this.cart.set([...this.cart()]);
    this.computeTotals();
  }

  decreaseQty(item: CartItem): void {
    if (item.quantity <= 1) {
      this.removeFromCart(item);
      return;
    }
    item.quantity -= 1;
    item.lineTotal = Number((item.quantity * item.unitPrice).toFixed(2));
    this.cart.set([...this.cart()]);
    this.computeTotals();
  }

  removeFromCart(item: CartItem): void {
    this.cart.set(this.cart().filter((i) => i.product._id !== item.product._id));
    this.computeTotals();
  }

  computeTotals(): void {
    const rawSubtotal = this.cart().reduce((sum, item) => sum + item.lineTotal, 0);
    this.subtotal.set(Number(rawSubtotal.toFixed(2)));

    const grand = Math.max(0, rawSubtotal - (this.discount || 0) + (this.tax || 0));
    this.grandTotal.set(Number(grand.toFixed(2)));
  }

  completeSale(): void {
    if (this.cart().length === 0) return;

    this.isProcessingSale.set(true);

    const payload = {
      customerName: this.customerName.trim() || 'Walk-in Customer',
      customerPhone: this.customerPhone.trim() || undefined,
      items: this.cart().map((item) => ({
        product: item.product._id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      discount: this.discount,
      tax: this.tax,
      paymentMethod: this.paymentMethod,
    };

    this.api.createSale(payload).subscribe({
      next: (res) => {
        this.isProcessingSale.set(false);
        this.toastService.success('Sale processed successfully! Invoice created.');

        // Show printable invoice
        this.activeInvoice.set(res.data);

        // Reset cart and reload catalog with updated inventory stocks
        this.cart.set([]);
        this.discount = 0;
        this.tax = 0;
        this.customerName = '';
        this.customerPhone = '';
        this.computeTotals();
        this.mobileCartExpanded.set(false);
        this.loadCatalog();
      },
      error: () => {
        this.isProcessingSale.set(false);
      },
    });
  }

  loadSalesHistory(): void {
    this.api.getSales(1, 20, this.historySearch).subscribe({
      next: (res) => {
        if (res.success) this.salesHistory.set(res.data);
      },
    });
  }

  viewInvoice(sale: Sale): void {
    this.activeInvoice.set(sale);
  }

  printInvoice(): void {
    window.print();
  }
}
