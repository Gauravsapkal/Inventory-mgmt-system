import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { InventoryApiService, Product, Category } from '../../core/services/inventory-api.service';
import { LayoutService } from '../../core/services/layout.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  template: `
    <div class="products-page">
      <!-- HEADER -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Product Inventory</h1>
          <p class="page-subtitle">Manage catalog items, barcodes, SKUs, and stock thresholds</p>
        </div>
        <div class="header-actions">
          <a routerLink="/scanner" class="btn btn-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            </svg>
            <span>Scan to Find</span>
          </a>
          @if (authService.isAdmin()) {
            <button class="btn btn-primary" (click)="openProductModal()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>Add Product</span>
            </button>
          }
        </div>
      </div>

      <!-- FILTER & SEARCH TOOLBAR -->
      <div class="card toolbar-card">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            class="form-control search-input"
            placeholder="Search by product name, SKU, or barcode..."
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearchChange()"
          />
        </div>

        <div class="filter-controls">
          <select class="form-control filter-select" [(ngModel)]="selectedCategory" (change)="loadProducts()">
            <option value="">All Categories</option>
            @for (cat of categories(); track cat._id) {
              <option [value]="cat._id">{{ cat.name }}</option>
            }
          </select>

          <select class="form-control filter-select" [(ngModel)]="stockFilter" (change)="loadProducts()">
            <option value="all">All Stock Statuses</option>
            <option value="low">Low Stock Only (&le; Reorder Level)</option>
            <option value="out">Out of Stock Only (0 units)</option>
          </select>
        </div>
      </div>

      <!-- DATA PRESENTATION (Desktop Table vs Mobile Cards) -->
      @if (isLoading()) {
        <div class="card loading-state">
          <div class="spinner"></div>
          <p>Loading products catalog...</p>
        </div>
      } @else if (products().length === 0) {
        <div class="card empty-state">
          <div class="empty-icon">📦</div>
          <h3>No products found</h3>
          <p>No inventory items match your current search query or filter criteria.</p>
          @if (authService.isAdmin()) {
            <button class="btn btn-primary btn-sm" (click)="openProductModal()">Create New Product</button>
          }
        </div>
      } @else {
        <!-- DESKTOP TABLE VIEW (breakpoint >= 768px) -->
        @if (!layout.isMobile()) {
          <div class="table-container card">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>SKU / Barcode</th>
                  <th>Category</th>
                  <th>Cost / Price</th>
                  <th>Stock Level</th>
                  <th>Status</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (prod of products(); track prod._id) {
                  <tr>
                    <td>
                      <div class="product-cell-name">
                        <span class="p-name">{{ prod.name }}</span>
                        @if (prod.description) {
                          <span class="p-desc">{{ prod.description }}</span>
                        }
                      </div>
                    </td>
                    <td>
                      <div class="sku-cell">
                        <span class="font-mono sku-tag">{{ prod.sku }}</span>
                        @if (prod.barcode) {
                          <span class="barcode-tag font-mono">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                            </svg>
                            {{ prod.barcode }}
                          </span>
                        }
                      </div>
                    </td>
                    <td>
                      <span class="cat-badge">{{ getCategoryName(prod.category) }}</span>
                    </td>
                    <td>
                      <div class="price-cell font-mono">
                        <span class="sell-price">₹{{ prod.sellingPrice.toFixed(2) }}</span>
                        <span class="cost-price">Cost: ₹{{ prod.purchasePrice.toFixed(2) }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="stock-cell">
                        <span class="stock-qty font-mono">{{ prod.currentStock }} {{ prod.uom }}</span>
                        @if (prod.currentStock <= 0) {
                          <span class="badge badge-danger">Out of Stock</span>
                        } @else if (prod.currentStock <= prod.minStock) {
                          <span class="badge badge-warning">Low Stock (Min: {{ prod.minStock }})</span>
                        } @else {
                          <span class="badge badge-success">In Stock</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span class="badge" [class.badge-info]="prod.status === 'active'" [class.badge-warning]="prod.status === 'archived'">
                        {{ prod.status | uppercase }}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <div class="row-actions">
                        @if (authService.isAdmin()) {
                          <button class="icon-action-btn" (click)="editProduct(prod)" title="Edit product">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                          </button>
                          <button class="icon-action-btn text-danger" (click)="archiveProduct(prod)" title="Archive or delete product">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <!-- MOBILE CARD LIST VIEW (breakpoint < 768px) -->
          <div class="mobile-card-list">
            @for (prod of products(); track prod._id) {
              <div class="card product-card-mobile">
                <div class="card-mobile-top">
                  <div class="mobile-prod-info">
                    <span class="prod-mobile-name">{{ prod.name }}</span>
                    <span class="prod-mobile-cat">{{ getCategoryName(prod.category) }}</span>
                  </div>
                  @if (prod.currentStock <= 0) {
                    <span class="badge badge-danger">Out of Stock</span>
                  } @else if (prod.currentStock <= prod.minStock) {
                    <span class="badge badge-warning">Low Stock</span>
                  } @else {
                    <span class="badge badge-success">In Stock</span>
                  }
                </div>

                <div class="card-mobile-middle">
                  <div class="font-mono mobile-meta-row">
                    <span class="sku-tag">{{ prod.sku }}</span>
                    @if (prod.barcode) {
                      <span class="barcode-tag">{{ prod.barcode }}</span>
                    }
                  </div>
                  <div class="mobile-financial-row">
                    <span class="mobile-price font-mono">₹{{ prod.sellingPrice.toFixed(2) }}</span>
                    <span class="mobile-stock font-mono">{{ prod.currentStock }} {{ prod.uom }} in stock</span>
                  </div>
                </div>

                @if (authService.isAdmin()) {
                  <div class="card-mobile-actions">
                    <button class="btn btn-secondary btn-sm" (click)="editProduct(prod)">Edit</button>
                    <button class="btn btn-ghost btn-sm text-danger" (click)="archiveProduct(prod)">Archive</button>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- PAGINATION BAR -->
        <div class="pagination-bar card">
          <span class="pagination-info">
            Showing page {{ currentPage() }} of {{ totalPages() }} ({{ totalProducts() }} total items)
          </span>
          <div class="pagination-buttons">
            <button class="btn btn-secondary btn-sm" [disabled]="currentPage() <= 1" (click)="goToPage(currentPage() - 1)">
              &larr; Prev
            </button>
            <button class="btn btn-secondary btn-sm" [disabled]="currentPage() >= totalPages()" (click)="goToPage(currentPage() + 1)">
              Next &rarr;
            </button>
          </div>
        </div>
      }

      <!-- PRODUCT CREATE / EDIT MODAL -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-dialog card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ editingProduct() ? 'Edit Product' : 'Add New Product' }}</h3>
              <button class="icon-btn" (click)="closeModal()">&times;</button>
            </div>

            <form [formGroup]="productForm" (ngSubmit)="saveProduct()" class="modal-form">
              <div class="form-grid">
                <div class="form-group col-span-2">
                  <label class="form-label">Product Name *</label>
                  <input type="text" class="form-control" formControlName="name" placeholder="e.g. Wireless Mouse 2.4G" />
                </div>

                <div class="form-group">
                  <label class="form-label">SKU (Stock Keeping Unit) *</label>
                  <input type="text" class="form-control font-mono" formControlName="sku" placeholder="e.g. ELE-MOU-005" />
                </div>

                <div class="form-group">
                  <label class="form-label">Category *</label>
                  <select class="form-control" formControlName="category">
                    <option value="">Select Category</option>
                    @for (cat of categories(); track cat._id) {
                      <option [value]="cat._id">{{ cat.name }}</option>
                    }
                  </select>
                </div>

                <div class="form-group col-span-2">
                  <label class="form-label">Barcode Value (EAN-13 / Code-128)</label>
                  <div class="barcode-input-group">
                    <input type="text" class="form-control font-mono" formControlName="barcode" placeholder="Scan or enter barcode" />
                    <a routerLink="/scanner" (click)="closeModal()" class="btn btn-secondary btn-sm" title="Open scanner to capture code">
                      Scan Code
                    </a>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Purchase Cost (₹) *</label>
                  <input type="number" step="0.01" class="form-control" formControlName="purchasePrice" />
                </div>

                <div class="form-group">
                  <label class="form-label">Selling Price (₹) *</label>
                  <input type="number" step="0.01" class="form-control" formControlName="sellingPrice" />
                </div>

                <div class="form-group">
                  <label class="form-label">Current Stock *</label>
                  <input type="number" class="form-control" formControlName="currentStock" />
                </div>

                <div class="form-group">
                  <label class="form-label">Min Alert Stock Threshold *</label>
                  <input type="number" class="form-control" formControlName="minStock" />
                </div>

                <div class="form-group">
                  <label class="form-label">Unit of Measure (UOM)</label>
                  <input type="text" class="form-control" formControlName="uom" placeholder="e.g. pcs, box, kg" />
                </div>

                <div class="form-group">
                  <label class="form-label">Status</label>
                  <select class="form-control" formControlName="status">
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div class="form-group col-span-2">
                  <label class="form-label">Product Description</label>
                  <textarea class="form-control" formControlName="description" rows="2" placeholder="Optional details..."></textarea>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="productForm.invalid || isSubmitting()">
                  {{ isSubmitting() ? 'Saving...' : 'Save Product' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .products-page {
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
      .header-actions {
        display: flex;
        gap: 0.75rem;
      }
    }

    .toolbar-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      padding: 1rem 1.25rem;

      .search-input-wrapper {
        position: relative;
        flex: 1;
        min-width: 260px;

        .search-icon {
          position: absolute;
          left: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-subtle);
        }

        .search-input {
          padding-left: 2.5rem;
        }
      }

      .filter-controls {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;

        .filter-select {
          min-width: 170px;
        }
      }
    }

    /* Product Cell formatting */
    .product-cell-name {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;

      .p-name {
        font-weight: 600;
        color: var(--color-text-main);
      }
      .p-desc {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        max-width: 250px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .sku-cell {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .sku-tag {
        font-size: 0.8rem;
        font-weight: 600;
        color: #1e293b;
      }

      .barcode-tag {
        font-size: 0.75rem;
        color: #0369a1;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }
    }

    .cat-badge {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      background: #f1f5f9;
      border-radius: var(--radius-sm);
      color: #475569;
    }

    .price-cell {
      display: flex;
      flex-direction: column;

      .sell-price {
        font-weight: 700;
        color: var(--color-text-main);
      }
      .cost-price {
        font-size: 0.7rem;
        color: var(--color-text-muted);
      }
    }

    .stock-cell {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      .stock-qty {
        font-weight: 700;
      }
    }

    .row-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .icon-action-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      color: var(--color-text-muted);

      &:hover {
        background-color: var(--color-surface-hover);
        color: var(--color-text-main);
      }
    }

    /* Mobile Card List */
    .mobile-card-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .product-card-mobile {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      .card-mobile-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;

        .prod-mobile-name {
          font-weight: 700;
          font-size: 0.95rem;
          display: block;
        }
        .prod-mobile-cat {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          display: block;
        }
      }

      .card-mobile-middle {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--color-border-subtle);

        .mobile-meta-row {
          display: flex;
          gap: 0.75rem;
          font-size: 0.8rem;
        }

        .mobile-financial-row {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .mobile-price {
            font-size: 1.1rem;
            font-weight: 800;
            color: var(--color-primary);
          }
          .mobile-stock {
            font-size: 0.85rem;
            font-weight: 600;
          }
        }
      }

      .card-mobile-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--color-border-subtle);
      }
    }

    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.25rem;
      font-size: var(--font-size-sm);

      .pagination-buttons {
        display: flex;
        gap: 0.5rem;
      }
    }

    /* Modal */
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

    .modal-dialog {
      width: 100%;
      max-width: 640px;
      max-height: 90vh;
      overflow-y: auto;
      background: var(--color-surface);
      border-radius: var(--radius-xl);
      padding: 1.75rem;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--color-border);

      h3 { font-size: 1.25rem; font-weight: 700; }
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }

      .col-span-2 {
        grid-column: span 2;
        @media (max-width: 600px) {
          grid-column: span 1;
        }
      }
    }

    .barcode-input-group {
      display: flex;
      gap: 0.5rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);
    }

    .empty-state, .loading-state {
      text-align: center;
      padding: 3rem 1.5rem;

      .empty-icon { font-size: 3rem; margin-bottom: 0.75rem; }
      h3 { font-size: 1.25rem; font-weight: 700; }
      p { color: var(--color-text-muted); margin: 0.5rem 0 1.5rem; }
    }

    .spinner {
      margin: 0 auto 1rem;
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class ProductsComponent implements OnInit {
  private api = inject(InventoryApiService);
  private fb = inject(FormBuilder);
  layout = inject(LayoutService);
  toastService = inject(ToastService);
  authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  products = signal<Product[]>([]);
  categories = signal<Category[]>([]);
  isLoading = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);

  // Pagination & Filtering
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  totalProducts = signal<number>(0);
  searchQuery = '';
  selectedCategory = '';
  stockFilter: 'low' | 'out' | 'all' = 'all';

  // Modal State
  showModal = signal<boolean>(false);
  editingProduct = signal<Product | null>(null);

  productForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    sku: ['', [Validators.required]],
    barcode: [''],
    category: ['', [Validators.required]],
    description: [''],
    purchasePrice: [0, [Validators.required, Validators.min(0)]],
    sellingPrice: [0, [Validators.required, Validators.min(0)]],
    currentStock: [0, [Validators.required, Validators.min(0)]],
    minStock: [5, [Validators.required, Validators.min(0)]],
    uom: ['pcs', [Validators.required]],
    status: ['active'],
  });

  private searchDebounceTimer: any;

  ngOnInit(): void {
    this.loadCategories();

    // Check if query param pre-fills barcode from scanner
    this.route.queryParams.subscribe((params) => {
      if (params['newBarcode']) {
        this.openProductModal();
        this.productForm.patchValue({ barcode: params['newBarcode'] });
      }
      if (params['stockFilter']) {
        this.stockFilter = params['stockFilter'];
      }
      this.loadProducts();
    });
  }

  loadCategories(): void {
    this.api.getCategories().subscribe({
      next: (res) => {
        if (res.success) this.categories.set(res.data);
      },
    });
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.api
      .getProducts({
        page: this.currentPage(),
        limit: 20,
        search: this.searchQuery,
        category: this.selectedCategory,
        stockFilter: this.stockFilter,
      })
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res.success) {
            this.products.set(res.data);
            if (res.meta) {
              this.currentPage.set(res.meta.page || 1);
              this.totalPages.set(res.meta.totalPages || 1);
              this.totalProducts.set(res.meta.total || 0);
            }
          }
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  onSearchChange(): void {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.currentPage.set(1);
      this.loadProducts();
    }, 300);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.loadProducts();
  }

  getCategoryName(cat: any): string {
    if (!cat) return 'Uncategorized';
    if (typeof cat === 'object') return cat.name;
    const found = this.categories().find((c) => c._id === cat);
    return found ? found.name : 'Category';
  }

  openProductModal(): void {
    this.editingProduct.set(null);
    this.productForm.reset({
      name: '',
      sku: '',
      barcode: '',
      category: this.categories()[0]?._id || '',
      description: '',
      purchasePrice: 0,
      sellingPrice: 0,
      currentStock: 0,
      minStock: 5,
      uom: 'pcs',
      status: 'active',
    });
    this.showModal.set(true);
  }

  editProduct(prod: Product): void {
    this.editingProduct.set(prod);
    const catId = typeof prod.category === 'object' ? prod.category._id : prod.category;
    this.productForm.patchValue({
      name: prod.name,
      sku: prod.sku,
      barcode: prod.barcode || '',
      category: catId,
      description: prod.description || '',
      purchasePrice: prod.purchasePrice,
      sellingPrice: prod.sellingPrice,
      currentStock: prod.currentStock,
      minStock: prod.minStock,
      uom: prod.uom || 'pcs',
      status: prod.status,
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingProduct.set(null);
  }

  saveProduct(): void {
    if (this.productForm.invalid) return;

    this.isSubmitting.set(true);
    const formVal = this.productForm.value;

    const req$ = this.editingProduct()
      ? this.api.updateProduct(this.editingProduct()!._id, formVal)
      : this.api.createProduct(formVal);

    req$.subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.toastService.success(this.editingProduct() ? 'Product updated' : 'Product created');
        this.closeModal();
        this.loadProducts();
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  archiveProduct(prod: Product): void {
    if (confirm(`Are you sure you want to archive or remove '${prod.name}'?`)) {
      this.api.deleteProduct(prod._id).subscribe({
        next: (res) => {
          this.toastService.success(res.message || 'Product removed');
          this.loadProducts();
        },
      });
    }
  }
}
