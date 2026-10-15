import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { InventoryApiService, Category } from '../../core/services/inventory-api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="categories-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Product Categories</h1>
          <p class="page-subtitle">Organize and group your inventory items</p>
        </div>
        @if (authService.isAdmin()) {
          <button class="btn btn-primary" (click)="openModal()">+ Add Category</button>
        }
      </div>

      <div class="card table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Category Name</th>
              <th>Description</th>
              <th>Status</th>
              @if (authService.isAdmin()) {
                <th style="text-align: right;">Actions</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (cat of categories(); track cat._id) {
              <tr>
                <td class="font-bold">{{ cat.name }}</td>
                <td class="text-muted">{{ cat.description || 'No description provided' }}</td>
                <td>
                  <span class="badge" [class.badge-success]="cat.active" [class.badge-warning]="!cat.active">
                    {{ cat.active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                @if (authService.isAdmin()) {
                  <td style="text-align: right;">
                    <div class="row-actions">
                      <button class="icon-action-btn" (click)="editCategory(cat)">Edit</button>
                      <button class="icon-action-btn text-danger" (click)="deleteCategory(cat)">Delete</button>
                    </div>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- CREATE / EDIT MODAL -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="showModal.set(false)">
          <div class="modal-dialog card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>{{ editingCategory() ? 'Edit Category' : 'New Category' }}</h3>
              <button class="icon-btn" (click)="showModal.set(false)">&times;</button>
            </div>
            <form [formGroup]="catForm" (ngSubmit)="saveCategory()">
              <div class="form-group">
                <label class="form-label">Category Name *</label>
                <input type="text" class="form-control" formControlName="name" placeholder="e.g. Beverages" />
              </div>
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" formControlName="description" rows="3" placeholder="Category scope..."></textarea>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="showModal.set(false)">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="catForm.invalid">Save</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .categories-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .page-title { font-size: var(--font-size-xl); font-weight: 800; }
    .page-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .font-bold { font-weight: 600; }
    .text-muted { color: var(--color-text-muted); }
    .row-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .icon-action-btn { padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem; border: 1px solid var(--color-border); }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
    .modal-dialog { width: 100%; max-width: 480px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `],
})
export class CategoriesComponent implements OnInit {
  private api = inject(InventoryApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  authService = inject(AuthService);

  categories = signal<Category[]>([]);
  showModal = signal<boolean>(false);
  editingCategory = signal<Category | null>(null);

  catForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    active: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getCategories().subscribe({
      next: (res) => { if (res.success) this.categories.set(res.data); },
    });
  }

  openModal(): void {
    this.editingCategory.set(null);
    this.catForm.reset({ name: '', description: '', active: true });
    this.showModal.set(true);
  }

  editCategory(cat: Category): void {
    this.editingCategory.set(cat);
    this.catForm.patchValue({ name: cat.name, description: cat.description || '', active: cat.active });
    this.showModal.set(true);
  }

  saveCategory(): void {
    if (this.catForm.invalid) return;
    const req$ = this.editingCategory()
      ? this.api.updateCategory(this.editingCategory()!._id, this.catForm.value as any)
      : this.api.createCategory(this.catForm.value as any);

    req$.subscribe({
      next: () => {
        this.toast.success(this.editingCategory() ? 'Category updated' : 'Category created');
        this.showModal.set(false);
        this.load();
      },
    });
  }

  deleteCategory(cat: Category): void {
    if (confirm(`Delete category '${cat.name}'?`)) {
      this.api.deleteCategory(cat._id).subscribe({
        next: () => {
          this.toast.success('Category removed');
          this.load();
        },
      });
    }
  }
}
