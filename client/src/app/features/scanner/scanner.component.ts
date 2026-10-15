import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { InventoryApiService, Product } from '../../core/services/inventory-api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { PdfService } from '../../core/services/pdf.service';

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="scanner-page">
      <!-- HEADER -->
      <div class="page-header no-print">
        <div>
          <h1 class="page-title">Barcode Scanner</h1>
          <p class="page-subtitle">Scan EAN-13, EAN-8, UPC-A, and Code-128 barcodes via mobile phone camera</p>
        </div>
        <div class="camera-controls">
          @if (isScanning()) {
            @if (hasMultipleCameras()) {
              <button class="btn btn-secondary btn-sm" (click)="switchCamera()" title="Switch Front/Rear Camera">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 1.956.702 3.748 1.874 5.138L4 17h6v-6L8.138 12.874C7.424 11.968 7 10.834 7 9.5 7 6.462 9.462 4 12.5 4s5.5 2.462 5.5 5.5c0 1.334-.424 2.468-1.138 3.374L15 11v6h6l-1.874-1.862C21.298 13.748 22 11.956 22 10z"/>
                </svg>
                <span>Switch Cam</span>
              </button>
            }
            @if (supportsTorch()) {
              <button class="btn btn-secondary btn-sm" (click)="toggleTorch()">
                <span>{{ isTorchOn() ? '🔦 Torch Off' : '💡 Torch On' }}</span>
              </button>
            }
            <button class="btn btn-danger btn-sm" (click)="stopCamera()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="18" height="18" x="3" y="3" rx="2"/>
              </svg>
              <span>Stop Camera</span>
            </button>
          } @else {
            <button class="btn btn-primary" (click)="startCamera()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Start Camera</span>
            </button>
          }
        </div>
      </div>

      <!-- MAIN SCANNER WORKSPACE -->
      <div class="scanner-layout">
        <!-- VIDEO VIEWFINDER AREA -->
        <div class="card viewfinder-card">
          <div class="camera-viewport-container">
            <video #videoElement class="camera-video" playsinline webkit-playsinline muted autoplay></video>

            <!-- SCANNING RETICLE / TARGET FRAME OVERLAY -->
            @if (isScanning()) {
              <div class="scanning-reticle">
                <div class="reticle-corner top-left"></div>
                <div class="reticle-corner top-right"></div>
                <div class="reticle-corner bottom-left"></div>
                <div class="reticle-corner bottom-right"></div>
                <div class="laser-scanner-line"></div>
              </div>
              <div class="scan-instructions">
                <span>Align barcode within the target frame</span>
              </div>
            } @else {
              <div class="camera-off-overlay">
                <div class="camera-icon">📷</div>
                <h3>Camera is Inactive</h3>
                <p>Click "Start Camera" to enable phone-camera barcode scanning.</p>
                <button class="btn btn-primary" (click)="startCamera()">Activate Camera</button>
              </div>
            }

            @if (permissionError()) {
              <div class="permission-error-alert">
                <strong>Camera Access Blocked:</strong> {{ permissionError() }}
                <p class="error-hint">Please allow camera permissions in your browser or use the manual entry fallback below.</p>
              </div>
            }
          </div>

          <!-- MANUAL BARCODE ENTRY / USB SCANNER FALLBACK -->
          <div class="manual-entry-toolbar">
            <label class="form-label">Manual Barcode Input or USB Scanner</label>
            <div class="input-with-button">
              <input
                type="text"
                class="form-control font-mono"
                placeholder="Type or scan barcode and press Enter..."
                [(ngModel)]="manualBarcodeInput"
                (keyup.enter)="onManualSubmit()"
              />
              <button class="btn btn-secondary" (click)="onManualSubmit()" [disabled]="!manualBarcodeInput.trim()">
                Lookup
              </button>
            </div>
          </div>
        </div>

        <!-- SCAN RESULT PANEL -->
        <div class="card result-card">
          <div class="result-header">
            <h3>Detection Results</h3>
            @if (lastScannedCode()) {
              <span class="badge badge-info font-mono">{{ lastScannedCode() }}</span>
            }
          </div>

          @if (isLookingUp()) {
            <div class="result-loading">
              <div class="spinner"></div>
              <p>Looking up barcode in database...</p>
            </div>
          } @else if (matchedProduct()) {
            <div class="matched-product-details">
              <div class="match-badge">
                <span class="badge badge-success">✓ Product Recognized</span>
              </div>

              <div class="product-info-block">
                <h2 class="p-title">{{ matchedProduct()?.name }}</h2>
                <div class="p-meta">
                  <span class="font-mono sku-tag">SKU: {{ matchedProduct()?.sku }}</span>
                  <span class="badge badge-info font-mono">Barcode: {{ matchedProduct()?.barcode }}</span>
                </div>
                @if (matchedProduct()?.description) {
                  <p class="p-desc">{{ matchedProduct()?.description }}</p>
                }
              </div>

              <div class="financial-stats-grid">
                <div class="stat-box">
                  <span class="stat-box-label">Selling Price</span>
                  <span class="stat-box-val font-mono text-primary">₹{{ matchedProduct()?.sellingPrice?.toFixed(2) }}</span>
                </div>
                <div class="stat-box">
                  <span class="stat-box-label">Current Stock</span>
                  <span class="stat-box-val font-mono" [class.text-danger]="(matchedProduct()?.currentStock ?? 0) <= 0">
                    {{ matchedProduct()?.currentStock }} {{ matchedProduct()?.uom }}
                  </span>
                </div>
              </div>

              <!-- ACTIONS -->
              <div class="scanner-actions">
                <button class="btn btn-primary btn-block" (click)="addToSale(matchedProduct()!)" [disabled]="(matchedProduct()?.currentStock ?? 0) <= 0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
                  </svg>
                  <span>Add to Sale Invoice</span>
                </button>

                <button class="btn btn-secondary btn-block" (click)="addToPurchase(matchedProduct()!)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/>
                  </svg>
                  <span>Add to Purchase Order</span>
                </button>

                <button class="btn btn-secondary btn-block" (click)="downloadBarcodeSticker(matchedProduct()!)">
                  <span>🏷️ Print / Download Barcode Label</span>
                </button>
              </div>
            </div>
          } @else if (unknownCode()) {
            <div class="unknown-code-container">
              <div class="unknown-icon">❓</div>
              <h4>Unknown Barcode Detected</h4>
              <p class="unknown-code-text font-mono">{{ unknownCode() }}</p>
              <p class="unknown-sub">This barcode is not yet registered in the inventory database.</p>

              @if (authService.isAdmin()) {
                <button class="btn btn-primary btn-block" (click)="registerNewProductWithBarcode()">
                  + Create Product with this Barcode
                </button>
              } @else {
                <p class="staff-notice">Please request an administrator to register this item.</p>
              }
            </div>
          } @else {
            <div class="result-placeholder">
              <div class="placeholder-icon">🎯</div>
              <h4>Ready to Scan</h4>
              <p>Aim your camera at any item barcode to instantly inspect product inventory and trigger checkout.</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .scanner-page {
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

      .page-title {
        font-size: var(--font-size-xl);
        font-weight: 800;
      }
      .page-subtitle {
        font-size: var(--font-size-sm);
        color: var(--color-text-muted);
      }
      .camera-controls {
        display: flex;
        gap: 0.5rem;
      }
    }

    .scanner-layout {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 1.25rem;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    .viewfinder-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.25rem;
    }

    .camera-viewport-container {
      position: relative;
      width: 100%;
      height: 380px;
      background: #090d16;
      border-radius: var(--radius-lg);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;

      @media (max-width: 480px) {
        height: 300px;
      }
    }

    .camera-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* SCANNING RETICLE */
    .scanning-reticle {
      position: absolute;
      width: 250px;
      height: 160px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
      border-radius: 8px;
      pointer-events: none;

      .reticle-corner {
        position: absolute;
        width: 20px;
        height: 20px;
        border-color: #38bdf8;
        border-style: solid;

        &.top-left { top: -2px; left: -2px; border-width: 3px 0 0 3px; border-top-left-radius: 6px; }
        &.top-right { top: -2px; right: -2px; border-width: 3px 3px 0 0; border-top-right-radius: 6px; }
        &.bottom-left { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; border-bottom-left-radius: 6px; }
        &.bottom-right { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; border-bottom-right-radius: 6px; }
      }

      .laser-scanner-line {
        position: absolute;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, #ef4444, #f87171, transparent);
        box-shadow: 0 0 8px #ef4444;
        animation: scanSweep 1.8s ease-in-out infinite alternate;
      }
    }

    @keyframes scanSweep {
      0% { top: 5%; }
      100% { top: 95%; }
    }

    .scan-instructions {
      position: absolute;
      bottom: 1rem;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      padding: 0.35rem 0.85rem;
      border-radius: var(--radius-full);
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .camera-off-overlay {
      position: absolute;
      text-align: center;
      padding: 1.5rem;
      color: #ffffff;

      .camera-icon { font-size: 3rem; margin-bottom: 0.5rem; }
      h3 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.25rem; }
      p { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1rem; }
    }

    .permission-error-alert {
      position: absolute;
      bottom: 1rem;
      left: 1rem;
      right: 1rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      padding: 0.75rem;
      border-radius: var(--radius-md);
      font-size: 0.8rem;

      .error-hint {
        margin-top: 0.25rem;
        color: #7f1d1d;
      }
    }

    .manual-entry-toolbar {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;

      .input-with-button {
        display: flex;
        gap: 0.5rem;
      }
    }

    /* RESULT CARD */
    .result-card {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;

      .result-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--color-border);

        h3 { font-size: 1.15rem; font-weight: 700; }
      }
    }

    .matched-product-details {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;

      .p-title {
        font-size: 1.35rem;
        font-weight: 800;
        color: var(--color-text-main);
      }

      .p-meta {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.35rem;
        flex-wrap: wrap;
      }

      .p-desc {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        margin-top: 0.5rem;
      }
    }

    .financial-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;

      .stat-box {
        background: #f8fafc;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: 0.85rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;

        .stat-box-label {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          font-weight: 600;
          text-transform: uppercase;
        }

        .stat-box-val {
          font-size: 1.3rem;
          font-weight: 800;
        }
      }
    }

    .scanner-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .unknown-code-container, .result-placeholder, .result-loading {
      text-align: center;
      padding: 3rem 1.5rem;

      .unknown-icon, .placeholder-icon { font-size: 3rem; margin-bottom: 0.75rem; }
      h4 { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.35rem; }
      p { font-size: 0.85rem; color: var(--color-text-muted); }
      .unknown-code-text {
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--color-primary);
        margin: 0.5rem 0;
      }
      .unknown-sub { margin-bottom: 1.5rem; }
    }

    .btn-block { width: 100%; }
    .text-primary { color: var(--color-primary); }
    .text-danger { color: var(--color-danger); }
  `],
})
export class BarcodeScannerComponent implements OnInit, OnDestroy {
  private api = inject(InventoryApiService);
  private toastService = inject(ToastService);
  private pdfService = inject(PdfService);
  authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;

  // Scanner state
  isScanning = signal<boolean>(false);
  hasMultipleCameras = signal<boolean>(false);
  supportsTorch = signal<boolean>(false);
  isTorchOn = signal<boolean>(false);
  permissionError = signal<string | null>(null);

  // Result state
  lastScannedCode = signal<string | null>(null);
  isLookingUp = signal<boolean>(false);
  matchedProduct = signal<Product | null>(null);
  unknownCode = signal<string | null>(null);

  manualBarcodeInput = '';

  private codeReader: BrowserMultiFormatReader | null = null;
  private scannerControls: IScannerControls | null = null;
  private videoDevices: MediaDeviceInfo[] = [];
  private currentDeviceIndex = 0;
  private lastScanTimestamp = 0;
  private readonly scanCooldownMs = 1500;

  ngOnInit(): void {
    this.initDevices();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  async initDevices(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.videoDevices = devices.filter((d) => d.kind === 'videoinput');
      this.hasMultipleCameras.set(this.videoDevices.length > 1);
    } catch {
      // Permissions not yet granted for enumeration
    }
  }

  async startCamera(): Promise<void> {
    this.permissionError.set(null);
    try {
      this.codeReader = new BrowserMultiFormatReader();

      const onScanCallback = (result: any) => {
        if (result) {
          this.handleDetectedBarcode(result.getText());
        }
      };

      // Stage 1: Ideal rear-camera with HD resolution
      try {
        this.scannerControls = await this.codeReader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          this.videoRef.nativeElement,
          onScanCallback
        );
      } catch (err1) {
        console.warn('HD Environment constraint failed, trying simple environment mode:', err1);
        // Stage 2: Simple environment facing mode
        try {
          this.scannerControls = await this.codeReader.decodeFromConstraints(
            { video: { facingMode: 'environment' } },
            this.videoRef.nativeElement,
            onScanCallback
          );
        } catch (err2) {
          console.warn('Simple environment mode failed, falling back to any available video stream:', err2);
          // Stage 3: Universal fallback to any active camera
          this.scannerControls = await this.codeReader.decodeFromConstraints(
            { video: true },
            this.videoRef.nativeElement,
            onScanCallback
          );
        }
      }

      this.isScanning.set(true);

      // Check for torch capability
      this.checkTorchSupport();
    } catch (err: any) {
      this.isScanning.set(false);
      this.permissionError.set(err.message || 'Camera permission denied or camera not accessible.');
      this.toastService.error('Camera could not be activated: ' + (err.message || 'Check permissions'));
    }
  }

  private checkTorchSupport(): void {
    try {
      const stream = this.videoRef.nativeElement.srcObject as MediaStream;
      if (stream) {
        const track = stream.getVideoTracks()[0];
        const capabilities = (track as any).getCapabilities?.();
        if (capabilities && 'torch' in capabilities) {
          this.supportsTorch.set(true);
        }
      }
    } catch {
      this.supportsTorch.set(false);
    }
  }

  async toggleTorch(): Promise<void> {
    try {
      const stream = this.videoRef.nativeElement.srcObject as MediaStream;
      if (stream) {
        const track = stream.getVideoTracks()[0];
        const nextState = !this.isTorchOn();
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        this.isTorchOn.set(nextState);
      }
    } catch (err: any) {
      this.toastService.error('Could not toggle device flashlight.');
    }
  }

  async switchCamera(): Promise<void> {
    if (this.videoDevices.length <= 1) return;
    this.stopCamera();
    this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.videoDevices.length;
    setTimeout(() => {
      this.startCamera();
    }, 200);
  }

  stopCamera(): void {
    if (this.scannerControls) {
      this.scannerControls.stop();
      this.scannerControls = null;
    }

    if (this.videoRef && this.videoRef.nativeElement && this.videoRef.nativeElement.srcObject) {
      const stream = this.videoRef.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      this.videoRef.nativeElement.srcObject = null;
    }

    this.isScanning.set(false);
    this.isTorchOn.set(false);
  }

  handleDetectedBarcode(code: string): void {
    const now = Date.now();
    // Cooldown check to prevent accidental multiple hits of the same code
    if (now - this.lastScanTimestamp < this.scanCooldownMs && this.lastScannedCode() === code) {
      return;
    }

    this.lastScanTimestamp = now;
    this.lastScannedCode.set(code);
    this.playScanFeedback();
    this.lookupCode(code);
  }

  onManualSubmit(): void {
    const code = this.manualBarcodeInput.trim();
    if (!code) return;
    this.lastScannedCode.set(code);
    this.playScanFeedback();
    this.lookupCode(code);
    this.manualBarcodeInput = '';
  }

  lookupCode(code: string): void {
    this.isLookingUp.set(true);
    this.matchedProduct.set(null);
    this.unknownCode.set(null);

    this.api.lookupBarcode(code).subscribe({
      next: (res) => {
        this.isLookingUp.set(false);
        if (res.data.found && res.data.product) {
          this.matchedProduct.set(res.data.product);
          this.toastService.success(`Recognized: ${res.data.product.name}`);
        } else {
          this.unknownCode.set(code);
          this.toastService.info(`Barcode '${code}' not found in catalog.`);
        }
      },
      error: () => {
        this.isLookingUp.set(false);
      },
    });
  }

  // Audio & Vibration Feedback (Web Audio API Synthesizer)
  private playScanFeedback(): void {
    // 1. Vibration
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    // 2. Audio Beep
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      // Audio not permitted in background context
    }
  }

  addToSale(product: Product): void {
    // Navigate to sales POS screen with product preselected
    this.router.navigate(['/sales'], { queryParams: { addProductId: product._id } });
  }

  addToPurchase(product: Product): void {
    this.router.navigate(['/purchases'], { queryParams: { addProductId: product._id } });
  }

  registerNewProductWithBarcode(): void {
    this.router.navigate(['/products'], { queryParams: { newBarcode: this.unknownCode() } });
  }

  downloadBarcodeSticker(product: Product): void {
    this.pdfService.generateBarcodeStickerPdf(product);
    this.toastService.info(`Barcode sticker generated for '${product.sku}'`);
  }
}
