import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { InventoryApiService, Product, Sale } from '../../core/services/inventory-api.service';
import { LayoutService } from '../../core/services/layout.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { PdfService } from '../../core/services/pdf.service';

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
                <button
                  type="button"
                  class="btn btn-primary btn-sm camera-scan-btn"
                  (click)="openPosCameraScanner()"
                  title="Scan with Phone Camera directly into cart"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Camera Scanner</span>
                </button>
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
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                (click)="$event.stopPropagation(); openPosCameraScanner()"
                title="Scan Barcode"
              >
                📷 Scan
              </button>
              <button class="btn btn-primary btn-sm">
                Checkout &rarr;
              </button>
            </div>
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
                      <div style="display: flex; gap: 0.35rem;">
                        <button class="btn btn-secondary btn-sm" (click)="viewInvoice(sale)">View</button>
                        <button class="btn btn-primary btn-sm" (click)="downloadPdf(sale)" title="Download PDF">PDF</button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- INLINE MOBILE POS CAMERA SCANNER MODAL -->
      @if (showCameraScanner()) {
        <div class="pos-scanner-modal-backdrop" (click)="closePosCameraScanner()">
          <div class="pos-scanner-modal-content card" (click)="$event.stopPropagation()">
            <div class="pos-scanner-header">
              <div class="scanner-title-badge">
                <span class="badge badge-success">📷 Live Camera Scanner</span>
                <span>Scan directly into cart</span>
              </div>
              <button class="icon-btn" (click)="closePosCameraScanner()">&times;</button>
            </div>

            <div class="pos-scanner-viewport">
              <video #posVideoElement class="pos-camera-video" playsinline webkit-playsinline muted autoplay></video>

              <!-- RETICLE -->
              <div class="pos-reticle">
                <div class="reticle-corner top-left"></div>
                <div class="reticle-corner top-right"></div>
                <div class="reticle-corner bottom-left"></div>
                <div class="reticle-corner bottom-right"></div>
                <div class="pos-laser-line"></div>
              </div>

              @if (scannerFlashMsg()) {
                <div class="scanner-flash-toast">
                  {{ scannerFlashMsg() }}
                </div>
              }
            </div>

            <!-- SCANNER CONTROLS & CART SUMMARY BAR -->
            <div class="pos-scanner-footer">
              <div class="scanner-stats-row">
                <span class="font-mono font-bold">Cart Items: {{ cart().length }}</span>
                <span class="font-mono font-bold text-primary">Total: ₹{{ grandTotal().toFixed(2) }}</span>
              </div>

              <div class="scanner-btn-row">
                @if (supportsTorch()) {
                  <button type="button" class="btn btn-secondary btn-sm" (click)="toggleTorch()">
                    {{ isTorchOn() ? '🔦 Torch Off' : '💡 Torch On' }}
                  </button>
                }
                <button type="button" class="btn btn-primary btn-sm" (click)="closePosCameraScanner()">
                  Done Scanning ({{ cart().length }})
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- PRINT-FRIENDLY & PDF-DOWNLOADABLE INVOICE MODAL -->
      @if (activeInvoice()) {
        <div class="invoice-modal-backdrop" (click)="activeInvoice.set(null)">
          <div class="invoice-modal-dialog card invoice-print-container" (click)="$event.stopPropagation()">
            <div class="invoice-modal-actions-bar no-print">
              <div class="actions-left">
                <span class="badge badge-success">✓ Invoice Generated</span>
              </div>
              <div class="actions-right">
                <button class="btn btn-primary btn-sm" (click)="downloadPdf(activeInvoice()!)" title="Download PDF document directly">
                  📥 Download PDF
                </button>
                <button class="btn btn-secondary btn-sm" (click)="printInvoice()" title="Print receipt on printer">
                  🖨️ Print
                </button>
                @if (canShare()) {
                  <button class="btn btn-secondary btn-sm" (click)="shareInvoice(activeInvoice()!)" title="Share via WhatsApp or mobile apps">
                    📱 Share
                  </button>
                }
                <button class="icon-btn" (click)="activeInvoice.set(null)">&times;</button>
              </div>
            </div>

            <!-- INVOICE SHEET (Pure printable content) -->
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

      .camera-scan-btn {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }
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

    /* INLINE POS SCANNER MODAL */
    .pos-scanner-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(4px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .pos-scanner-modal-content {
      width: 100%;
      max-width: 500px;
      background: #0f172a;
      color: #ffffff;
      border-radius: var(--radius-xl);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    .pos-scanner-header {
      padding: 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);

      .scanner-title-badge {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
      }
    }

    .pos-scanner-viewport {
      position: relative;
      width: 100%;
      height: 320px;
      background: #000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;

      @media (max-width: 480px) {
        height: 280px;
      }
    }

    .pos-camera-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .pos-reticle {
      position: absolute;
      width: 220px;
      height: 140px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
      border-radius: 8px;
      pointer-events: none;

      .reticle-corner {
        position: absolute;
        width: 18px;
        height: 18px;
        border-color: #38bdf8;
        border-style: solid;

        &.top-left { top: -2px; left: -2px; border-width: 3px 0 0 3px; border-top-left-radius: 6px; }
        &.top-right { top: -2px; right: -2px; border-width: 3px 3px 0 0; border-top-right-radius: 6px; }
        &.bottom-left { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; border-bottom-left-radius: 6px; }
        &.bottom-right { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; border-bottom-right-radius: 6px; }
      }

      .pos-laser-line {
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #22c55e, #86efac, transparent);
        box-shadow: 0 0 8px #22c55e;
        animation: scanPosSweep 1.6s ease-in-out infinite alternate;
      }
    }

    @keyframes scanPosSweep {
      0% { top: 5%; }
      100% { top: 95%; }
    }

    .scanner-flash-toast {
      position: absolute;
      bottom: 1rem;
      left: 1rem;
      right: 1rem;
      background: #10b981;
      color: #ffffff;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-full);
      font-size: 0.8rem;
      font-weight: 600;
      text-align: center;
      animation: fadeIn 0.15s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .pos-scanner-footer {
      padding: 1rem;
      background: #0f172a;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      .scanner-stats-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
      }

      .scanner-btn-row {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    }

    /* INVOICE MODAL (NO no-print class on container to fix print bug!) */
    .invoice-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .invoice-modal-dialog {
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      overflow-y: auto;
      background: #ffffff;
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-float);
    }

    .invoice-modal-actions-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--color-border);
      background: #f8fafc;

      .actions-right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    }

    /* INVOICE SHEET */
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
export class SalesComponent implements OnInit, OnDestroy {
  private api = inject(InventoryApiService);
  layout = inject(LayoutService);
  private toastService = inject(ToastService);
  private pdfService = inject(PdfService);
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

  // INLINE MOBILE CAMERA SCANNER IN POS
  showCameraScanner = signal<boolean>(false);
  scannerFlashMsg = signal<string | null>(null);
  supportsTorch = signal<boolean>(false);
  isTorchOn = signal<boolean>(false);

  @ViewChild('posVideoElement') posVideoRef?: ElementRef<HTMLVideoElement>;
  private posCodeReader: BrowserMultiFormatReader | null = null;
  private posScannerControls: IScannerControls | null = null;
  private lastScanTimestamp = 0;
  private lastScannedCode = '';

  canShare = signal<boolean>(typeof navigator !== 'undefined' && !!navigator.share);

  ngOnInit(): void {
    this.loadCatalog();

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

  ngOnDestroy(): void {
    this.stopPosCamera();
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

  // --- INLINE POS CAMERA SCANNER IMPLEMENTATION ---
  openPosCameraScanner(): void {
    this.showCameraScanner.set(true);
    // Allow DOM to render video element before initializing stream
    setTimeout(() => {
      this.startPosCamera();
    }, 150);
  }

  async startPosCamera(): Promise<void> {
    if (!this.posVideoRef?.nativeElement) return;
    try {
      this.posCodeReader = new BrowserMultiFormatReader();

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      try {
        this.posScannerControls = await this.posCodeReader.decodeFromConstraints(
          constraints,
          this.posVideoRef.nativeElement,
          (result) => {
            if (result) {
              this.handlePosBarcodeDetected(result.getText());
            }
          }
        );
      } catch (constraintErr) {
        // Fallback for devices that reject specific resolution constraints
        this.posScannerControls = await this.posCodeReader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          this.posVideoRef.nativeElement,
          (result) => {
            if (result) {
              this.handlePosBarcodeDetected(result.getText());
            }
          }
        );
      }

      this.checkTorchCapability();
    } catch (err: any) {
      this.toastService.error('Camera could not be activated: ' + (err.message || 'Permission denied'));
      this.showCameraScanner.set(false);
    }
  }

  private checkTorchCapability(): void {
    try {
      if (this.posVideoRef?.nativeElement?.srcObject) {
        const stream = this.posVideoRef.nativeElement.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        const cap = (track as any).getCapabilities?.();
        if (cap && 'torch' in cap) {
          this.supportsTorch.set(true);
        }
      }
    } catch {
      this.supportsTorch.set(false);
    }
  }

  async toggleTorch(): Promise<void> {
    try {
      if (this.posVideoRef?.nativeElement?.srcObject) {
        const stream = this.posVideoRef.nativeElement.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        const nextState = !this.isTorchOn();
        await (track as any).applyConstraints({ advanced: [{ torch: nextState }] });
        this.isTorchOn.set(nextState);
      }
    } catch {
      this.toastService.error('Torch toggle not supported on this device');
    }
  }

  handlePosBarcodeDetected(code: string): void {
    const now = Date.now();
    // 1.5s cooldown suppression for identical code
    if (now - this.lastScanTimestamp < 1500 && this.lastScannedCode === code) {
      return;
    }
    this.lastScanTimestamp = now;
    this.lastScannedCode = code;

    // Trigger audio beep & vibration
    this.playFeedbackAudio();

    // Fast lookup and add to cart
    this.api.lookupBarcode(code).subscribe({
      next: (res) => {
        if (res.data.found && res.data.product) {
          this.addToCart(res.data.product);
          this.scannerFlashMsg.set(`✓ Added: ${res.data.product.name}`);
          setTimeout(() => {
            this.scannerFlashMsg.set(null);
          }, 1800);
        } else {
          this.scannerFlashMsg.set(`⚠️ Barcode '${code}' not found in catalog`);
          setTimeout(() => {
            this.scannerFlashMsg.set(null);
          }, 2000);
        }
      },
    });
  }

  closePosCameraScanner(): void {
    this.stopPosCamera();
    this.showCameraScanner.set(false);
  }

  stopPosCamera(): void {
    if (this.posScannerControls) {
      this.posScannerControls.stop();
      this.posScannerControls = null;
    }
    if (this.posVideoRef?.nativeElement?.srcObject) {
      const stream = this.posVideoRef.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      this.posVideoRef.nativeElement.srcObject = null;
    }
    this.isTorchOn.set(false);
  }

  private playFeedbackAudio(): void {
    if (navigator.vibrate) navigator.vibrate(100);
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      // Audio autoplay policy
    }
  }

  // --- CART MANAGEMENT ---
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

  // --- PDF DOWNLOAD & PRINT ---
  downloadPdf(sale: Sale): void {
    try {
      this.pdfService.generateInvoicePdf(sale);
      this.toastService.success(`Downloaded Invoice_${sale.invoiceNumber}.pdf`);
    } catch (err: any) {
      this.toastService.error('Failed to generate PDF: ' + err.message);
    }
  }

  printInvoice(): void {
    window.print();
  }

  shareInvoice(sale: Sale): void {
    if (navigator.share) {
      navigator.share({
        title: `Invoice ${sale.invoiceNumber}`,
        text: `Tax Invoice from Inventory ERP\nInvoice No: ${sale.invoiceNumber}\nAmount: ₹${sale.grandTotal.toFixed(2)}\nCustomer: ${sale.customerName}\nDate: ${new Date(sale.saleDate).toLocaleDateString()}`,
      }).catch(() => {});
    } else {
      // WhatsApp fallback link
      const text = encodeURIComponent(
        `Invoice: ${sale.invoiceNumber}\nTotal: ₹${sale.grandTotal.toFixed(2)}\nThank you for your purchase!`
      );
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  }
}
