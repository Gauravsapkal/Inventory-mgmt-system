import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  toasts = signal<ToastMessage[]>([]);

  show(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', durationMs = 3500): void {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, message, type };

    this.toasts.update((current) => [...current, newToast]);

    setTimeout(() => {
      this.dismiss(id);
    }, durationMs);
  }

  success(message: string, durationMs = 3500): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 4500): void {
    this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs = 3500): void {
    this.show(message, 'info', durationMs);
  }

  warning(message: string, durationMs = 4000): void {
    this.show(message, 'warning', durationMs);
  }

  dismiss(id: string): void {
    this.toasts.update((current) => current.filter((t) => t.id !== id));
  }
}
