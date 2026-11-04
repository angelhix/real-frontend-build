import { createFileRoute, redirect } from "@tanstack/react-router";

import { PagePending } from "@/components/app/states";
import { ApiError, tokenStore } from "@/lib/api/client";
import { q } from "@/lib/api/queries";
import { homeFor } from "@/lib/permissions";

// Page d'entrée : redirige vers la connexion ou vers l'accueil du rôle.
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "TWIN_3 · Gestion d'usine" },
      {
        name: "description",
        content: "Application de gestion d'usine : ateliers, lots, incidents, maintenances et stocks.",
      },
      { property: "og:title", content: "TWIN_3 · Gestion d'usine" },
      {
        property: "og:description",
        content: "Application de gestion d'usine : ateliers, lots, incidents, maintenances et stocks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    if (!tokenStore.get()) throw redirect({ to: "/connexion" });
    try {
      const utilisateur = await context.queryClient.ensureQueryData(q.me);
      throw redirect({ to: homeFor(utilisateur.role) });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        tokenStore.clear();
        throw redirect({ to: "/connexion" });
      }
      throw e;
    }
  },
  component: Index,
});

function Index() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <PagePending />
    </div>
  );
}
