import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { InventoryApiService, Supplier } from '../../core/services/inventory-api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="suppliers-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Supplier Management</h1>
          <p class="page-subtitle">Vendor directory, contact profiles, and procurement history</p>
        </div>
        @if (authService.isAdmin()) {
          <button class="btn btn-primary" (click)="openModal()">+ Add Supplier</button>
        }
      </div>

      <div class="card toolbar-card">
        <input
          type="text"
          class="form-control"
          placeholder="Search suppliers by name, contact person, or phone..."
          [(ngModel)]="searchQuery"
          (ngModelChange)="loadSuppliers()"
        />
      </div>

      <div class="card table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Contact Person</th>
              <th>Phone / Email</th>
              <th>Address</th>
              <th>Status</th>
              @if (authService.isAdmin()) {
                <th style="text-align: right;">Actions</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (sup of suppliers(); track sup._id) {
              <tr>
                <td class="font-bold">{{ sup.name }}</td>
                <td>{{ sup.contactPerson || '--' }}</td>
                <td>
                  <div>{{ sup.phone || '--' }}</div>
                  <div class="text-muted" style="font-size: 0.75rem;">{{ sup.email }}</div>
                </td>
                <td class="text-muted">{{ sup.address || '--' }}</td>
                <td>
                  <span class="badge" [class.badge-success]="sup.active" [class.badge-warning]="!sup.active">
                    {{ sup.active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                @if (authService.isAdmin()) {
                  <td style="text-align: right;">
                    <div class="row-actions">
                      <button class="icon-action-btn" (click)="editSupplier(sup)">Edit</button>
                      <button class="icon-action-btn text-danger" (click)="deleteSupplier(sup)">Deactivate</button>
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
              <h3>{{ editingSupplier() ? 'Edit Supplier' : 'New Supplier' }}</h3>
              <button class="icon-btn" (click)="showModal.set(false)">&times;</button>
            </div>
            <form [formGroup]="supForm" (ngSubmit)="saveSupplier()">
              <div class="form-group">
                <label class="form-label">Company Name *</label>
                <input type="text" class="form-control" formControlName="name" placeholder="e.g. Apex Wholesalers Ltd" />
              </div>
              <div class="form-group">
                <label class="form-label">Contact Person</label>
                <input type="text" class="form-control" formControlName="contactPerson" placeholder="e.g. Suresh Kumar" />
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="tel" class="form-control" formControlName="phone" placeholder="+91 9876543210" />
              </div>
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <input type="email" class="form-control" formControlName="email" placeholder="vendor@example.com" />
              </div>
              <div class="form-group">
                <label class="form-label">Address</label>
                <textarea class="form-control" formControlName="address" rows="2"></textarea>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="showModal.set(false)">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="supForm.invalid">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .suppliers-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .page-title { font-size: var(--font-size-xl); font-weight: 800; }
    .font-bold { font-weight: 600; }
    .text-muted { color: var(--color-text-muted); }
    .toolbar-card { padding: 0.75rem 1rem; }
    .row-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .icon-action-btn { padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem; border: 1px solid var(--color-border); }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
    .modal-dialog { width: 100%; max-width: 520px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `],
})
export class SuppliersComponent implements OnInit {
  private api = inject(InventoryApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  authService = inject(AuthService);

  suppliers = signal<Supplier[]>([]);
  searchQuery = '';
  showModal = signal<boolean>(false);
  editingSupplier = signal<Supplier | null>(null);

  supForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    contactPerson: [''],
    phone: [''],
    email: [''],
    address: [''],
    notes: [''],
    active: [true],
  });

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers(): void {
    this.api.getSuppliers(this.searchQuery).subscribe({
      next: (res) => { if (res.success) this.suppliers.set(res.data); },
    });
  }

  openModal(): void {
    this.editingSupplier.set(null);
    this.supForm.reset({ name: '', active: true });
    this.showModal.set(true);
  }

  editSupplier(sup: Supplier): void {
    this.editingSupplier.set(sup);
    this.supForm.patchValue({ ...sup });
    this.showModal.set(true);
  }

  saveSupplier(): void {
    if (this.supForm.invalid) return;
    const req$ = this.editingSupplier()
      ? this.api.updateSupplier(this.editingSupplier()!._id, this.supForm.value as any)
      : this.api.createSupplier(this.supForm.value as any);

    req$.subscribe({
      next: () => {
        this.toast.success(this.editingSupplier() ? 'Supplier updated' : 'Supplier created');
        this.showModal.set(false);
        this.loadSuppliers();
      },
    });
  }

  deleteSupplier(sup: Supplier): void {
    if (confirm(`Remove/Deactivate supplier '${sup.name}'?`)) {
      this.api.deleteSupplier(sup._id).subscribe({
        next: () => {
          this.toast.success('Supplier deactivated');
          this.loadSuppliers();
        },
      });
    }
  }
}
