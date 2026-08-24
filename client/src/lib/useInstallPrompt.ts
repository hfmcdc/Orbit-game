import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "orbit_install_dismissed_at";
const DISMISS_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // don't nag again for 7 days after dismissal

// Chrome/Android fire this event when the page is installable. It's not in
// the standard lib.dom types yet, so we declare the shape we actually use.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "android" | "ios" | "other";

function detectPlatform(): Platform {
  const ua = window.navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

function isStandalone(): boolean {
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari's own flag for "launched from home screen"
  if ((window.navigator as unknown as { standalone?: boolean }).standalone) return true;
  return false;
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    return Date.now() - dismissedAt < DISMISS_SNOOZE_MS;
  } catch {
    return false;
  }
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(wasRecentlyDismissed);
  const platform = detectPlatform();
  const standalone = isStandalone();

  useEffect(() => {
    if (standalone) return; // already installed/running as an app, nothing to prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [standalone]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage errors
    }
  }, []);

  // Show the banner if: not already installed, not recently dismissed, and
  // either Chrome/Android has told us it's installable, or we're on iOS
  // Safari where there's no native prompt but "Add to Home Screen" still
  // works via the Share sheet.
  const canShow = !standalone && !dismissed && (Boolean(deferredPrompt) || platform === "ios");

  return {
    canShow,
    platform,
    canUseNativePrompt: Boolean(deferredPrompt),
    promptInstall,
    dismiss,
  };
}
