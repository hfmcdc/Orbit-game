import { useInstallPrompt } from "../lib/useInstallPrompt";

export function InstallPrompt() {
  const { canShow, platform, canUseNativePrompt, promptInstall, dismiss } = useInstallPrompt();

  if (!canShow) return null;

  return (
    <div className="w-full bg-panel-2 border border-border-subtle rounded-2xl px-4 py-3 mb-6 flex items-start gap-3">
      <span className="text-xl leading-none mt-0.5" aria-hidden>
        📲
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">Play like an app</p>
        {canUseNativePrompt ? (
          <>
            <p className="text-xs text-text-dim mt-0.5">
              Add Orbit to your home screen for instant, full-screen access next time.
            </p>
            <button
              onClick={promptInstall}
              className="text-sm font-medium text-accent-core mt-2 underline underline-offset-4"
            >
              Add to Home Screen
            </button>
          </>
        ) : platform === "ios" ? (
          <p className="text-xs text-text-dim mt-0.5">
            In Safari, tap the <span className="text-text-primary font-medium">Share</span> icon,
            then <span className="text-text-primary font-medium">"Add to Home Screen"</span> for
            instant, full-screen access next time.
          </p>
        ) : null}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-text-dim hover:text-text-primary text-sm px-1 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
