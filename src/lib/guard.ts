import { redirect } from "@tanstack/react-router";

import type { Utilisateur } from "./api/types";
import { canAccess, homeFor, type AppPath } from "./permissions";

/** Redirige vers la page d'accueil du rôle si la page n'est pas autorisée. */
export function guard(utilisateur: Utilisateur, path: AppPath) {
  if (!canAccess(utilisateur.role, path)) {
    throw redirect({ to: homeFor(utilisateur.role) });
  }
}

export function pageHead(title: string, description: string) {
  const full = `${title} · TWIN_3 Gestion d'usine`;
  return {
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  };
}
