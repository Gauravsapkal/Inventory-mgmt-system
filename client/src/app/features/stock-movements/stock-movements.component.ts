import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { InventoryApiService, StockMovement, Product } from '../../core/services/inventory-api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-stock-movements',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="movements-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Stock History &amp; Audit Trail</h1>
          <p class="page-subtitle">Immutable log of all inventory movements: purchases, sales, and authorized adjustments</p>
        </div>
        @if (authService.isAdmin()) {
          <button class="btn btn-primary" (click)="showAdjustModal.set(true)">
            Manual Stock Adjustment
          </button>
        }
      </div>

      <div class="card toolbar-card">
        <select class="form-control" [(ngModel)]="selectedType" (change)="loadMovements()">
          <option value="">All Movement Types</option>
          <option value="purchase">Purchases (Stock Additions)</option>
          <option value="sale">Sales (Stock Reductions)</option>
          <option value="adjustment">Manual Adjustments</option>
        </select>
      </div>

      <div class="card table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Product</th>
              <th>Movement Type</th>
              <th>Change</th>
              <th>Previous &rarr; New</th>
              <th>User</th>
              <th>Reason / Reference</th>
            </tr>
          </thead>
          <tbody>
            @for (mov of movements(); track mov._id) {
              <tr>
                <td style="white-space: nowrap;">{{ mov.createdAt | date:'medium' }}</td>
                <td>
                  <div class="font-bold">{{ mov.product.name || 'Product' }}</div>
                  <div class="font-mono text-muted" style="font-size: 0.75rem;">{{ mov.product.sku }}</div>
                </td>
                <td>
                  <span
                    class="badge"
                    [class.badge-success]="mov.movementType === 'purchase'"
                    [class.badge-danger]="mov.movementType === 'sale'"
                    [class.badge-info]="mov.movementType === 'adjustment'"
                  >
                    {{ mov.movementType | uppercase }}
                  </span>
                </td>
                <td class="font-mono font-bold" [class.text-success]="mov.quantityChange > 0" [class.text-danger]="mov.quantityChange < 0">
                  {{ mov.quantityChange > 0 ? '+' : '' }}{{ mov.quantityChange }}
                </td>
                <td class="font-mono">
                  {{ mov.previousQuantity }} &rarr; <strong>{{ mov.newQuantity }}</strong>
                </td>
                <td>{{ mov.user?.name || 'System' }}</td>
                <td class="text-muted" style="font-size: 0.8rem;">
                  {{ mov.reason || mov.referenceType || '--' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- ADJUSTMENT MODAL -->
      @if (showAdjustModal()) {
        <div class="modal-backdrop" (click)="showAdjustModal.set(false)">
          <div class="modal-dialog card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Authorized Stock Adjustment</h3>
              <button class="icon-btn" (click)="showAdjustModal.set(false)">&times;</button>
            </div>
            <form [formGroup]="adjustForm" (ngSubmit)="submitAdjustment()">
              <div class="form-group">
                <label class="form-label">Select Product *</label>
                <select class="form-control" formControlName="productId">
                  <option value="">Choose Product</option>
                  @for (p of products(); track p._id) {
                    <option [value]="p._id">{{ p.name }} (Current: {{ p.currentStock }} {{ p.uom }})</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">New Correct Stock Quantity *</label>
                <input type="number" min="0" class="form-control" formControlName="newQuantity" />
              </div>

              <div class="form-group">
                <label class="form-label">Audit Reason *</label>
                <textarea
                  class="form-control"
                  formControlName="reason"
                  rows="3"
                  placeholder="Explain why stock is being modified (e.g. damaged goods, audit discrepancy)..."
                ></textarea>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="showAdjustModal.set(false)">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="adjustForm.invalid">Record Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .movements-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
    .page-title { font-size: var(--font-size-xl); font-weight: 800; }
    .page-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .toolbar-card { padding: 0.75rem 1rem; }
    .font-bold { font-weight: 600; }
    .text-muted { color: var(--color-text-muted); }
    .text-success { color: #10b981; }
    .text-danger { color: #ef4444; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
    .modal-dialog { width: 100%; max-width: 500px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `],
})
export class StockMovementsComponent implements OnInit {
  private api = inject(InventoryApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  authService = inject(AuthService);

  movements = signal<StockMovement[]>([]);
  products = signal<Product[]>([]);
  selectedType = '';

  showAdjustModal = signal<boolean>(false);

  adjustForm = this.fb.group({
    productId: ['', [Validators.required]],
    newQuantity: [0, [Validators.required, Validators.min(0)]],
    reason: ['', [Validators.required, Validators.minLength(3)]],
  });

  ngOnInit(): void {
    this.loadMovements();
    this.api.getProducts({ limit: 100 }).subscribe({
      next: (res) => { if (res.success) this.products.set(res.data); },
    });
  }

  loadMovements(): void {
    this.api.getStockMovements(1, 50).subscribe({
      next: (res) => {
        if (res.success) {
          const type = this.selectedType;
          this.movements.set(
            type ? res.data.filter((m) => m.movementType === type) : res.data
          );
        }
      },
    });
  }

  submitAdjustment(): void {
    if (this.adjustForm.invalid) return;

    this.api.createStockAdjustment(this.adjustForm.value as any).subscribe({
      next: () => {
        this.toast.success('Stock adjustment logged successfully');
        this.showAdjustModal.set(false);
        this.adjustForm.reset({ newQuantity: 0 });
        this.loadMovements();
      },
    });
  }
}
