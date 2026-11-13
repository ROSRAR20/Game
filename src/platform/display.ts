import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

export async function configureDisplay(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Make status bar dark and overlay webview so viewport-fit=cover works seamlessly
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: '#0b0f19' });
  } catch (err) {
    console.warn('[Platform] StatusBar configuration warning:', err);
  }

  try {
    // Hide splash screen smoothly once the web content has rendered
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (err) {
    console.warn('[Platform] SplashScreen hide warning:', err);
  }
}
