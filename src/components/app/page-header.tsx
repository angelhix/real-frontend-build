import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  code,
  actions,
}: {
  title: string;
  description?: string;
  code?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {code && (
          <div className="mb-1 font-mono text-xs uppercase tracking-widest text-primary">{code}</div>
        )}
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-foreground">{children}</h2>
      {actions}
    </div>
  );
}
