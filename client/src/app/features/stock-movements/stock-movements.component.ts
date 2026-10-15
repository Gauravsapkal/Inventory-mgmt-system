import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <label class="form-label" style="margin: 0;">Select Product *</label>
                  <button type="button" class="btn btn-secondary btn-sm" (click)="openAdjustScanner()" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">
                    📷 Scan Barcode
                  </button>
                </div>
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

      <!-- INLINE CAMERA SCANNER FOR STOCK ADJUSTMENTS -->
      @if (showAdjustScanner()) {
        <div class="modal-backdrop scanner-modal-backdrop" (click)="closeAdjustScanner()">
          <div class="modal-dialog scanner-modal-dialog card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <div>
                <h3 style="margin: 0; font-size: 1.15rem;">📷 Scan Audit Item</h3>
                <span style="font-size: 0.8rem; color: var(--color-text-muted);">Point camera at barcode to auto-select</span>
              </div>
              <button class="icon-btn" (click)="closeAdjustScanner()">&times;</button>
            </div>

            <div class="scanner-viewport-wrapper">
              <video #adjustScannerVideo class="scanner-video" playsinline webkit-playsinline muted autoplay></video>
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
              <button type="button" class="btn btn-secondary" (click)="closeAdjustScanner()">Close</button>
            </div>
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

    .scanner-modal-dialog { width: 100%; max-width: 440px; }
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
    .scanner-video { width: 100%; height: 100%; object-fit: cover; }
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
      background: #0284c7;
      box-shadow: 0 0 8px #0284c7;
      animation: scanLaser 2s infinite ease-in-out;
    }
    @keyframes scanLaser {
      0%, 100% { transform: translateY(-70px); }
      50% { transform: translateY(70px); }
    }
  `],
})
export class StockMovementsComponent implements OnInit, OnDestroy {
  private api = inject(InventoryApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  authService = inject(AuthService);

  movements = signal<StockMovement[]>([]);
  products = signal<Product[]>([]);
  selectedType = '';

  showAdjustModal = signal<boolean>(false);

  // Inline Stock Adjustment Camera Scanner
  showAdjustScanner = signal<boolean>(false);
  scannerError = signal<string | null>(null);
  @ViewChild('adjustScannerVideo') adjustScannerVideo?: ElementRef<HTMLVideoElement>;
  private adjustCodeReader?: BrowserMultiFormatReader;
  private adjustScannerControls?: IScannerControls;

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

  openAdjustScanner(): void {
    this.scannerError.set(null);
    this.showAdjustScanner.set(true);
    setTimeout(() => {
      this.startAdjustCamera();
    }, 150);
  }

  private async startAdjustCamera(): Promise<void> {
    if (!this.adjustScannerVideo?.nativeElement) return;
    try {
      this.adjustCodeReader = new BrowserMultiFormatReader();

      const constraintProfiles: MediaStreamConstraints[] = [
        {
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        },
        { video: { facingMode: 'environment' }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      for (const constraints of constraintProfiles) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch {
          // Fall back
        }
      }

      if (!stream) {
        throw new Error('Unable to access camera. Please grant camera permission.');
      }

      const videoEl = this.adjustScannerVideo.nativeElement;
      videoEl.srcObject = stream;
      await videoEl.play();

      this.adjustScannerControls = await this.adjustCodeReader.decodeFromVideoElement(
        videoEl,
        (result, error) => {
          if (result) {
            const code = result.getText().trim();
            if (code) {
              this.handleScannedAdjustBarcode(code);
            }
          }
        }
      );
    } catch (err: any) {
      this.scannerError.set(err?.message || 'Camera permission denied or camera device unavailable.');
    }
  }

  private handleScannedAdjustBarcode(code: string): void {
    if (navigator.vibrate) navigator.vibrate(100);
    const localMatch = this.products().find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());
    if (localMatch) {
      this.adjustForm.patchValue({ productId: localMatch._id, newQuantity: localMatch.currentStock });
      this.toast.success(`Selected for audit: ${localMatch.name}`);
      this.closeAdjustScanner();
      return;
    }

    this.api.lookupBarcode(code).subscribe({
      next: (res) => {
        if (res.success && res.data.found && res.data.product) {
          const product = res.data.product;
          this.adjustForm.patchValue({ productId: product._id, newQuantity: product.currentStock });
          this.toast.success(`Selected for audit: ${product.name}`);
          this.closeAdjustScanner();
        } else {
          this.toast.error(`No product found for barcode: ${code}`);
        }
      },
      error: () => {
        this.toast.error(`Lookup failed for barcode: ${code}`);
      },
    });
  }

  closeAdjustScanner(): void {
    if (this.adjustScannerControls) {
      this.adjustScannerControls.stop();
      this.adjustScannerControls = undefined;
    }
    if (this.adjustScannerVideo?.nativeElement?.srcObject) {
      const stream = this.adjustScannerVideo.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      this.adjustScannerVideo.nativeElement.srcObject = null;
    }
    this.showAdjustScanner.set(false);
  }

  ngOnDestroy(): void {
    this.closeAdjustScanner();
  }
}
