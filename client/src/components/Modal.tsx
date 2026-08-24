import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  dismissible?: boolean;
}

export function Modal({ open, onClose, children, dismissible = true }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        className="w-full sm:max-w-sm bg-panel border border-border-subtle rounded-t-3xl sm:rounded-3xl px-6 py-6 max-h-[85dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
