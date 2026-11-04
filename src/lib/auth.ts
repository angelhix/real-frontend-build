import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { tokenStore } from "./api/client";
import { authApi } from "./api/endpoints";
import { q } from "./api/queries";

/** Utilisateur connecté (disponible sous la mise en page authentifiée). */
export function useUtilisateur() {
  return useSuspenseQuery(q.me).data;
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // déconnexion locale même si le serveur ne répond pas
    }
    tokenStore.clear();
    queryClient.clear();
    navigate({ to: "/connexion" });
  }, [queryClient, navigate]);
}
