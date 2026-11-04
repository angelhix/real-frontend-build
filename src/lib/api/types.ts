// Types partagés avec le backend (JSON, camelCase). Voir docs/API.md.

export type Role = "ADMIN" | "RESPONSABLE" | "OPERATEUR" | "MAGASINIER";

export interface Utilisateur {
  id: number;
  identifiant: string;
  role: Role;
  /** Matricule de l'opérateur lié au compte, s'il existe. */
  matricule: string | null;
}

export interface LoginResponse {
  token: string;
  utilisateur: Utilisateur;
}

export interface CompteInput {
  identifiant: string;
  role: Role;
  matricule: string | null;
  /** Obligatoire à la création, facultatif à la modification. */
  motDePasse?: string;
}

export interface Atelier {
  numAtelier: number;
  libelle: string;
  /** Matricule de l'opérateur responsable. */
  responsable: string;
}
export type AtelierInput = Omit<Atelier, "numAtelier">;

export interface Ligne {
  numLigne: number;
  nbOperateurs: number;
  numAtelier: number;
}
export type LigneInput = Omit<Ligne, "numLigne">;

export interface Machine {
  idMachine: number;
  libelle: string;
  numLigne: number;
}
export type MachineInput = Omit<Machine, "idMachine">;

export interface Produit {
  reference: string;
  designation: string;
  prixVente: number;
  qteStock: number;
}

export interface Equipe {
  numEquipe: number;
  libelle: string;
  responsable: string | null;
}
export type EquipeInput = Omit<Equipe, "numEquipe">;

export interface Operateur {
  matricule: string;
  nom: string;
  prenom: string;
  /** Date ISO AAAA-MM-JJ */
  dateEntree: string;
  numEquipe: number;
}

export interface Lot {
  idLot: number;
  dateProduction: string;
  numLigne: number;
  reference: string;
  /** Matricules des ouvriers (au moins un). */
  ouvriers: string[];
}
export type LotInput = Omit<Lot, "idLot">;

export interface TypeIncident {
  codeType: string;
  libelle: string;
}

export interface Incident {
  numIncident: number;
  tempsArret: number;
  idLot: number;
  codeType: string;
}
export type IncidentInput = Omit<Incident, "numIncident">;

export interface ConsommationPiece {
  reference: string;
  quantite: number;
}

export interface Maintenance {
  idMaintenance: number;
  idMachine: number;
  dateDebut: string;
  /** HH:MM */
  heureDebut: string;
  dureeMinutes: number;
  operateurs: string[];
  pieces: ConsommationPiece[];
}
export type MaintenanceInput = Omit<Maintenance, "idMaintenance">;

export interface Piece {
  reference: string;
  libelle: string;
  prixUnitaireHT: number;
  qteStock: number;
}

export interface Composant {
  pieceComposant: string;
  quantite: number;
}

export interface Fournisseur {
  codeFournisseur: string;
  raisonSociale: string;
  adresse: string | null;
  telephone: string | null;
}

export interface Approvisionnement {
  reference: string;
  codeFournisseur: string;
  dateAchat: string;
  prixAchat: number;
}
