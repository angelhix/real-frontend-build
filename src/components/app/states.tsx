import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw, ServerOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { API_URL, ApiError } from "@/lib/api/client";

export function PagePending() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement">
      <div className="space-y-2 border-b border-border pb-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function PageError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryReset = useQueryErrorResetBoundary();
  useEffect(() => {
    queryReset.reset();
  }, [queryReset]);

  const unreachable = error instanceof ApiError && error.status === 0;
  const forbidden = error instanceof ApiError && error.status === 403;
  const Icon = unreachable ? ServerOff : AlertTriangle;

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-md border border-border bg-card p-6">
      <div className="hazard-stripe -mx-6 -mt-6 mb-5 h-1.5 rounded-t-md" />
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-2">
          <h2 className="text-lg font-semibold">
            {unreachable
              ? "Serveur injoignable"
              : forbidden
                ? "Accès refusé"
                : "Impossible de charger cette page"}
          </h2>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          {unreachable && (
            <p className="text-xs text-muted-foreground">
              Adresse de l'API configurée : <span className="font-mono">{API_URL}</span>
            </p>
          )}
          <Button
            size="sm"
            className="mt-2"
            onClick={() => {
              reset();
              router.invalidate();
            }}
          >
            <RefreshCw className="size-4" /> Réessayer
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmptyPanel({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
