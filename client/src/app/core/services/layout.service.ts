import { Injectable, signal, NgZone, inject } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  private ngZone = inject(NgZone);

  // Responsive signals
  isMobile = signal<boolean>(false);
  isTablet = signal<boolean>(false);
  isDesktop = signal<boolean>(true);

  // App shell state signals
  isSidebarCollapsed = signal<boolean>(false);
  isMobileDrawerOpen = signal<boolean>(false);

  constructor() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mobileQuery = window.matchMedia('(max-width: 767px)');
      const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
      const desktopQuery = window.matchMedia('(min-width: 1024px)');

      const updateBreakpoints = () => {
        this.ngZone.run(() => {
          const mobile = mobileQuery.matches;
          const tablet = tabletQuery.matches;
          const desktop = desktopQuery.matches;

          this.isMobile.set(mobile);
          this.isTablet.set(tablet);
          this.isDesktop.set(desktop);

          if (mobile) {
            this.isMobileDrawerOpen.set(false);
          } else if (tablet) {
            this.isSidebarCollapsed.set(true);
          } else if (desktop) {
            this.isSidebarCollapsed.set(false);
          }
        });
      };

      // Set initial
      updateBreakpoints();

      // Listen for window resizes
      mobileQuery.addEventListener('change', updateBreakpoints);
      tabletQuery.addEventListener('change', updateBreakpoints);
      desktopQuery.addEventListener('change', updateBreakpoints);
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed.update((v) => !v);
  }

  toggleMobileDrawer(): void {
    this.isMobileDrawerOpen.update((v) => !v);
  }

  closeMobileDrawer(): void {
    this.isMobileDrawerOpen.set(false);
  }
}
