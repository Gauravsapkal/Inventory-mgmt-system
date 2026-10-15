import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LayoutService } from '../core/services/layout.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-shell" [class.sidebar-collapsed]="layout.isSidebarCollapsed()">
      <!-- Toast Container -->
      <div class="toast-container">
        @for (toast of toastService.toasts(); track toast.id) {
          <div class="toast" [ngClass]="'toast-' + toast.type">
            <span>{{ toast.message }}</span>
            <button class="toast-close" (click)="toastService.dismiss(toast.id)">&times;</button>
          </div>
        }
      </div>

      <!-- DESKTOP / TABLET SIDEBAR -->
      <aside class="app-sidebar no-print" [class.collapsed]="layout.isSidebarCollapsed()">
        <div class="sidebar-brand">
          <div class="brand-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              <path d="m3.3 7 8.7 5 8.7-5"/>
              <path d="M12 22V12"/>
            </svg>
          </div>
          @if (!layout.isSidebarCollapsed()) {
            <div class="brand-text">
              <span class="brand-title">Inventory ERP</span>
              <span class="brand-subtitle">MCA Mini Project</span>
            </div>
          }
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item" title="Dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
              <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Dashboard</span> }
          </a>

          <a routerLink="/products" routerLinkActive="active" class="nav-item" title="Products">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              <path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Products</span> }
          </a>

          <a routerLink="/categories" routerLinkActive="active" class="nav-item" title="Categories">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Categories</span> }
          </a>

          <a routerLink="/suppliers" routerLinkActive="active" class="nav-item" title="Suppliers">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Suppliers</span> }
          </a>

          <a routerLink="/purchases" routerLinkActive="active" class="nav-item" title="Purchases">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Purchases</span> }
          </a>

          <a routerLink="/sales" routerLinkActive="active" class="nav-item" title="Sales (POS)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Sales (POS)</span> }
          </a>

          <a routerLink="/scanner" routerLinkActive="active" class="nav-item scanner-highlight" title="Barcode Scanner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <line x1="7" x2="17" y1="12" y2="12"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Barcode Scanner</span> }
          </a>

          <a routerLink="/stock-movements" routerLinkActive="active" class="nav-item" title="Stock History">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20v-6M6 20V10M18 20V4"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Stock History</span> }
          </a>

          <a routerLink="/reports" routerLinkActive="active" class="nav-item" title="Reports">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
              <line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Reports</span> }
          </a>

          @if (authService.isAdmin()) {
            <a routerLink="/users" routerLinkActive="active" class="nav-item" title="User Management">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              @if (!layout.isSidebarCollapsed()) { <span>User Accounts</span> }
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <button (click)="layout.toggleSidebar()" class="btn-toggle-sidebar" [title]="layout.isSidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path [attr.d]="layout.isSidebarCollapsed() ? 'M13 17l5-5-5-5M6 17l5-5-5-5' : 'M11 17l-5-5 5-5M18 17l-5-5 5-5'"/>
            </svg>
            @if (!layout.isSidebarCollapsed()) { <span>Collapse Menu</span> }
          </button>
        </div>
      </aside>

      <!-- MAIN WRAPPER -->
      <div class="main-wrapper">
        <!-- TOP APP BAR -->
        <header class="app-topbar no-print">
          <div class="topbar-left">
            @if (layout.isMobile()) {
              <button class="icon-btn" (click)="layout.toggleMobileDrawer()" aria-label="Toggle Navigation Drawer">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            }
            <div class="page-title">
              <h2>Inventory Management System</h2>
            </div>
          </div>

          <div class="topbar-right">
            <div class="user-chip">
              <div class="user-avatar">{{ authService.currentUser()?.name?.charAt(0) || 'U' }}</div>
              <div class="user-details hide-mobile">
                <span class="user-name">{{ authService.currentUser()?.name || 'User' }}</span>
                <span class="user-role badge" [class.badge-info]="authService.isAdmin()" [class.badge-warning]="!authService.isAdmin()">
                  {{ authService.currentUser()?.role | uppercase }}
                </span>
              </div>
            </div>

            <button class="btn btn-secondary btn-sm" (click)="authService.logout()" title="Logout from system">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span class="hide-mobile">Logout</span>
            </button>
          </div>
        </header>

        <!-- ROUTER OUTLET CONTAINER -->
        <main class="main-content" [class.with-bottom-nav]="layout.isMobile()">
          <router-outlet></router-outlet>
        </main>

        <!-- MOBILE BOTTOM NAVIGATION BAR -->
        @if (layout.isMobile()) {
          <nav class="app-bottom-nav no-print">
            <a routerLink="/dashboard" routerLinkActive="active" class="bottom-nav-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
                <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
              </svg>
              <span>Dashboard</span>
            </a>

            <a routerLink="/products" routerLinkActive="active" class="bottom-nav-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              </svg>
              <span>Products</span>
            </a>

            <!-- Prominent Central Barcode Scan Action -->
            <a routerLink="/scanner" routerLinkActive="active" class="bottom-nav-item bottom-scan-btn">
              <div class="scan-pill">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <line x1="7" x2="17" y1="12" y2="12"/>
                </svg>
              </div>
              <span>Scan</span>
            </a>

            <a routerLink="/sales" routerLinkActive="active" class="bottom-nav-item">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/>
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
              </svg>
              <span>Sales</span>
            </a>

            <button class="bottom-nav-item" (click)="layout.toggleMobileDrawer()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
              </svg>
              <span>More</span>
            </button>
          </nav>
        }

        <!-- MOBILE SLIDE-IN DRAWER OVERLAY -->
        @if (layout.isMobile() && layout.isMobileDrawerOpen()) {
          <div class="drawer-backdrop" (click)="layout.closeMobileDrawer()"></div>
          <div class="mobile-drawer">
            <div class="drawer-header">
              <div class="brand-text">
                <span class="brand-title">ERP Navigation</span>
                <span class="brand-subtitle">{{ authService.currentUser()?.email }}</span>
              </div>
              <button class="icon-btn" (click)="layout.closeMobileDrawer()">&times;</button>
            </div>

            <div class="drawer-nav">
              <a routerLink="/categories" (click)="layout.closeMobileDrawer()" class="drawer-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                <span>Categories</span>
              </a>
              <a routerLink="/suppliers" (click)="layout.closeMobileDrawer()" class="drawer-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                <span>Suppliers</span>
              </a>
              <a routerLink="/purchases" (click)="layout.closeMobileDrawer()" class="drawer-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/></svg>
                <span>Purchases</span>
              </a>
              <a routerLink="/stock-movements" (click)="layout.closeMobileDrawer()" class="drawer-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
                <span>Stock History</span>
              </a>
              <a routerLink="/reports" (click)="layout.closeMobileDrawer()" class="drawer-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                <span>Reports</span>
              </a>
              @if (authService.isAdmin()) {
                <a routerLink="/users" (click)="layout.closeMobileDrawer()" class="drawer-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>User Accounts</span>
                </a>
              }
            </div>

            <div class="drawer-footer">
              <button class="btn btn-danger btn-block" (click)="authService.logout()">
                Logout
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      min-height: 100dvh;
      background-color: var(--color-bg);
    }

    /* SIDEBAR (Desktop) */
    .app-sidebar {
      width: var(--sidebar-width);
      background-color: var(--color-sidebar);
      color: var(--color-sidebar-text);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 50;

      &.collapsed {
        width: var(--sidebar-collapsed-width);
      }

      @media (max-width: 767px) {
        display: none;
      }
    }

    .sidebar-brand {
      height: var(--topbar-height);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);

      .brand-logo {
        color: var(--color-primary);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .brand-title {
        display: block;
        font-weight: 700;
        font-size: 1rem;
        color: #ffffff;
      }

      .brand-subtitle {
        display: block;
        font-size: 0.7rem;
        color: var(--color-sidebar-text);
      }
    }

    .sidebar-nav {
      flex: 1;
      padding: 1rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-radius: var(--radius-md);
      color: var(--color-sidebar-text);
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.15s ease;

      &:hover {
        background-color: var(--color-sidebar-hover);
        color: #ffffff;
      }

      &.active {
        background-color: var(--color-sidebar-active);
        color: #ffffff;
        font-weight: 600;
      }

      &.scanner-highlight {
        color: #38bdf8;
        &.active {
          background-color: #0284c7;
          color: #ffffff;
        }
      }
    }

    .sidebar-footer {
      padding: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);

      .btn-toggle-sidebar {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem;
        color: var(--color-sidebar-text);
        border-radius: var(--radius-md);
        font-size: 0.8rem;

        &:hover {
          background-color: var(--color-sidebar-hover);
          color: #ffffff;
        }
      }
    }

    /* MAIN WRAPPER */
    .main-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 100dvh;
    }

    /* TOPBAR */
    .app-topbar {
      height: var(--topbar-height);
      background-color: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      position: sticky;
      top: 0;
      z-index: 40;

      @media (max-width: 767px) {
        padding: 0 1rem;
      }
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 1rem;

      .page-title h2 {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-text-main);

        @media (max-width: 480px) {
          font-size: 0.95rem;
        }
      }
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 0.65rem;

      .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: var(--color-primary-light);
        color: var(--color-primary);
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .user-details {
        display: flex;
        flex-direction: column;

        .user-name {
          font-size: 0.85rem;
          font-weight: 600;
        }
      }
    }

    .icon-btn {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      color: var(--color-text-main);

      &:hover {
        background-color: var(--color-surface-hover);
      }
    }

    /* MAIN CONTENT */
    .main-content {
      flex: 1;
      padding: 1.5rem;
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;

      &.with-bottom-nav {
        padding: 1rem;
        padding-bottom: calc(var(--bottomnav-height) + var(--safe-bottom) + 1.5rem);
      }
    }

    /* MOBILE BOTTOM NAV */
    .app-bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: calc(var(--bottomnav-height) + var(--safe-bottom));
      padding-bottom: var(--safe-bottom);
      background-color: var(--color-surface);
      border-top: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: space-around;
      z-index: 90;
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.05);
    }

    .bottom-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      height: 100%;
      color: var(--color-text-muted);
      font-size: 0.7rem;
      font-weight: 500;

      &.active {
        color: var(--color-primary);
        font-weight: 600;
      }

      &.bottom-scan-btn {
        margin-top: -18px;

        .scan-pill {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.45);
        }

        &.active .scan-pill {
          background: linear-gradient(135deg, #0284c7, #0369a1);
        }
      }
    }

    /* MOBILE DRAWER */
    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      z-index: 100;
      animation: fadeIn 0.2s ease;
    }

    .mobile-drawer {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      width: 280px;
      background-color: var(--color-surface);
      z-index: 101;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-float);
      animation: slideDrawer 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .drawer-header {
      padding: 1.25rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--color-border);
      background-color: var(--color-sidebar);
      color: #ffffff;

      .brand-title {
        font-weight: 700;
        font-size: 1rem;
        display: block;
      }
      .brand-subtitle {
        font-size: 0.75rem;
        color: #94a3b8;
        display: block;
      }
    }

    .drawer-nav {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .drawer-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius-md);
      color: var(--color-text-main);
      font-size: 0.9rem;
      font-weight: 500;

      &:hover {
        background-color: var(--color-surface-hover);
      }
    }

    .drawer-footer {
      padding: 1rem;
      border-top: 1px solid var(--color-border);
    }

    .btn-block {
      width: 100%;
    }

    .hide-mobile {
      @media (max-width: 767px) {
        display: none !important;
      }
    }

    .toast-close {
      color: #ffffff;
      font-size: 1.2rem;
      margin-left: 0.75rem;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideDrawer {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }
  `],
})
export class AppLayoutComponent {
  layout = inject(LayoutService);
  authService = inject(AuthService);
  toastService = inject(ToastService);
}
