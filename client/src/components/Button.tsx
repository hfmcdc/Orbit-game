import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
}

const base =
  "font-display font-semibold rounded-2xl transition-colors duration-150 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none select-none";

const variants: Record<string, string> = {
  primary:
    "bg-accent-core text-void hover:bg-[#ffc373] shadow-[0_0_24px_-6px_rgba(255,180,84,0.6)]",
  secondary:
    "bg-panel-2 text-text-primary border border-border-subtle hover:border-accent-far",
  ghost: "bg-transparent text-text-dim hover:text-text-primary",
  danger: "bg-transparent text-accent-danger border border-accent-danger/40 hover:bg-accent-danger/10",
};

export function Button({
  variant = "primary",
  fullWidth,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} px-6 py-4 text-base ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
