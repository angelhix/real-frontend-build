import { api } from "./client";
import type {
  Approvisionnement,
  Atelier,
  AtelierInput,
  Composant,
  CompteInput,
  Equipe,
  EquipeInput,
  Fournisseur,
  Incident,
  IncidentInput,
  Ligne,
  LigneInput,
  LoginResponse,
  Lot,
  LotInput,
  Machine,
  MachineInput,
  Maintenance,
  MaintenanceInput,
  Operateur,
  Piece,
  Produit,
  TypeIncident,
  Utilisateur,
} from "./types";

const enc = (v: string | number) => encodeURIComponent(String(v));

function resource<T, Create, Update = Create, Id extends string | number = string | number>(
  path: string,
) {
  return {
    list: () => api<T[]>(path),
    get: (id: Id) => api<T>(`${path}/${enc(id)}`),
    create: (input: Create) => api<T>(path, { method: "POST", body: input }),
    update: (id: Id, input: Update) => api<T>(`${path}/${enc(id)}`, { method: "PUT", body: input }),
    remove: (id: Id) => api<void>(`${path}/${enc(id)}`, { method: "DELETE" }),
  };
}

export const authApi = {
  login: (identifiant: string, motDePasse: string) =>
    api<LoginResponse>("/auth/login", { method: "POST", body: { identifiant, motDePasse } }),
  me: () => api<Utilisateur>("/auth/me"),
  logout: () => api<void>("/auth/logout", { method: "POST" }),
};

export const comptesApi = resource<Utilisateur, CompteInput, CompteInput, number>("/comptes");
export const ateliersApi = resource<Atelier, AtelierInput, AtelierInput, number>("/ateliers");
export const lignesApi = resource<Ligne, LigneInput, LigneInput, number>("/lignes");
export const machinesApi = resource<Machine, MachineInput, MachineInput, number>("/machines");
export const equipesApi = resource<Equipe, EquipeInput, EquipeInput, number>("/equipes");
export const operateursApi = resource<Operateur, Operateur, Omit<Operateur, "matricule">, string>(
  "/operateurs",
);
export const typesIncidentApi = resource<
  TypeIncident,
  TypeIncident,
  Omit<TypeIncident, "codeType">,
  string
>("/types-incident");
export const incidentsApi = resource<Incident, IncidentInput, IncidentInput, number>("/incidents");
export const lotsApi = resource<Lot, LotInput, LotInput, number>("/lots");
export const maintenancesApi = resource<Maintenance, MaintenanceInput, MaintenanceInput, number>(
  "/maintenances",
);
export const fournisseursApi = resource<
  Fournisseur,
  Fournisseur,
  Omit<Fournisseur, "codeFournisseur">,
  string
>("/fournisseurs");

export const produitsApi = {
  ...resource<Produit, Produit, Omit<Produit, "reference">, string>("/produits"),
  updateStock: (reference: string, qteStock: number) =>
    api<Produit>(`/produits/${enc(reference)}/stock`, { method: "PATCH", body: { qteStock } }),
};

export const piecesApi = {
  ...resource<Piece, Piece, Omit<Piece, "reference">, string>("/pieces"),
  updateStock: (reference: string, qteStock: number) =>
    api<Piece>(`/pieces/${enc(reference)}/stock`, { method: "PATCH", body: { qteStock } }),
  composition: (reference: string) => api<Composant[]>(`/pieces/${enc(reference)}/composition`),
  addComposant: (reference: string, composant: Composant) =>
    api<Composant>(`/pieces/${enc(reference)}/composition`, { method: "POST", body: composant }),
  updateComposant: (reference: string, pieceComposant: string, quantite: number) =>
    api<Composant>(`/pieces/${enc(reference)}/composition/${enc(pieceComposant)}`, {
      method: "PUT",
      body: { quantite },
    }),
  removeComposant: (reference: string, pieceComposant: string) =>
    api<void>(`/pieces/${enc(reference)}/composition/${enc(pieceComposant)}`, {
      method: "DELETE",
    }),
};

export const approvisionnementsApi = {
  list: (reference?: string) =>
    api<Approvisionnement[]>("/approvisionnements", { query: { reference } }),
  create: (input: Approvisionnement) =>
    api<Approvisionnement>("/approvisionnements", { method: "POST", body: input }),
  remove: (a: Pick<Approvisionnement, "reference" | "codeFournisseur" | "dateAchat">) =>
    api<void>("/approvisionnements", {
      method: "DELETE",
      query: { reference: a.reference, codeFournisseur: a.codeFournisseur, dateAchat: a.dateAchat },
    }),
};
