import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface RealtimeEvent<T = any> {
  type: string;
  data: T;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class RealtimeService implements OnDestroy {
  private authService = inject(AuthService);
  private ngZone = inject(NgZone);

  private eventSource: EventSource | null = null;
  private reconnectTimer: any = null;

  private stockUpdatedSubject = new Subject<any>();
  private saleCreatedSubject = new Subject<any>();
  private productChangedSubject = new Subject<any>();

  public stockUpdated$: Observable<any> = this.stockUpdatedSubject.asObservable();
  public saleCreated$: Observable<any> = this.saleCreatedSubject.asObservable();
  public productChanged$: Observable<any> = this.productChangedSubject.asObservable();

  constructor() {
    this.initRealtimeConnection();
  }

  public initRealtimeConnection(): void {
    if (typeof window === 'undefined') return;

    const token = this.authService.token();
    if (!token) return;

    this.disconnect();

    const baseUrl = this.getEventsUrl(token);

    try {
      this.eventSource = new EventSource(baseUrl);

      this.eventSource.addEventListener('connected', (e: MessageEvent) => {
        // Connected to server
      });

      this.eventSource.addEventListener('stock_updated', (e: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const data = JSON.parse(e.data);
            this.stockUpdatedSubject.next(data);
          } catch (err) {}
        });
      });

      this.eventSource.addEventListener('sale_created', (e: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const data = JSON.parse(e.data);
            this.saleCreatedSubject.next(data);
          } catch (err) {}
        });
      });

      this.eventSource.addEventListener('product_created', (e: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const data = JSON.parse(e.data);
            this.productChangedSubject.next({ action: 'created', product: data });
          } catch (err) {}
        });
      });

      this.eventSource.addEventListener('product_updated', (e: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const data = JSON.parse(e.data);
            this.productChangedSubject.next({ action: 'updated', product: data });
          } catch (err) {}
        });
      });

      this.eventSource.addEventListener('product_deleted', (e: MessageEvent) => {
        this.ngZone.run(() => {
          try {
            const data = JSON.parse(e.data);
            this.productChangedSubject.next({ action: 'deleted', id: data.id });
          } catch (err) {}
        });
      });

      this.eventSource.onerror = () => {
        this.disconnect();
        // Exponential backoff reconnect
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.initRealtimeConnection();
          }, 5000);
        }
      };
    } catch (err) {
      console.warn('Realtime SSE initialization skipped:', err);
    }
  }

  private getEventsUrl(token: string): string {
    const customApi = localStorage.getItem('ERP_API_URL');
    if (customApi) {
      return `${customApi.replace(/\/+$/, '')}/events?token=${encodeURIComponent(token)}`;
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `http://localhost:5000/api/events?token=${encodeURIComponent(token)}`;
    }
    return `/api/events?token=${encodeURIComponent(token)}`;
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
