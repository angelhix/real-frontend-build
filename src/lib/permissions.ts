import type { Role } from "./api/types";

export const ROLES: Role[] = ["ADMIN", "RESPONSABLE", "OPERATEUR", "MAGASINIER"];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  RESPONSABLE: "Responsable d'atelier",
  OPERATEUR: "Opérateur",
  MAGASINIER: "Magasinier",
};

export type AppPath =
  | "/tableau-de-bord"
  | "/ateliers"
  | "/machines"
  | "/produits"
  | "/lots"
  | "/operateurs"
  | "/incidents"
  | "/maintenances"
  | "/pieces"
  | "/fournisseurs"
  | "/comptes";

export interface NavItem {
  to: AppPath;
  label: string;
  group: "Pilotage" | "Production" | "Référentiels" | "Magasin" | "Administration";
  roles: Role[];
}

/** Section 6 du cahier des charges : pages et rôles autorisés. */
export const NAV: NavItem[] = [
  { to: "/tableau-de-bord", label: "Tableau de bord", group: "Pilotage", roles: ["ADMIN", "RESPONSABLE"] },
  { to: "/lots", label: "Lots de production", group: "Production", roles: ["OPERATEUR", "RESPONSABLE"] },
  { to: "/incidents", label: "Incidents", group: "Production", roles: ["OPERATEUR", "RESPONSABLE", "ADMIN"] },
  { to: "/maintenances", label: "Maintenances", group: "Production", roles: ["OPERATEUR"] },
  { to: "/ateliers", label: "Ateliers et lignes", group: "Référentiels", roles: ["ADMIN"] },
  { to: "/machines", label: "Machines", group: "Référentiels", roles: ["ADMIN"] },
  { to: "/operateurs", label: "Opérateurs et équipes", group: "Référentiels", roles: ["ADMIN"] },
  { to: "/produits", label: "Produits", group: "Magasin", roles: ["ADMIN", "MAGASINIER"] },
  { to: "/pieces", label: "Pièces et nomenclature", group: "Magasin", roles: ["MAGASINIER"] },
  { to: "/fournisseurs", label: "Fournisseurs et achats", group: "Magasin", roles: ["MAGASINIER"] },
  { to: "/comptes", label: "Comptes utilisateurs", group: "Administration", roles: ["ADMIN"] },
];

export function canAccess(role: Role, path: AppPath): boolean {
  return NAV.find((n) => n.to === path)?.roles.includes(role) ?? false;
}

export function navFor(role: Role): NavItem[] {
  return NAV.filter((n) => n.roles.includes(role));
}

export function homeFor(role: Role): AppPath {
  switch (role) {
    case "ADMIN":
    case "RESPONSABLE":
      return "/tableau-de-bord";
    case "OPERATEUR":
      return "/lots";
    case "MAGASINIER":
      return "/pieces";
  }
}

/** Actions fines à l'intérieur des pages. */
export const can = {
  declarerIncident: (r: Role) => r === "OPERATEUR" || r === "RESPONSABLE",
  gererTypesIncident: (r: Role) => r === "ADMIN",
  enregistrerLot: (r: Role) => r === "OPERATEUR" || r === "RESPONSABLE",
};

/** Seuil en dessous duquel (ou égal) une pièce est considérée en stock bas. */
export const SEUIL_STOCK_BAS = 5;
