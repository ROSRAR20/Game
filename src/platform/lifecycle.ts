import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface LifecycleListener {
  onPause?: () => void;
  onResume?: () => void;
  onBackButton?: () => void;
}

export class PlatformLifecycle {
  private static listeners: Set<LifecycleListener> = new Set();
  private static initialized = false;
  private static isPaused = false;

  public static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (Capacitor.isNativePlatform()) {
      // Native Capacitor App lifecycle
      CapApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          this.handleResume();
        } else {
          this.handlePause();
        }
      });

      // Android hardware back button
      CapApp.addListener('backButton', () => {
        let handled = false;
        for (const listener of this.listeners) {
          if (listener.onBackButton) {
            listener.onBackButton();
            handled = true;
          }
        }
        if (!handled) {
          // Default Android behavior: exit app if at root
          CapApp.exitApp();
        }
      });
    } else if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      // Browser fallback (visibilitychange & pagehide)
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.handlePause();
        } else {
          this.handleResume();
        }
      });

      window.addEventListener('pagehide', () => {
        this.handlePause();
      });

      window.addEventListener('pageshow', () => {
        this.handleResume();
      });
    }
  }

  private static handlePause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    for (const listener of this.listeners) {
      listener.onPause?.();
    }
  }

  private static handleResume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    for (const listener of this.listeners) {
      listener.onResume?.();
    }
  }

  public static addListener(listener: LifecycleListener): () => void {
    this.init();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public static getIsPaused(): boolean {
    return this.isPaused;
  }
}
