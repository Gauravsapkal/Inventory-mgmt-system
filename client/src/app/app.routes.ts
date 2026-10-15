import { Routes } from '@angular/router';
import { authGuard, adminGuard, publicGuard } from './core/guards/auth.guard';
import { AppLayoutComponent } from './layout/app-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [publicGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/products.component').then((m) => m.ProductsComponent),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/categories.component').then((m) => m.CategoriesComponent),
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/suppliers/suppliers.component').then((m) => m.SuppliersComponent),
      },
      {
        path: 'purchases',
        loadComponent: () =>
          import('./features/purchases/purchases.component').then((m) => m.PurchasesComponent),
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./features/sales/sales.component').then((m) => m.SalesComponent),
      },
      {
        path: 'scanner',
        loadComponent: () =>
          import('./features/scanner/scanner.component').then((m) => m.BarcodeScannerComponent),
      },
      {
        path: 'stock-movements',
        loadComponent: () =>
          import('./features/stock-movements/stock-movements.component').then(
            (m) => m.StockMovementsComponent
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
