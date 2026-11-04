import { queryOptions } from "@tanstack/react-query";

import {
  approvisionnementsApi,
  ateliersApi,
  authApi,
  comptesApi,
  equipesApi,
  fournisseursApi,
  incidentsApi,
  lignesApi,
  lotsApi,
  machinesApi,
  maintenancesApi,
  operateursApi,
  piecesApi,
  produitsApi,
  typesIncidentApi,
} from "./endpoints";

export const qk = {
  me: ["auth", "me"] as const,
  comptes: ["comptes"] as const,
  ateliers: ["ateliers"] as const,
  lignes: ["lignes"] as const,
  machines: ["machines"] as const,
  produits: ["produits"] as const,
  equipes: ["equipes"] as const,
  operateurs: ["operateurs"] as const,
  lots: ["lots"] as const,
  typesIncident: ["types-incident"] as const,
  incidents: ["incidents"] as const,
  maintenances: ["maintenances"] as const,
  pieces: ["pieces"] as const,
  composition: (ref: string) => ["pieces", ref, "composition"] as const,
  fournisseurs: ["fournisseurs"] as const,
  approvisionnements: (ref?: string) => ["approvisionnements", ref ?? "all"] as const,
};

export const q = {
  me: queryOptions({ queryKey: qk.me, queryFn: authApi.me, staleTime: Infinity, retry: false }),
  comptes: queryOptions({ queryKey: qk.comptes, queryFn: comptesApi.list }),
  ateliers: queryOptions({ queryKey: qk.ateliers, queryFn: ateliersApi.list }),
  lignes: queryOptions({ queryKey: qk.lignes, queryFn: lignesApi.list }),
  machines: queryOptions({ queryKey: qk.machines, queryFn: machinesApi.list }),
  produits: queryOptions({ queryKey: qk.produits, queryFn: produitsApi.list }),
  equipes: queryOptions({ queryKey: qk.equipes, queryFn: equipesApi.list }),
  operateurs: queryOptions({ queryKey: qk.operateurs, queryFn: operateursApi.list }),
  lots: queryOptions({ queryKey: qk.lots, queryFn: lotsApi.list }),
  typesIncident: queryOptions({ queryKey: qk.typesIncident, queryFn: typesIncidentApi.list }),
  incidents: queryOptions({ queryKey: qk.incidents, queryFn: incidentsApi.list }),
  maintenances: queryOptions({ queryKey: qk.maintenances, queryFn: maintenancesApi.list }),
  pieces: queryOptions({ queryKey: qk.pieces, queryFn: piecesApi.list }),
  composition: (ref: string) =>
    queryOptions({ queryKey: qk.composition(ref), queryFn: () => piecesApi.composition(ref) }),
  fournisseurs: queryOptions({ queryKey: qk.fournisseurs, queryFn: fournisseursApi.list }),
  approvisionnements: (ref?: string) =>
    queryOptions({
      queryKey: qk.approvisionnements(ref),
      queryFn: () => approvisionnementsApi.list(ref),
    }),
};
