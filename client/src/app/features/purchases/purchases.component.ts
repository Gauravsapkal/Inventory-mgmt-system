import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { InventoryApiService, Purchase, Supplier, Product } from '../../core/services/inventory-api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

interface PurchaseLineItem {
  product: Product;
  quantity: number;
  unitCost: number;
  totalCost: number;
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
                <label class="form-label">Add Product</label>
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
        <!-- PURCHASE ORDERS LIST -->
        <div class="card table-container">
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
                  <td>{{ po.supplier?.name || 'Supplier' }}</td>
                  <td>{{ po.items.length }} line items</td>
                  <td class="font-mono font-bold">₹{{ po.total.toFixed(2) }}</td>
                  <td>
                    <span
                      class="badge"
                      [class.badge-success]="po.status === 'received'"
                      [class.badge-warning]="po.status === 'draft'"
                      [class.badge-danger]="po.status === 'cancelled'"
                    >
                      {{ po.status | uppercase }}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    @if (po.status === 'draft') {
                      <button class="btn btn-success btn-sm" (click)="receiveOrder(po)">
                        Receive Items
                      </button>
                    } @else {
                      <span class="text-muted" style="font-size: 0.8rem;">Received</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
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
  `],
})
export class PurchasesComponent implements OnInit {
  private api = inject(InventoryApiService);
  private toast = inject(ToastService);
  authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  purchases = signal<Purchase[]>([]);
  suppliers = signal<Supplier[]>([]);
  products = signal<Product[]>([]);

  isCreating = signal<boolean>(false);
  isSaving = signal<boolean>(false);

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
    this.api.getPurchases().subscribe({
      next: (res) => { if (res.success) this.purchases.set(res.data); },
    });
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

  submitPurchase(status: 'draft' | 'received'): void {
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
        this.toast.success(status === 'received' ? 'Purchase received & stock updated!' : 'Draft PO saved.');
        this.isCreating.set(false);
        this.lineItems.set([]);
        this.loadPurchases();
        this.loadProducts();
      },
      error: () => { this.isSaving.set(false); },
    });
  }

  receiveOrder(po: Purchase): void {
    if (confirm(`Receive Purchase Order '${po.purchaseNumber}' and increase inventory stocks?`)) {
      this.api.receivePurchase(po._id).subscribe({
        next: () => {
          this.toast.success('Stock inventory increased successfully!');
          this.loadPurchases();
          this.loadProducts();
        },
      });
    }
  }
}
