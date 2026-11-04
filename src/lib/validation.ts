import { z } from "zod";

// Contrôles de saisie — section 4.1 du cahier des charges.

const requis = (label: string) => z.string().trim().min(1, `${label} est obligatoire.`);

const entier = (label: string, opts: { min: number; strict?: boolean }) =>
  z
    .string()
    .trim()
    .min(1, `${label} est obligatoire.`)
    .refine((v) => /^-?\d+$/.test(v), `${label} doit être un nombre entier.`)
    .refine(
      (v) => (opts.strict ? Number(v) > opts.min : Number(v) >= opts.min),
      opts.strict
        ? `${label} doit être strictement supérieur à ${opts.min}.`
        : `${label} doit être supérieur ou égal à ${opts.min}.`,
    );

const decimal = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} est obligatoire.`)
    .refine((v) => /^\d+([.,]\d{1,2})?$/.test(v), `${label} doit être un montant positif (ex. 12,50).`);

export const toNumber = (v: string) => Number(v.replace(",", "."));

const code = (label: string, max = 20) =>
  requis(label)
    .max(max, `${label} : ${max} caractères maximum.`)
    .regex(/^[A-Za-z0-9_\-.]+$/, `${label} : lettres, chiffres, « - », « _ » ou « . » uniquement.`);

export const incidentSchema = z.object({
  idLot: requis("Le lot"),
  codeType: requis("Le type d'incident"),
  tempsArret: entier("Le temps d'arrêt", { min: 0 }),
});

export const lotSchema = z.object({
  numLigne: requis("La ligne"),
  reference: requis("Le produit"),
  dateProduction: requis("La date de production"),
  ouvriers: z.array(z.string()).min(1, "Un lot doit avoir au moins un ouvrier."),
});

export function maintenanceSchema(stocks: Record<string, number>) {
  return z
    .object({
      idMachine: requis("La machine"),
      dateDebut: requis("La date"),
      heureDebut: requis("L'heure de début"),
      dureeMinutes: entier("La durée", { min: 0, strict: true }),
      operateurs: z.array(z.string()).min(1, "Au moins un opérateur doit être indiqué."),
      pieces: z.array(
        z.object({
          reference: requis("La pièce"),
          quantite: entier("La quantité", { min: 0, strict: true }),
        }),
      ),
    })
    .superRefine((val, ctx) => {
      const vues = new Set<string>();
      val.pieces.forEach((p, i) => {
        if (p.reference && vues.has(p.reference)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["pieces", i, "reference"],
            message: "Cette pièce est déjà dans la liste.",
          });
        }
        vues.add(p.reference);
        const stock = stocks[p.reference];
        if (p.reference && stock !== undefined && /^\d+$/.test(p.quantite) && Number(p.quantite) > stock) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["pieces", i, "quantite"],
            message: `Stock insuffisant : ${stock} disponible(s).`,
          });
        }
      });
    });
}

export const atelierSchema = z.object({
  libelle: requis("Le libellé").max(80, "80 caractères maximum."),
  responsable: requis("Le responsable"),
});

export const ligneSchema = z.object({
  numAtelier: requis("L'atelier"),
  nbOperateurs: entier("Le nombre d'opérateurs", { min: 0, strict: true }),
});

export const machineSchema = z.object({
  libelle: requis("Le libellé").max(80, "80 caractères maximum."),
  numLigne: requis("La ligne"),
});

export const produitSchema = z.object({
  reference: code("La référence"),
  designation: requis("La désignation").max(120, "120 caractères maximum."),
  prixVente: decimal("Le prix de vente"),
  qteStock: entier("La quantité en stock", { min: 0 }),
});

export const stockSchema = z.object({
  qteStock: entier("La quantité en stock", { min: 0 }),
});

export const equipeSchema = z.object({
  libelle: requis("Le libellé").max(80, "80 caractères maximum."),
  responsable: z.string(),
});

export const operateurSchema = z.object({
  matricule: code("Le matricule"),
  nom: requis("Le nom").max(60, "60 caractères maximum."),
  prenom: requis("Le prénom").max(60, "60 caractères maximum."),
  dateEntree: requis("La date d'entrée"),
  numEquipe: requis("L'équipe"),
});

export const typeIncidentSchema = z.object({
  codeType: code("Le code", 10),
  libelle: requis("Le libellé").max(80, "80 caractères maximum."),
});

export const pieceSchema = z.object({
  reference: code("La référence"),
  libelle: requis("Le libellé").max(120, "120 caractères maximum."),
  prixUnitaireHT: decimal("Le prix unitaire HT"),
  qteStock: entier("La quantité en stock", { min: 0 }),
});

export const composantSchema = z.object({
  pieceComposant: requis("La pièce composant"),
  quantite: entier("La quantité", { min: 0, strict: true }),
});

export const fournisseurSchema = z.object({
  codeFournisseur: code("Le code fournisseur"),
  raisonSociale: requis("La raison sociale").max(120, "120 caractères maximum."),
  adresse: z.string().max(200, "200 caractères maximum."),
  telephone: z
    .string()
    .max(30, "30 caractères maximum.")
    .refine((v) => v.trim() === "" || /^[+\d][\d\s.\-()]{5,}$/.test(v.trim()), "Numéro de téléphone invalide."),
});

export const achatSchema = z.object({
  codeFournisseur: requis("Le fournisseur"),
  dateAchat: requis("La date d'achat"),
  prixAchat: decimal("Le prix d'achat"),
});

export function compteSchema(creation: boolean) {
  return z.object({
    identifiant: requis("L'identifiant")
      .min(3, "L'identifiant doit contenir au moins 3 caractères.")
      .max(50, "50 caractères maximum."),
    role: requis("Le rôle"),
    matricule: z.string(),
    motDePasse: creation
      ? z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.")
      : z
          .string()
          .refine((v) => v === "" || v.length >= 8, "Le mot de passe doit contenir au moins 8 caractères."),
  });
}

export const loginSchema = z.object({
  identifiant: requis("L'identifiant"),
  motDePasse: requis("Le mot de passe"),
});
