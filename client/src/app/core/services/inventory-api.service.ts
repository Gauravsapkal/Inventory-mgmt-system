import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface Category {
  _id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface Product {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: Category | string;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStock: number;
  uom: string;
  imageUrl?: string;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface Supplier {
  _id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  active: boolean;
}

export interface PurchaseItem {
  product: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface Purchase {
  _id: string;
  purchaseNumber: string;
  supplier: Supplier | any;
  purchaseDate: string;
  receivedDate?: string;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'received' | 'cancelled';
  notes?: string;
  receivedBy?: any;
}

export interface SaleItem {
  product: string | Product;
  productName: string;
  sku: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  lineTotal: number;
}

export interface Sale {
  _id: string;
  invoiceNumber: string;
  saleDate: string;
  customerName: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'other';
  processedBy: any;
  status: 'completed' | 'cancelled';
  notes?: string;
}

export interface StockMovement {
  _id: string;
  product: Product;
  movementType: 'purchase' | 'sale' | 'adjustment' | 'reversal';
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  referenceType?: string;
  user: any;
  reason?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalUnitsInStock: number;
  inventoryAssetValue: number;
  todaySales: {
    amount: number;
    count: number;
  };
  monthlySales: {
    amount: number;
    count: number;
  };
  lowStockProducts: number;
  outOfStockProducts: number;
  recentSales: Sale[];
  recentPurchases: Purchase[];
  dailySalesTrend: { _id: string; totalSales: number; count: number }[];
  topSellingProducts: { _id: string; name: string; sku: string; totalQuantitySold: number; totalRevenue: number }[];
  categoryDistribution: { categoryId: string; categoryName: string; itemCount: number; totalStock: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class InventoryApiService {
  private http = inject(HttpClient);
  
  private get baseUrl(): string {
    if (typeof window !== 'undefined') {
      const customApi = localStorage.getItem('ERP_API_URL');
      if (customApi) return customApi.replace(/\/+$/, '');
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
      }
      return '/api';
    }
    return '/api';
  }

  // --- Categories ---
  getCategories(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(`${this.baseUrl}/categories`);
  }

  createCategory(payload: Partial<Category>): Observable<ApiResponse<Category>> {
    return this.http.post<ApiResponse<Category>>(`${this.baseUrl}/categories`, payload);
  }

  updateCategory(id: string, payload: Partial<Category>): Observable<ApiResponse<Category>> {
    return this.http.put<ApiResponse<Category>>(`${this.baseUrl}/categories/${id}`, payload);
  }

  deleteCategory(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/categories/${id}`);
  }

  // --- Products ---
  getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    stockFilter?: 'low' | 'out' | 'all';
    status?: 'active' | 'archived' | 'all';
  }): Observable<ApiResponse<Product[]>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          httpParams = httpParams.set(key, val.toString());
        }
      });
    }
    return this.http.get<ApiResponse<Product[]>>(`${this.baseUrl}/products`, { params: httpParams });
  }

  getProductById(id: string): Observable<ApiResponse<Product>> {
    return this.http.get<ApiResponse<Product>>(`${this.baseUrl}/products/${id}`);
  }

  createProduct(payload: any): Observable<ApiResponse<Product>> {
    return this.http.post<ApiResponse<Product>>(`${this.baseUrl}/products`, payload);
  }

  updateProduct(id: string, payload: any): Observable<ApiResponse<Product>> {
    return this.http.put<ApiResponse<Product>>(`${this.baseUrl}/products/${id}`, payload);
  }

  deleteProduct(id: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/products/${id}`);
  }

  // --- Suppliers ---
  getSuppliers(search?: string): Observable<ApiResponse<Supplier[]>> {
    const params = search ? new HttpParams().set('search', search) : undefined;
    return this.http.get<ApiResponse<Supplier[]>>(`${this.baseUrl}/suppliers`, { params });
  }

  createSupplier(payload: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.http.post<ApiResponse<Supplier>>(`${this.baseUrl}/suppliers`, payload);
  }

  updateSupplier(id: string, payload: Partial<Supplier>): Observable<ApiResponse<Supplier>> {
    return this.http.put<ApiResponse<Supplier>>(`${this.baseUrl}/suppliers/${id}`, payload);
  }

  deleteSupplier(id: string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.baseUrl}/suppliers/${id}`);
  }

  // --- Purchases ---
  getPurchases(page = 1, limit = 20, status?: string): Observable<ApiResponse<Purchase[]>> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<Purchase[]>>(`${this.baseUrl}/purchases`, { params });
  }

  getPurchaseById(id: string): Observable<ApiResponse<Purchase>> {
    return this.http.get<ApiResponse<Purchase>>(`${this.baseUrl}/purchases/${id}`);
  }

  createPurchase(payload: any): Observable<ApiResponse<Purchase>> {
    return this.http.post<ApiResponse<Purchase>>(`${this.baseUrl}/purchases`, payload);
  }

  receivePurchase(id: string): Observable<ApiResponse<Purchase>> {
    return this.http.post<ApiResponse<Purchase>>(`${this.baseUrl}/purchases/${id}/receive`, {});
  }

  cancelPurchase(id: string): Observable<ApiResponse<Purchase>> {
    return this.http.post<ApiResponse<Purchase>>(`${this.baseUrl}/purchases/${id}/cancel`, {});
  }

  // --- Sales ---
  getSales(page = 1, limit = 20, search?: string): Observable<ApiResponse<Sale[]>> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    if (search) params = params.set('search', search);
    return this.http.get<ApiResponse<Sale[]>>(`${this.baseUrl}/sales`, { params });
  }

  getSaleById(id: string): Observable<ApiResponse<Sale>> {
    return this.http.get<ApiResponse<Sale>>(`${this.baseUrl}/sales/${id}`);
  }

  createSale(payload: any): Observable<ApiResponse<Sale>> {
    return this.http.post<ApiResponse<Sale>>(`${this.baseUrl}/sales`, payload);
  }

  // --- Barcode Scanner ---
  lookupBarcode(code: string): Observable<ApiResponse<{ found: boolean; code: string; product: Product | null }>> {
    return this.http.get<ApiResponse<{ found: boolean; code: string; product: Product | null }>>(
      `${this.baseUrl}/barcodes/${encodeURIComponent(code)}`
    );
  }

  // --- Stock Movements ---
  getStockMovements(page = 1, limit = 20, productId?: string): Observable<ApiResponse<StockMovement[]>> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    if (productId) params = params.set('productId', productId);
    return this.http.get<ApiResponse<StockMovement[]>>(`${this.baseUrl}/stock-movements`, { params });
  }

  createStockAdjustment(payload: { productId: string; newQuantity: number; reason: string }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/stock-movements/adjust`, payload);
  }

  // --- Dashboard ---
  getDashboardStats(): Observable<ApiResponse<DashboardStats>> {
    return this.http.get<ApiResponse<DashboardStats>>(`${this.baseUrl}/dashboard/stats`);
  }

  // --- Reports ---
  getInventoryReport(params?: any): Observable<ApiResponse<Product[]>> {
    return this.http.get<ApiResponse<Product[]>>(`${this.baseUrl}/reports/inventory`, { params });
  }

  getSalesReport(params?: any): Observable<ApiResponse<{ summary: any; sales: Sale[] }>> {
    return this.http.get<ApiResponse<{ summary: any; sales: Sale[] }>>(`${this.baseUrl}/reports/sales`, { params });
  }

  getPurchasesReport(params?: any): Observable<ApiResponse<{ summary: any; purchases: Purchase[] }>> {
    return this.http.get<ApiResponse<{ summary: any; purchases: Purchase[] }>>(`${this.baseUrl}/reports/purchases`, { params });
  }

  // --- Users (Admin) ---
  getUsers(page = 1, limit = 20, search?: string): Observable<ApiResponse<any[]>> {
    let params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());
    if (search) params = params.set('search', search);
    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/users`, { params });
  }

  createUser(payload: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.baseUrl}/users`, payload);
  }

  updateUserStatus(id: string, status: 'active' | 'disabled'): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.baseUrl}/users/${id}/status`, { status });
  }
}
