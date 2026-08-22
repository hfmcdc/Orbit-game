import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function TextField({ label, id, className = "", ...rest }: TextFieldProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm text-text-dim mb-2 font-medium">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full rounded-2xl bg-panel-2 border border-border-subtle px-5 py-4 text-lg text-text-primary placeholder:text-text-dim/60 focus:outline-none focus:ring-2 focus:ring-accent-far focus:border-accent-far ${className}`}
        {...rest}
      />
    </div>
  );
}
