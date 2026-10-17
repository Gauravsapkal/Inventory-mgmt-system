import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  status: 'active' | 'disabled';
  lastLogin?: string;
}

interface LoginResponse {
  success: boolean;
  message?: string;
  data: {
    token: string;
    user: User;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private get API_URL(): string {
    if (typeof window !== 'undefined') {
      const customApi = localStorage.getItem('ERP_API_URL');
      if (customApi) return customApi.replace(/\/+$/, '');
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
      }
      return 'https://shree-ganesh-kirana-api.onrender.com/api';
    }
    return 'https://shree-ganesh-kirana-api.onrender.com/api';
  }

  currentUser = signal<User | null>(null);
  token = signal<string | null>(localStorage.getItem('erp_token'));

  isAuthenticated = computed(() => !!this.token());
  isAdmin = computed(() => this.currentUser()?.role === 'admin');

  constructor() {
    const savedUser = localStorage.getItem('erp_user');
    if (savedUser) {
      try {
        this.currentUser.set(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('erp_user');
      }
    }

    if (this.token()) {
      this.loadProfile().subscribe();
    }
  }

  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/auth/login`, credentials).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.token.set(res.data.token);
          this.currentUser.set(res.data.user);
          localStorage.setItem('erp_token', res.data.token);
          localStorage.setItem('erp_user', JSON.stringify(res.data.user));
        }
      })
    );
  }

  loadProfile(): Observable<any> {
    return this.http.get<{ success: boolean; data: User }>(`${this.API_URL}/auth/me`).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.currentUser.set(res.data);
          localStorage.setItem('erp_user', JSON.stringify(res.data));
        }
      }),
      catchError((err) => {
        if (err.status === 401 || err.status === 403) {
          this.logout();
        }
        return of(null);
      })
    );
  }

  logout(): void {
    if (this.token()) {
      this.http.post(`${this.API_URL}/auth/logout`, {}).subscribe({
        error: () => {}, // Ignore server error on logout
      });
    }

    this.token.set(null);
    this.currentUser.set(null);
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    this.router.navigate(['/login']);
  }
}
