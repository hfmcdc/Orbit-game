interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  if (!message) return null;
  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <div
        role="alert"
        className="pointer-events-auto max-w-md w-full bg-panel-2 border border-accent-danger/50 text-text-primary rounded-2xl px-4 py-3 shadow-lg flex items-start gap-3"
      >
        <span className="text-accent-danger text-lg leading-none mt-0.5">●</span>
        <p className="flex-1 text-sm">{message}</p>
        <button
          onClick={onDismiss}
          className="text-text-dim hover:text-text-primary text-sm px-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
