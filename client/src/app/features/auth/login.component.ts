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
          <img
            src="assets/store-logo.png"
            alt="Shree Ganesh Kirana Store"
            class="brand-logo-img"
            width="80"
            height="80"
          />
          <h1>Shree Ganesh Kirana Store</h1>
          <p>Inventory Management System</p>
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label class="form-label" for="email">Email Address</label>
            <input
              id="email"
              type="email"
              class="form-control"
              formControlName="email"
              placeholder="Enter your email address"
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
              <span class="spinner"></span> Signing In...
            } @else {
              Sign In
            }
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0d3320 0%, #1a6b34 50%, #2d8a4e 100%);
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

      .brand-logo-img {
        margin: 0 auto 1rem;
        display: block;
        border-radius: 12px;
        object-fit: contain;
      }

      h1 {
        font-size: 1.4rem;
        font-weight: 800;
        color: #1a6b34;
        line-height: 1.3;
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
        color: #1a6b34;
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

    .btn-primary {
      background: linear-gradient(135deg, #1a6b34, #2d8a4e) !important;
      border: none;
    }

    .btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #155a2b, #1a6b34) !important;
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
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

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
