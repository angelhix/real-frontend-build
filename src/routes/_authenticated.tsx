import { Outlet, createFileRoute, redirect, type ErrorComponentProps } from "@tanstack/react-router";

import { AppShell } from "@/components/app/app-shell";
import { PageError, PagePending } from "@/components/app/states";
import { ApiError, tokenStore } from "@/lib/api/client";
import { q } from "@/lib/api/queries";
import { useUtilisateur } from "@/lib/auth";

// Toutes les pages de l'application : rendu côté navigateur (le jeton est dans le navigateur).
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    if (!tokenStore.get()) throw redirect({ to: "/connexion" });
    try {
      const utilisateur = await context.queryClient.ensureQueryData(q.me);
      return { utilisateur };
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        tokenStore.clear();
        throw redirect({ to: "/connexion", search: { expire: true } });
      }
      throw e;
    }
  },
  component: AuthenticatedLayout,
  pendingComponent: () => (
    <div className="mx-auto max-w-5xl p-8">
      <PagePending />
    </div>
  ),
  errorComponent: LayoutError,
});

function AuthenticatedLayout() {
  const utilisateur = useUtilisateur();
  return (
    <AppShell utilisateur={utilisateur}>
      <Outlet />
    </AppShell>
  );
}

function LayoutError(props: ErrorComponentProps) {
  return (
    <div className="min-h-screen px-4 py-10">
      <PageError {...props} />
      <div className="mt-4 text-center">
        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          onClick={() => {
            tokenStore.clear();
            window.location.assign("/connexion");
          }}
        >
          Revenir à la connexion
        </button>
      </div>
    </div>
  );
}
