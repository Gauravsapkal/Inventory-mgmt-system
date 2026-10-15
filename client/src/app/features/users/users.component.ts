import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { InventoryApiService } from '../../core/services/inventory-api.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="users-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">User Account Administration</h1>
          <p class="page-subtitle">Manage system staff and administrator access credentials</p>
        </div>
        <button class="btn btn-primary" (click)="openModal()">+ Add New User</button>
      </div>

      <div class="card toolbar-card">
        <input
          type="text"
          class="form-control"
          placeholder="Search users by name or email..."
          [(ngModel)]="searchQuery"
          (ngModelChange)="loadUsers()"
        />
      </div>

      <div class="card table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email Address</th>
              <th>System Role</th>
              <th>Account Status</th>
              <th>Last Active</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u._id) {
              <tr>
                <td class="font-bold">{{ u.name }}</td>
                <td>{{ u.email }}</td>
                <td>
                  <span class="badge" [class.badge-info]="u.role === 'admin'" [class.badge-warning]="u.role === 'staff'">
                    {{ u.role | uppercase }}
                  </span>
                </td>
                <td>
                  <span class="badge" [class.badge-success]="u.status === 'active'" [class.badge-danger]="u.status === 'disabled'">
                    {{ u.status | uppercase }}
                  </span>
                </td>
                <td class="text-muted" style="font-size: 0.8rem;">
                  {{ u.lastLogin ? (u.lastLogin | date:'medium') : 'Never logged in' }}
                </td>
                <td style="text-align: right;">
                  @if (u.email !== authService.currentUser()?.email) {
                    <button
                      class="btn btn-sm"
                      [class.btn-danger]="u.status === 'active'"
                      [class.btn-success]="u.status === 'disabled'"
                      (click)="toggleStatus(u)"
                    >
                      {{ u.status === 'active' ? 'Disable' : 'Enable' }}
                    </button>
                  } @else {
                    <span class="badge badge-info">Current User</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- CREATE USER MODAL -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="showModal.set(false)">
          <div class="modal-dialog card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Create User Account</h3>
              <button class="icon-btn" (click)="showModal.set(false)">&times;</button>
            </div>
            <form [formGroup]="userForm" (ngSubmit)="saveUser()">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <input type="text" class="form-control" formControlName="name" placeholder="e.g. Rahul Sharma" />
              </div>
              <div class="form-group">
                <label class="form-label">Email Address *</label>
                <input type="email" class="form-control" formControlName="email" placeholder="staff@inventory.local" />
              </div>
              <div class="form-group">
                <label class="form-label">Password * (min 6 characters)</label>
                <input type="password" class="form-control" formControlName="password" placeholder="Secure password" />
              </div>
              <div class="form-group">
                <label class="form-label">System Role *</label>
                <select class="form-control" formControlName="role">
                  <option value="staff">Staff (POS Sales, Barcode Scanning, Product Lookup)</option>
                  <option value="admin">Admin (Full System &amp; Inventory Management)</option>
                </select>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="showModal.set(false)">Cancel</button>
                <button type="submit" class="btn btn-primary" [disabled]="userForm.invalid">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .users-page { display: flex; flex-direction: column; gap: 1.25rem; }
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .page-title { font-size: var(--font-size-xl); font-weight: 800; }
    .page-subtitle { font-size: var(--font-size-sm); color: var(--color-text-muted); }
    .font-bold { font-weight: 600; }
    .text-muted { color: var(--color-text-muted); }
    .toolbar-card { padding: 0.75rem 1rem; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
    .modal-dialog { width: 100%; max-width: 480px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
  `],
})
export class UsersComponent implements OnInit {
  private api = inject(InventoryApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  authService = inject(AuthService);

  users = signal<any[]>([]);
  searchQuery = '';
  showModal = signal<boolean>(false);

  userForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['staff', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.api.getUsers(1, 50, this.searchQuery).subscribe({
      next: (res) => { if (res.success) this.users.set(res.data); },
    });
  }

  openModal(): void {
    this.userForm.reset({ role: 'staff' });
    this.showModal.set(true);
  }

  saveUser(): void {
    if (this.userForm.invalid) return;
    this.api.createUser(this.userForm.value).subscribe({
      next: () => {
        this.toast.success('User account created successfully');
        this.showModal.set(false);
        this.loadUsers();
      },
    });
  }

  toggleStatus(u: any): void {
    const nextStatus = u.status === 'active' ? 'disabled' : 'active';
    this.api.updateUserStatus(u._id, nextStatus).subscribe({
      next: () => {
        this.toast.success(`User status changed to ${nextStatus}`);
        this.loadUsers();
      },
    });
  }
}
