import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);
  const token = authService.token();

  let modifiedReq = req;
  if (token) {
    modifiedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected server error occurred';

      if (error.error) {
        if (typeof error.error.error === 'string') {
          errorMessage = error.error.error;
        } else if (error.error.message) {
          errorMessage = error.error.message;
        }
      }

      if (error.status === 401) {
        // Token expired or invalid
        if (!req.url.includes('/auth/login')) {
          authService.logout();
          toastService.error('Session expired. Please log in again.');
        }
      } else if (error.status === 403) {
        toastService.error(errorMessage || 'Access denied.');
      } else if (error.status === 0) {
        toastService.error('Cannot connect to API server. Please check your network or backend server.');
      }

      return throwError(() => error);
    })
  );
};
