import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-brand">
          <div class="brand-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              <path d="m3.3 7 8.7 5 8.7-5"/>
              <path d="M12 22V12"/>
            </svg>
          </div>
          <h1>Inventory ERP</h1>
          <p>MCA Mini Project &bull; Barcode Integration</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label class="form-label" for="email">Email Address</label>
            <input
              id="email"
              type="email"
              class="form-control"
              formControlName="email"
              placeholder="e.g. admin@inventory.local"
              autocomplete="email"
            />
            @if (loginForm.get('email')?.touched && loginForm.get('email')?.invalid) {
              <span class="field-error">Please enter a valid email address</span>
            }
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <div class="password-input-wrapper">
              <input
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                class="form-control"
                formControlName="password"
                placeholder="Enter password"
                autocomplete="current-password"
              />
              <button
                type="button"
                class="toggle-pwd-btn"
                (click)="showPassword.set(!showPassword())"
                tabindex="-1"
              >
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </div>
            @if (loginForm.get('password')?.touched && loginForm.get('password')?.invalid) {
              <span class="field-error">Password is required</span>
            }
          </div>

          <button
            type="submit"
            class="btn btn-primary btn-block"
            [disabled]="loginForm.invalid || isLoading()"
          >
            @if (isLoading()) {
              <span class="spinner"></span> Logging In...
            } @else {
              Sign In to System
            }
          </button>
        </form>

        <div class="demo-credentials">
          <div class="demo-title">Quick Demo Login:</div>
          <button type="button" class="btn btn-secondary btn-sm btn-block" (click)="fillAdminCredentials()">
            Auto-fill Default Admin (admin&#64;inventory.local)
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 1.5rem;
    }

    .login-card {
      width: 100%;
      max-width: 440px;
      background: #ffffff;
      border-radius: var(--radius-xl);
      padding: 2.5rem 2rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);

      @media (max-width: 480px) {
        padding: 2rem 1.25rem;
        border-radius: var(--radius-lg);
      }
    }

    .login-brand {
      text-align: center;
      margin-bottom: 2rem;

      .brand-icon {
        width: 60px;
        height: 60px;
        margin: 0 auto 1rem;
        background: #eff6ff;
        color: var(--color-primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      h1 {
        font-size: 1.5rem;
        font-weight: 800;
        color: #0f172a;
      }

      p {
        font-size: 0.85rem;
        color: #64748b;
        margin-top: 0.25rem;
      }
    }

    .password-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;

      input {
        padding-right: 4rem;
      }

      .toggle-pwd-btn {
        position: absolute;
        right: 0.75rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-primary);
        background: none;
      }
    }

    .field-error {
      color: var(--color-danger);
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }

    .btn-block {
      width: 100%;
    }

    .demo-credentials {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px dashed var(--color-border);
      text-align: center;

      .demo-title {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-text-muted);
        margin-bottom: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
    }

    .spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  showPassword = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  loginForm = this.fb.group({
    email: ['admin@inventory.local', [Validators.required, Validators.email]],
    password: ['Admin@123456', [Validators.required]],
  });

  fillAdminCredentials(): void {
    this.loginForm.patchValue({
      email: 'admin@inventory.local',
      password: 'Admin@123456',
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    const { email, password } = this.loginForm.value;

    this.authService.login({ email: email!, password: password! }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.toastService.success(`Welcome back, ${res.data.user.name}!`);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }
}
