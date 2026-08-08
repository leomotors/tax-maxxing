import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-accent text-accent-ink hover:bg-teal-800 shadow-sm shadow-teal-900/10",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-accent/30",
  ghost: "bg-transparent text-ink-2 hover:bg-accent-soft hover:text-accent",
  danger: "bg-danger-soft text-danger hover:bg-red-100",
};

export function Button({
  variant = "secondary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  children: ReactNode;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-3.5 py-2 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
