import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { InventoryApiService, Purchase, Supplier, Product } from '../../core/services/inventory-api.service';
import {
  BarcodeScannerService,
  ScannerSession,
} from '../../core/services/barcode-scanner.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { PdfService } from '../../core/services/pdf.service';

interface PurchaseLineItem {
  product: Product;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

interface ReceivingItemRow {
  product: any;
  productName: string;
  sku: string;
  barcode?: string;
  ordered: number;
  previouslyReceived: number;
  pending: number;
  deliverNow: number;
  notes: string;
}

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="purchases-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Procurement &amp; Purchases</h1>
          <p class="page-subtitle">Manage purchase orders, supplier stock receipts, and cost tracking</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="isCreating.set(!isCreating())">
            {{ isCreating() ? '← View Purchase Orders' : '+ New Purchase Order' }}
          </button>
        </div>
      </div>

      @if (isCreating()) {
        <!-- NEW PURCHASE ORDER FORM (Two-Pane) -->
        <div class="purchase-create-grid">
          <div class="card purchase-left-pane">
            <h3>Purchase Line Items</h3>

            <div class="supplier-selector-row">
              <label class="form-label">Select Supplier *</label>
              <select class="form-control" [(ngModel)]="selectedSupplierId">
                <option value="">Choose Supplier</option>
                @for (sup of suppliers(); track sup._id) {
                  <option [value]="sup._id">{{ sup.name }}</option>
                }
              </select>
            </div>

            <!-- PRODUCT SELECTOR -->
            <div class="add-item-box">
              <div class="product-drop">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <label class="form-label" style="margin: 0;">Add Product</label>
                  <button type="button" class="btn btn-secondary btn-sm" (click)="openPoScanner()" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">
                    📷 Scan Barcode
                  </button>
                </div>
                <select class="form-control" [(ngModel)]="selectedProductId" (change)="onProductSelect()">
                  <option value="">Select a product to add</option>
                  @for (prod of products(); track prod._id) {
                    <option [value]="prod._id">{{ prod.name }} (Current: {{ prod.currentStock }} {{ prod.uom }})</option>
                  }
                </select>
              </div>

              <div class="item-inputs-row">
                <div>
                  <label class="form-label">Quantity</label>
                  <input type="number" min="1" class="form-control" [(ngModel)]="itemQty" />
                </div>
                <div>
                  <label class="form-label">Unit Cost (₹)</label>
                  <input type="number" step="0.01" class="form-control" [(ngModel)]="itemCost" />
                </div>
                <div class="add-btn-col">
                  <button class="btn btn-primary btn-block" (click)="addLineItem()" [disabled]="!selectedProductId || itemQty < 1">
                    Add Item
                  </button>
                </div>
              </div>
            </div>

            <!-- LINE ITEMS TABLE -->
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Unit Cost</th>
                    <th>Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of lineItems(); track item.product._id; let idx = $index) {
                    <tr>
                      <td class="font-bold">{{ item.product.name }}</td>
                      <td class="font-mono text-muted">{{ item.product.sku }}</td>
                      <td class="font-bold">{{ item.quantity }}</td>
                      <td class="font-mono">₹{{ item.unitCost.toFixed(2) }}</td>
                      <td class="font-mono font-bold">₹{{ item.totalCost.toFixed(2) }}</td>
                      <td>
                        <button class="icon-action-btn text-danger" (click)="removeLineItem(idx)">&times;</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- SUMMARY & ACTIONS PANE -->
          <div class="card purchase-right-pane">
            <h3>Order Summary</h3>

            <div class="summary-line">
              <span>Items Count:</span>
              <span class="font-bold">{{ lineItems().length }}</span>
            </div>
            <div class="summary-line">
              <span>Subtotal:</span>
              <span class="font-mono">₹{{ subtotal().toFixed(2) }}</span>
            </div>
            <div class="summary-line">
              <span>Tax / Freight (₹):</span>
              <input type="number" min="0" class="mini-input" [(ngModel)]="tax" (ngModelChange)="computeTotals()" />
            </div>

            <div class="summary-total font-mono">
              <span>Total Cost:</span>
              <span>₹{{ total().toFixed(2) }}</span>
            </div>

            <div class="form-group" style="margin-top: 1rem;">
              <label class="form-label">Order Notes</label>
              <textarea class="form-control" [(ngModel)]="notes" rows="2" placeholder="Optional PO notes..."></textarea>
            </div>

            <div class="action-buttons-stack">
              <button
                class="btn btn-primary btn-block"
                [disabled]="!selectedSupplierId || lineItems().length === 0 || isSaving()"
                (click)="submitPurchase('ordered')"
              >
                Save as Purchase Order (Ordered)
              </button>

              <button
                class="btn btn-secondary btn-block"
                [disabled]="!selectedSupplierId || lineItems().length === 0 || isSaving()"
                (click)="submitPurchase('draft')"
              >
                Save as Draft PO
              </button>

              <button
                class="btn btn-success btn-block"
                [disabled]="!selectedSupplierId || lineItems().length === 0 || isSaving()"
                (click)="submitPurchase('received')"
              >
                Save &amp; Receive into Inventory Immediately
              </button>
            </div>
          </div>
        </div>
      } @else {
        <!-- PURCHASE ORDERS LIST VIEW -->
        <div class="card no-print">
          <!-- SEARCH & STATUS FILTERS HEADER -->
          <div class="purchases-toolbar">
            <div class="status-tabs-row">
              <button
                type="button"
                class="status-tab"
                [class.active]="statusFilter() === 'all'"
                (click)="filterByStatus('all')"
              >
                All ({{ purchases().length }})
              </button>
              <button
                type="button"
                class="status-tab"
                [class.active]="statusFilter() === 'ordered'"
                (click)="filterByStatus('ordered')"
              >
                Ordered
              </button>
              <button
                type="button"
                class="status-tab"
                [class.active]="statusFilter() === 'partially_received'"
                (click)="filterByStatus('partially_received')"
              >
                Partially Received
              </button>
              <button
                type="button"
                class="status-tab"
                [class.active]="statusFilter() === 'received'"
                (click)="filterByStatus('received')"
              >
                Received
              </button>
              <button
                type="button"
                class="status-tab"
                [class.active]="statusFilter() === 'draft'"
                (click)="filterByStatus('draft')"
              >
                Draft
              </button>
            </div>

            <div class="search-actions-row">
              <input
                type="text"
                class="form-control"
                style="min-width: 220px; max-width: 320px;"
                placeholder="Search PO # or supplier..."
                [(ngModel)]="searchQuery"
                (ngModelChange)="onSearchChange()"
              />
              <button type="button" class="btn btn-secondary btn-sm" (click)="loadPurchases()" title="Refresh purchases list">
                🔄 Refresh
              </button>
            </div>
          </div>

          <!-- PO DATA TABLE -->
          @if (purchases().length === 0) {
            <div style="text-align: center; padding: 3.5rem 1rem; color: var(--color-text-muted);">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📦</div>
              <h4 style="margin: 0 0 0.35rem 0; font-weight: 700; color: var(--color-text-main);">No Purchase Orders Found</h4>
              <p style="margin: 0; font-size: 0.85rem;">
                {{ searchQuery ? 'No purchase records match "' + searchQuery + '". Try a different search term.' : 'No purchase orders recorded yet under this filter.' }}
              </p>
            </div>
          } @else {
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    <th>Total Cost</th>
                    <th>Status</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  @for (po of purchases(); track po._id) {
                    <tr>
                      <td class="font-mono font-bold">{{ po.purchaseNumber }}</td>
                      <td>{{ po.purchaseDate | date:'mediumDate' }}</td>
                      <td>
                        <div class="font-bold">{{ po.supplier?.name || 'Supplier' }}</div>
                        @if (po.supplier?.phone) {
                          <span style="font-size: 0.75rem; color: var(--color-text-muted);" class="font-mono">{{ po.supplier.phone }}</span>
                        }
                      </td>
                      <td>{{ po.items.length }} line items</td>
                      <td class="font-mono font-bold">₹{{ po.total.toFixed(2) }}</td>
                      <td>
                        <span
                          class="badge"
                          [class.badge-success]="po.status === 'received'"
                          [class.badge-warning]="po.status === 'partially_received'"
                          [class.badge-info]="po.status === 'ordered'"
                          [class.badge-secondary]="po.status === 'draft'"
                          [class.badge-danger]="po.status === 'cancelled'"
                        >
                          {{ po.status === 'partially_received' ? 'PARTIALLY RECEIVED' : (po.status | uppercase) }}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 0.35rem; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
                          <button class="btn btn-secondary btn-sm" (click)="openViewPoModal(po)" title="View PO & Receipt History">
                            View
                          </button>
                          <button class="btn btn-secondary btn-sm" (click)="downloadPoPdf(po)" title="Download PO / GRN Document">
                            📥 PDF
                          </button>
                          @if (po.status !== 'received' && po.status !== 'cancelled') {
                            <button class="btn btn-success btn-sm" (click)="openReceiveModal(po)" title="Receive Deliveries / Shipments">
                              📦 Receive
                            </button>
                          } @else if (po.status === 'received') {
                            <span class="badge badge-success" style="font-size: 0.75rem;">✓ Complete</span>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }

      <!-- PARTIAL RECEIVING MODAL -->
      @if (receivingPo()) {
        <div class="modal-backdrop" (click)="receivingPo.set(null)">
          <div class="modal-dialog receiving-modal-dialog card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800;">📦 Receive Goods — {{ receivingPo()?.purchaseNumber }}</h3>
                <span style="font-size: 0.82rem; color: var(--color-text-muted);">
                  Supplier: <strong>{{ receivingPo()?.supplier?.name }}</strong> &bull; Record actual delivered quantities
                </span>
              </div>
              <button class="icon-btn" (click)="receivingPo.set(null)">&times;</button>
            </div>

            <!-- CONTROLS ROW -->
            <div class="receiving-controls-bar">
              <div class="left-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary btn-sm" (click)="receiveAllRemaining()">
                  ✓ Receive All Remaining
                </button>
                <button type="button" class="btn btn-secondary btn-sm" (click)="clearReceiptQuantities()">
                  ✕ Clear Quantities
                </button>
              </div>
              <div class="right-stats font-mono" style="font-size: 0.85rem;">
                Total Delivering Now: <strong style="color: var(--color-primary); font-size: 1rem;">{{ getTotalDeliveredNow() }} units</strong>
              </div>
            </div>

            <!-- RECEIVING ITEMS TABLE -->
            <div class="table-container receiving-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product &amp; SKU</th>
                    <th style="text-align: center;">Ordered</th>
                    <th style="text-align: center;">Prev. Recv</th>
                    <th style="text-align: center;">Pending</th>
                    <th style="text-align: center; min-width: 120px;">Deliver Now</th>
                    <th>Discrepancy / Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of receivingItems(); track item.sku) {
                    <tr [class.row-complete]="item.pending <= 0">
                      <td>
                        <div class="font-bold">{{ item.productName }}</div>
                        <span class="font-mono text-muted" style="font-size: 0.75rem;">{{ item.sku }}</span>
                      </td>
                      <td style="text-align: center;" class="font-mono font-bold">{{ item.ordered }}</td>
                      <td style="text-align: center;" class="font-mono text-muted">{{ item.previouslyReceived }}</td>
                      <td style="text-align: center;" class="font-mono">
                        <strong [class.text-warning]="item.pending > 0" [class.text-success]="item.pending <= 0">
                          {{ item.pending }}
                        </strong>
                      </td>
                      <td style="text-align: center;">
                        <input
                          type="number"
                          min="0"
                          [max]="item.pending"
                          class="form-control font-mono qty-deliver-input"
                          [(ngModel)]="item.deliverNow"
                          [disabled]="item.pending <= 0"
                          (ngModelChange)="validateItemQty(item)"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          class="form-control form-control-sm"
                          placeholder="e.g. 2 damaged, batch..."
                          [(ngModel)]="item.notes"
                          [disabled]="item.deliverNow <= 0"
                        />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- GENERAL SHIPMENT NOTES -->
            <div class="form-group" style="margin-top: 1rem;">
              <label class="form-label">Delivery Note / Challan Reference</label>
              <input
                type="text"
                class="form-control"
                placeholder="e.g. Challan #DC-8921, Driver Ashok, Vehicle MH-12-AB-1234"
                [(ngModel)]="receivingNotes"
              />
            </div>

            <!-- MODAL FOOTER -->
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--color-border); flex-wrap: wrap; gap: 0.75rem;">
              <span style="font-size: 0.8rem; color: var(--color-text-muted);">
                Stock increases strictly by delivered units. Remaining items stay pending.
              </span>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-secondary" (click)="receivingPo.set(null)" [disabled]="isSubmittingReceipt()">
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-success"
                  [disabled]="getTotalDeliveredNow() <= 0 || isSubmittingReceipt()"
                  (click)="submitReceipt()"
                >
                  {{ isSubmittingReceipt() ? 'Saving Receipt...' : 'Save Receipt (' + getTotalDeliveredNow() + ' units)' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- VIEW PURCHASE ORDER & RECEIPTS MODAL -->
      @if (selectedPoForView()) {
        <div class="modal-backdrop" (click)="selectedPoForView.set(null)">
          <div class="modal-dialog view-po-modal-dialog card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800;">Purchase Order Details</h3>
                <span
                  class="badge"
                  [class.badge-success]="selectedPoForView()?.status === 'received'"
                  [class.badge-warning]="selectedPoForView()?.status === 'partially_received'"
                  [class.badge-info]="selectedPoForView()?.status === 'ordered'"
                  [class.badge-secondary]="selectedPoForView()?.status === 'draft'"
                  [class.badge-danger]="selectedPoForView()?.status === 'cancelled'"
                >
                  {{ selectedPoForView()?.status === 'partially_received' ? 'PARTIALLY RECEIVED' : (selectedPoForView()?.status | uppercase) }}
                </span>
              </div>
              <button class="icon-btn" (click)="selectedPoForView.set(null)">&times;</button>
            </div>

            <!-- PO HEADER INFO -->
            <div class="view-po-meta-grid">
              <div class="meta-item">
                <span class="meta-label">PO Number:</span>
                <span class="meta-val font-mono font-bold">{{ selectedPoForView()?.purchaseNumber }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Order Date:</span>
                <span class="meta-val">{{ selectedPoForView()?.purchaseDate | date:'mediumDate' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Supplier:</span>
                <span class="meta-val font-bold">{{ selectedPoForView()?.supplier?.name }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Supplier Contact:</span>
                <span class="meta-val">
                  {{ selectedPoForView()?.supplier?.phone || selectedPoForView()?.supplier?.contactPerson || 'N/A' }}
                </span>
              </div>
            </div>

            <!-- ITEMS STATUS TABLE -->
            <h4 style="margin: 1.25rem 0 0.5rem 0; font-size: 0.95rem; font-weight: 700;">Order Items &amp; Fulfillment</h4>
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style="text-align: right;">Unit Cost</th>
                    <th style="text-align: center;">Ordered</th>
                    <th style="text-align: center;">Received</th>
                    <th style="text-align: center;">Pending</th>
                    <th style="text-align: right;">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of selectedPoForView()?.items; track item.sku) {
                    <tr>
                      <td class="font-bold">{{ item.productName }}</td>
                      <td class="font-mono text-muted">{{ item.sku }}</td>
                      <td class="font-mono" style="text-align: right;">₹{{ item.unitCost.toFixed(2) }}</td>
                      <td style="text-align: center;" class="font-mono font-bold">{{ item.quantity }}</td>
                      <td style="text-align: center;" class="font-mono text-success font-bold">
                        {{ item.receivedQuantity !== undefined && item.receivedQuantity !== null ? item.receivedQuantity : (selectedPoForView()?.status === 'received' ? item.quantity : 0) }}
                      </td>
                      <td style="text-align: center;" class="font-mono">
                        <strong [class.text-danger]="getPendingCount(item, selectedPoForView()!) > 0" [class.text-success]="getPendingCount(item, selectedPoForView()!) === 0">
                          {{ getPendingCount(item, selectedPoForView()!) }}
                        </strong>
                      </td>
                      <td class="font-mono font-bold" style="text-align: right;">₹{{ item.totalCost.toFixed(2) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- TOTALS SUMMARY -->
            <div class="po-summary-box">
              <div style="flex: 1;">
                @if (selectedPoForView()?.notes) {
                  <span style="font-size: 0.85rem; color: var(--color-text-muted);">
                    <strong>PO Notes:</strong> {{ selectedPoForView()?.notes }}
                  </span>
                }
              </div>
              <div class="po-totals-column">
                <div class="tot-row">
                  <span>Subtotal:</span>
                  <span class="font-mono">₹{{ selectedPoForView()?.subtotal?.toFixed(2) }}</span>
                </div>
                @if (selectedPoForView()?.tax) {
                  <div class="tot-row">
                    <span>Tax / Freight:</span>
                    <span class="font-mono">+₹{{ selectedPoForView()?.tax?.toFixed(2) }}</span>
                  </div>
                }
                <div class="tot-row grand">
                  <span>Grand Total:</span>
                  <span class="font-mono text-primary font-bold">₹{{ selectedPoForView()?.total?.toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <!-- RECEIPT HISTORY SECTION -->
            <div class="receipts-history-section">
              <h4 style="margin: 1.5rem 0 0.75rem 0; font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                <span>📦 Goods Receipt Note (GRN) History</span>
                <span class="badge badge-info" style="font-size: 0.75rem;">
                  {{ selectedPoForView()?.receipts?.length || 0 }} Shipments
                </span>
              </h4>

              @if (!selectedPoForView()?.receipts || selectedPoForView()?.receipts?.length === 0) {
                <div class="no-receipts-box">
                  <span>No separate delivery receipts logged yet. Stock will be received when deliveries arrive.</span>
                </div>
              } @else {
                <div class="receipts-list">
                  @for (rcv of selectedPoForView()?.receipts; track rcv.receiptNumber; let rIdx = $index) {
                    <div class="receipt-history-card">
                      <div class="receipt-card-header">
                        <div>
                          <span class="font-mono font-bold receipt-num">{{ rcv.receiptNumber }}</span>
                          <span class="receipt-date">&bull; {{ rcv.receivedDate | date:'medium' }}</span>
                        </div>
                        <button type="button" class="btn btn-secondary btn-sm" (click)="downloadGrnPdf(selectedPoForView()!, rIdx)" title="Download GRN PDF">
                          📥 Download GRN PDF
                        </button>
                      </div>

                      <div class="receipt-meta-row">
                        <span>Received By: <strong>{{ rcv.receivedByName || 'Storekeeper' }}</strong></span>
                        @if (rcv.notes) {
                          <span style="margin-left: 1rem;">Reference: <em>{{ rcv.notes }}</em></span>
                        }
                      </div>

                      <div class="receipt-items-pills">
                        @for (it of rcv.items; track it.sku) {
                          <span class="recv-pill">
                            {{ it.productName }}: <strong>+{{ it.quantityReceived }} units</strong>
                            @if (it.notes) { <em style="font-size: 0.7rem;">({{ it.notes }})</em> }
                          </span>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- MODAL ACTIONS -->
            <div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--color-border); flex-wrap: wrap; gap: 0.75rem;">
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-primary btn-sm" (click)="downloadPoPdf(selectedPoForView()!)">
                  📥 Download PO Document
                </button>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                @if (selectedPoForView()?.status !== 'received' && selectedPoForView()?.status !== 'cancelled') {
                  <button
                    type="button"
                    class="btn btn-success btn-sm"
                    (click)="openReceiveModal(selectedPoForView()!)"
                  >
                    📦 Receive Shipment
                  </button>
                }
                <button type="button" class="btn btn-secondary btn-sm" (click)="selectedPoForView.set(null)">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- INLINE CAMERA SCANNER FOR PURCHASES -->
      @if (showPoScanner()) {
        <div class="modal-backdrop scanner-modal-backdrop" (click)="closePoScanner()">
          <div class="modal-dialog scanner-modal-dialog card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3 style="margin: 0; font-size: 1.15rem;">📷 Scan Receiving Barcode</h3>
                <span style="font-size: 0.8rem; color: var(--color-text-muted);">Scan product barcode to select item</span>
              </div>
              <button class="icon-btn" (click)="closePoScanner()">&times;</button>
            </div>

            <div class="scanner-viewport-wrapper">
              <video #poScannerVideo class="scanner-video" playsinline webkit-playsinline muted autoplay></video>
              <div class="scanner-overlay">
                <div class="laser-scanner-line"></div>
              </div>
            </div>

            @if (scannerError()) {
              <div class="alert alert-danger" style="margin-top: 0.75rem; padding: 0.5rem; font-size: 0.8rem; border-radius: 6px; background: #fee2e2; color: #b91c1c;">
                {{ scannerError() }}
              </div>
            }

            <div class="modal-footer" style="margin-top: 1rem; padding-top: 0.75rem; display: flex; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" (click)="closePoScanner()">Close</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .purchases-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
    .page-title { font-size: var(--font-size-xl); font-weight: 800; }
    .page-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }

    .purchase-create-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 1.25rem;
      align-items: flex-start;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .purchase-left-pane, .purchase-right-pane {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .add-item-box {
      background: #f8fafc;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      .item-inputs-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1.2fr;
        gap: 0.75rem;
        align-items: flex-end;
      }
    }

    .summary-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }

    .mini-input {
      width: 80px;
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
    }

    .summary-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 1.35rem;
      font-weight: 800;
      color: var(--color-primary);
      border-top: 1px dashed var(--color-border);
      padding-top: 0.75rem;
    }

    .action-buttons-stack {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .font-bold { font-weight: 600; }
    .text-muted { color: var(--color-text-muted); }

    /* Modal Backdrop */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .scanner-modal-dialog {
      width: 100%;
      max-width: 440px;
      padding: 1.25rem;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--color-border);
    }

    .scanner-viewport-wrapper {
      position: relative;
      width: 100%;
      height: 260px;
      background: #000;
      border-radius: var(--radius-md);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .scanner-video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }

    .scanner-overlay {
      position: absolute;
      inset: 20px;
      border: 2px dashed rgba(255, 255, 255, 0.75);
      border-radius: var(--radius-md);
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .laser-scanner-line {
      width: 100%;
      height: 2px;
      background: #0f766e;
      box-shadow: 0 0 8px #0f766e;
      animation: scanLaser 2s infinite ease-in-out;
    }

    @keyframes scanLaser {
      0%, 100% { transform: translateY(-70px); }
      50% { transform: translateY(70px); }
    }

    .purchases-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--color-border);
    }

    .status-tabs-row {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;

      .status-tab {
        background: #f1f5f9;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 0.35rem 0.75rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-text-muted);
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #e2e8f0;
          color: var(--color-text-main);
        }

        &.active {
          background: var(--color-primary);
          color: #ffffff;
          border-color: var(--color-primary);
        }
      }
    }

    .search-actions-row {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .receiving-modal-dialog {
      width: 100%;
      max-width: 840px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .receiving-controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: #f8fafc;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .receiving-table-container {
      max-height: 380px;
      overflow-y: auto;
    }

    .qty-deliver-input {
      width: 85px;
      margin: 0 auto;
      text-align: center;
      padding: 0.3rem 0.4rem;
      font-size: 0.9rem;
      font-weight: 700;
    }

    .row-complete {
      background: #f8fafc;
      opacity: 0.75;
    }

    .view-po-modal-dialog {
      width: 100%;
      max-width: 860px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 1.5rem;
    }

    .view-po-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.75rem;
      background: #f8fafc;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.85rem 1rem;

      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;

        .meta-label {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
        }

        .meta-val {
          font-size: 0.9rem;
          color: var(--color-text-main);
        }
      }
    }

    .po-summary-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 1rem;
      padding-top: 0.75rem;
      border-top: 1px solid var(--color-border);
      gap: 1rem;
      flex-wrap: wrap;

      .po-totals-column {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 220px;

        .tot-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;

          &.grand {
            font-size: 1.15rem;
            font-weight: 800;
            padding-top: 0.35rem;
            border-top: 1px dashed var(--color-border);
          }
        }
      }
    }

    .receipts-history-section {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 2px solid var(--color-border);

      .no-receipts-box {
        padding: 1.25rem;
        background: #f8fafc;
        border-radius: var(--radius-sm);
        color: var(--color-text-muted);
        font-size: 0.85rem;
        text-align: center;
      }

      .receipts-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .receipt-history-card {
        background: #ffffff;
        border: 1px solid var(--color-border);
        border-left: 4px solid var(--color-primary);
        border-radius: var(--radius-sm);
        padding: 0.75rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;

        .receipt-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;

          .receipt-num {
            font-size: 0.95rem;
            color: var(--color-text-main);
          }

          .receipt-date {
            font-size: 0.8rem;
            color: var(--color-text-muted);
          }
        }

        .receipt-meta-row {
          font-size: 0.8rem;
          color: var(--color-text-muted);
        }

        .receipt-items-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.25rem;

          .recv-pill {
            background: #f1f5f9;
            border: 1px solid var(--color-border);
            padding: 0.2rem 0.5rem;
            border-radius: var(--radius-sm);
            font-size: 0.75rem;
            color: var(--color-text-main);
          }
        }
      }
    }
  `],
})
export class PurchasesComponent implements OnInit, OnDestroy {
  private api = inject(InventoryApiService);
  private toast = inject(ToastService);
  authService = inject(AuthService);
  pdfService = inject(PdfService);
  private route = inject(ActivatedRoute);

  purchases = signal<Purchase[]>([]);
  suppliers = signal<Supplier[]>([]);
  products = signal<Product[]>([]);

  isCreating = signal<boolean>(false);
  isSaving = signal<boolean>(false);

  // Inline PO Camera Scanner
  showPoScanner = signal<boolean>(false);
  scannerError = signal<string | null>(null);
  @ViewChild('poScannerVideo') poScannerVideo?: ElementRef<HTMLVideoElement>;
  private barcodeScannerService = inject(BarcodeScannerService);
  private poScannerSession: ScannerSession | null = null;

  // Form State
  selectedSupplierId = '';
  selectedProductId = '';
  itemQty = 1;
  itemCost = 0;
  tax = 0;
  notes = '';
  lineItems = signal<PurchaseLineItem[]>([]);

  subtotal = signal<number>(0);
  total = signal<number>(0);

  // Search & Status filters
  statusFilter = signal<string>('all');
  searchQuery = '';
  private searchDebounceTimer: any = null;

  // View PO & Receipt modals
  selectedPoForView = signal<Purchase | null>(null);
  receivingPo = signal<Purchase | null>(null);
  receivingItems = signal<ReceivingItemRow[]>([]);
  receivingNotes = '';
  isSubmittingReceipt = signal<boolean>(false);

  ngOnInit(): void {
    this.loadPurchases();
    this.loadSuppliers();
    this.loadProducts();

    this.route.queryParams.subscribe((params) => {
      if (params['addProductId']) {
        this.isCreating.set(true);
        this.selectedProductId = params['addProductId'];
      }
    });
  }

  loadPurchases(): void {
    this.api.getPurchases(1, 100, this.statusFilter(), this.searchQuery.trim()).subscribe({
      next: (res) => { if (res.success) this.purchases.set(res.data); },
    });
  }

  filterByStatus(status: string): void {
    this.statusFilter.set(status);
    this.loadPurchases();
  }

  onSearchChange(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.loadPurchases();
    }, 300);
  }

  openViewPoModal(po: Purchase): void {
    this.selectedPoForView.set(po);
  }

  openReceiveModal(po: Purchase): void {
    const items: ReceivingItemRow[] = (po.items || []).map((it) => {
      const ordered = it.quantity || 0;
      const previouslyReceived = it.receivedQuantity !== undefined && it.receivedQuantity !== null
        ? it.receivedQuantity
        : (po.status === 'received' ? ordered : 0);
      const pending = Math.max(0, ordered - previouslyReceived);
      return {
        product: typeof it.product === 'object' ? (it.product as any)._id : it.product,
        productName: it.productName,
        sku: it.sku,
        barcode: it.barcode,
        ordered,
        previouslyReceived,
        pending,
        deliverNow: pending,
        notes: '',
      };
    });

    this.receivingItems.set(items);
    this.receivingNotes = '';
    this.receivingPo.set(po);
  }

  receiveAllRemaining(): void {
    this.receivingItems.update((items) =>
      items.map((i) => ({ ...i, deliverNow: i.pending }))
    );
  }

  clearReceiptQuantities(): void {
    this.receivingItems.update((items) =>
      items.map((i) => ({ ...i, deliverNow: 0 }))
    );
  }

  validateItemQty(item: ReceivingItemRow): void {
    if (item.deliverNow < 0) {
      item.deliverNow = 0;
    }
    if (item.deliverNow > item.pending) {
      this.toast.error(`Delivered quantity cannot exceed pending (${item.pending}) for ${item.productName}`);
      item.deliverNow = item.pending;
    }
  }

  getTotalDeliveredNow(): number {
    return this.receivingItems().reduce((sum, i) => sum + (Number(i.deliverNow) || 0), 0);
  }

  submitReceipt(): void {
    const po = this.receivingPo();
    if (!po) return;

    const totalDelivered = this.getTotalDeliveredNow();
    if (totalDelivered <= 0) {
      this.toast.error('Please enter delivered quantity (> 0) for at least one product.');
      return;
    }

    for (const item of this.receivingItems()) {
      if (item.deliverNow < 0 || item.deliverNow > item.pending) {
        this.toast.error(`Invalid quantity for ${item.productName}. Must be between 0 and ${item.pending}`);
        return;
      }
    }

    if (!confirm(`Confirm receiving ${totalDelivered} units for PO '${po.purchaseNumber}' and update inventory stock?`)) {
      return;
    }

    this.isSubmittingReceipt.set(true);

    const payload = {
      items: this.receivingItems()
        .filter((i) => i.deliverNow > 0)
        .map((i) => ({
          product: i.product,
          quantityReceived: i.deliverNow,
          notes: i.notes,
        })),
      notes: this.receivingNotes,
    };

    this.api.receivePurchase(po._id, payload).subscribe({
      next: (res) => {
        this.isSubmittingReceipt.set(false);
        this.toast.success(`Receipt saved! ${totalDelivered} units added to stock ledger.`);
        this.receivingPo.set(null);

        if (this.selectedPoForView() && this.selectedPoForView()?._id === po._id) {
          this.selectedPoForView.set(res.data);
        }

        this.loadPurchases();
        this.loadProducts();
      },
      error: (err) => {
        this.isSubmittingReceipt.set(false);
        this.toast.error(err?.error?.message || 'Failed to process receipt');
      },
    });
  }

  getPendingCount(item: any, po: Purchase): number {
    const ordered = item.quantity || 0;
    const received = item.receivedQuantity !== undefined && item.receivedQuantity !== null
      ? item.receivedQuantity
      : (po.status === 'received' ? ordered : 0);
    return Math.max(0, ordered - received);
  }

  async downloadGrnPdf(po: Purchase, receiptIndex?: number): Promise<void> {
    try {
      await this.pdfService.generateGrnPdf(po, receiptIndex);
      this.toast.success('Goods Receipt Note PDF downloaded');
    } catch (err: any) {
      this.toast.error('Failed to generate GRN PDF: ' + err.message);
    }
  }

  loadSuppliers(): void {
    this.api.getSuppliers().subscribe({
      next: (res) => { if (res.success) this.suppliers.set(res.data); },
    });
  }

  loadProducts(): void {
    this.api.getProducts({ limit: 100, status: 'active' }).subscribe({
      next: (res) => { if (res.success) this.products.set(res.data); },
    });
  }

  onProductSelect(): void {
    const prod = this.products().find((p) => p._id === this.selectedProductId);
    if (prod) {
      this.itemCost = prod.purchasePrice;
    }
  }

  addLineItem(): void {
    const prod = this.products().find((p) => p._id === this.selectedProductId);
    if (!prod) return;

    const existingIndex = this.lineItems().findIndex((i) => i.product._id === prod._id);
    const lineTotal = Number((this.itemQty * this.itemCost).toFixed(2));

    if (existingIndex > -1) {
      this.lineItems()[existingIndex].quantity += this.itemQty;
      this.lineItems()[existingIndex].unitCost = this.itemCost;
      this.lineItems()[existingIndex].totalCost = Number(
        (this.lineItems()[existingIndex].quantity * this.itemCost).toFixed(2)
      );
    } else {
      this.lineItems.update((items) => [
        ...items,
        {
          product: prod,
          quantity: this.itemQty,
          unitCost: this.itemCost,
          totalCost: lineTotal,
        },
      ]);
    }

    this.computeTotals();
    this.selectedProductId = '';
    this.itemQty = 1;
    this.itemCost = 0;
  }

  removeLineItem(idx: number): void {
    this.lineItems.update((items) => items.filter((_, i) => i !== idx));
    this.computeTotals();
  }

  computeTotals(): void {
    const sum = this.lineItems().reduce((acc, item) => acc + item.totalCost, 0);
    this.subtotal.set(Number(sum.toFixed(2)));
    this.total.set(Number((sum + (this.tax || 0)).toFixed(2)));
  }

  submitPurchase(status: 'draft' | 'ordered' | 'received'): void {
    if (!this.selectedSupplierId || this.lineItems().length === 0) return;

    this.isSaving.set(true);
    const payload = {
      supplier: this.selectedSupplierId,
      items: this.lineItems().map((i) => ({
        product: i.product._id,
        quantity: i.quantity,
        unitCost: i.unitCost,
      })),
      tax: this.tax,
      notes: this.notes,
      status,
    };

    this.api.createPurchase(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        const msg = status === 'received'
          ? 'Purchase created & inventory received!'
          : status === 'ordered'
          ? 'Purchase order created successfully!'
          : 'Draft PO saved.';
        this.toast.success(msg);
        this.isCreating.set(false);
        this.lineItems.set([]);
        this.loadPurchases();
        this.loadProducts();
      },
      error: () => { this.isSaving.set(false); },
    });
  }

  async downloadPoPdf(po: Purchase): Promise<void> {
    try {
      await this.pdfService.generatePurchaseOrderPdf(po);
      const docType = po.status === 'received' ? 'Goods Receipt Note' : 'Purchase Order';
      this.toast.success(`${docType} PDF downloaded for '${po.purchaseNumber}'`);
    } catch (err: any) {
      this.toast.error('Failed to generate PDF: ' + err.message);
    }
  }

  openPoScanner(): void {
    this.scannerError.set(null);
    this.showPoScanner.set(true);
    setTimeout(() => {
      this.startPoCamera();
    }, 150);
  }

  private async startPoCamera(): Promise<void> {
    if (!this.poScannerVideo?.nativeElement) return;
    try {
      if (this.poScannerSession) {
        this.poScannerSession.stop();
        this.poScannerSession = null;
      }

      this.poScannerSession = await this.barcodeScannerService.startSession({
        videoElement: this.poScannerVideo.nativeElement,
        preferRear: true,
        onScan: (result) => {
          this.handleScannedPoBarcode(result.code);
        },
        onError: (err) => {
          this.scannerError.set(err);
        },
      });
    } catch (err: any) {
      this.scannerError.set(err?.message || 'Camera permission denied or camera device unavailable.');
    }
  }

  private handleScannedPoBarcode(code: string): void {
    this.playBeep();
    // 1. Check local catalog
    const localMatch = this.products().find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());
    if (localMatch) {
      this.selectedProductId = localMatch._id;
      this.itemCost = localMatch.purchasePrice;
      this.toast.success(`Selected: ${localMatch.name}`);
      this.closePoScanner();
      return;
    }

    // 2. Lookup barcode API
    this.api.lookupBarcode(code).subscribe({
      next: (res) => {
        if (res.success && res.data.found && res.data.product) {
          const product = res.data.product;
          this.selectedProductId = product._id;
          this.itemCost = product.purchasePrice;
          this.toast.success(`Selected: ${product.name}`);
          this.closePoScanner();
        } else {
          this.toast.error(`No product found for barcode: ${code}`);
        }
      },
      error: () => {
        this.toast.error(`Lookup failed for barcode: ${code}`);
      },
    });
  }

  closePoScanner(): void {
    if (this.poScannerSession) {
      this.poScannerSession.stop();
      this.poScannerSession = null;
    }
    this.showPoScanner.set(false);
  }

  private playBeep(): void {
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

  ngOnDestroy(): void {
    this.closePoScanner();
  }
}
