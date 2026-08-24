interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  variant?: "error" | "info";
}

export function Toast({ message, onDismiss, variant = "error" }: ToastProps) {
  if (!message) return null;
  const isError = variant === "error";
  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <div
        role="alert"
        className={`pointer-events-auto max-w-md w-full bg-panel-2 border rounded-2xl px-4 py-3 shadow-lg flex items-start gap-3 ${
          isError ? "border-accent-danger/50" : "border-accent-win/50"
        }`}
      >
        <span
          className={`text-lg leading-none mt-0.5 ${isError ? "text-accent-danger" : "text-accent-win"}`}
        >
          {isError ? "●" : "🏳️"}
        </span>
        <p className="flex-1 text-sm text-text-primary">{message}</p>
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
