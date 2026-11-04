import { describe, expect, it } from "vitest";

import { canAccess, homeFor } from "@/lib/permissions";
import { tempsArretParLigne } from "@/lib/stats";
import { incidentSchema, lotSchema, maintenanceSchema } from "@/lib/validation";

describe("Contrôles de saisie (section 4.1)", () => {
  it("refuse un temps d'arrêt négatif", () => {
    expect(incidentSchema.safeParse({ idLot: "1", codeType: "PANNE", tempsArret: "-1" }).success).toBe(false);
  });
  it("accepte un temps d'arrêt de 0", () => {
    expect(incidentSchema.safeParse({ idLot: "1", codeType: "PANNE", tempsArret: "0" }).success).toBe(true);
  });
  it("refuse un temps d'arrêt non entier", () => {
    expect(incidentSchema.safeParse({ idLot: "1", codeType: "PANNE", tempsArret: "2.5" }).success).toBe(false);
  });
  it("refuse une durée de maintenance de 0", () => {
    const r = maintenanceSchema({}).safeParse({
      idMachine: "1", dateDebut: "2026-11-04", heureDebut: "08:00", dureeMinutes: "0", operateurs: ["OP1"], pieces: [],
    });
    expect(r.success).toBe(false);
  });
  it("refuse une quantité de pièces supérieure au stock", () => {
    const r = maintenanceSchema({ P1: 3 }).safeParse({
      idMachine: "1", dateDebut: "2026-11-04", heureDebut: "08:00", dureeMinutes: "30", operateurs: ["OP1"],
      pieces: [{ reference: "P1", quantite: "4" }],
    });
    expect(r.success).toBe(false);
  });
  it("accepte une quantité égale au stock", () => {
    const r = maintenanceSchema({ P1: 3 }).safeParse({
      idMachine: "1", dateDebut: "2026-11-04", heureDebut: "08:00", dureeMinutes: "30", operateurs: ["OP1"],
      pieces: [{ reference: "P1", quantite: "3" }],
    });
    expect(r.success).toBe(true);
  });
  it("refuse une quantité de pièces nulle", () => {
    const r = maintenanceSchema({ P1: 3 }).safeParse({
      idMachine: "1", dateDebut: "2026-11-04", heureDebut: "08:00", dureeMinutes: "30", operateurs: ["OP1"],
      pieces: [{ reference: "P1", quantite: "0" }],
    });
    expect(r.success).toBe(false);
  });
  it("refuse un lot sans ouvrier", () => {
    expect(lotSchema.safeParse({ numLigne: "1", reference: "PR1", dateProduction: "2026-11-04", ouvriers: [] }).success).toBe(false);
  });
});

describe("Droits par rôle (sections 2 et 6)", () => {
  it("seul l'opérateur accède aux maintenances", () => {
    expect(canAccess("OPERATEUR", "/maintenances")).toBe(true);
    expect(canAccess("ADMIN", "/maintenances")).toBe(false);
    expect(canAccess("MAGASINIER", "/maintenances")).toBe(false);
  });
  it("le magasinier gère pièces et fournisseurs mais pas les ateliers", () => {
    expect(canAccess("MAGASINIER", "/pieces")).toBe(true);
    expect(canAccess("MAGASINIER", "/fournisseurs")).toBe(true);
    expect(canAccess("MAGASINIER", "/ateliers")).toBe(false);
  });
  it("le tableau de bord est réservé à l'administrateur et au responsable", () => {
    expect(canAccess("ADMIN", "/tableau-de-bord")).toBe(true);
    expect(canAccess("RESPONSABLE", "/tableau-de-bord")).toBe(true);
    expect(canAccess("OPERATEUR", "/tableau-de-bord")).toBe(false);
  });
  it("chaque rôle a une page d'accueil autorisée", () => {
    for (const r of ["ADMIN", "RESPONSABLE", "OPERATEUR", "MAGASINIER"] as const) {
      expect(canAccess(r, homeFor(r))).toBe(true);
    }
  });
});

describe("Tableau de bord (F10)", () => {
  it("additionne le temps d'arrêt par ligne sur la période", () => {
    const lots = [
      { idLot: 1, dateProduction: "2026-11-01", numLigne: 1, reference: "A", ouvriers: ["x"] },
      { idLot: 2, dateProduction: "2026-11-02", numLigne: 1, reference: "A", ouvriers: ["x"] },
      { idLot: 3, dateProduction: "2026-10-01", numLigne: 2, reference: "A", ouvriers: ["x"] },
    ];
    const incidents = [
      { numIncident: 1, idLot: 1, codeType: "P", tempsArret: 30 },
      { numIncident: 2, idLot: 2, codeType: "P", tempsArret: 15 },
      { numIncident: 3, idLot: 3, codeType: "P", tempsArret: 99 },
    ];
    expect(tempsArretParLigne(incidents, lots, { du: "2026-11-01", au: "2026-11-30" })).toEqual([
      { numLigne: 1, total: 45 },
    ]);
  });
});
