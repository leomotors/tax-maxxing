import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  description,
  badge,
  children,
  className,
  actions,
}: {
  id?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-[var(--radius-lg)] border border-line bg-surface/90 p-5 shadow-[0_1px_0_rgba(15,118,110,0.04)] backdrop-blur-sm md:p-6",
        className,
      )}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-ink md:text-xl">
              {title}
            </h2>
            {badge}
          </div>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "accent",
}: {
  children: ReactNode;
  tone?: "accent" | "mint" | "warn" | "muted";
}) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    mint: "bg-mint-soft text-mint",
    warn: "bg-amber-100 text-warn",
    muted: "bg-line-2 text-ink-2",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
