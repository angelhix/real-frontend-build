import type { Incident, Lot, Piece, TypeIncident } from "./api/types";
import { isoInRange } from "./format";

// Indicateurs F10, calculés à partir des listes renvoyées par l'API.

export interface Periode {
  du?: string;
  au?: string;
}

export function lotsDansPeriode(lots: Lot[], p: Periode) {
  return lots.filter((l) => isoInRange(l.dateProduction, p.du, p.au));
}

/** Temps d'arrêt total par ligne sur la période (date du lot concerné). */
export function tempsArretParLigne(incidents: Incident[], lots: Lot[], p: Periode) {
  const lotMap = new Map(lots.map((l) => [l.idLot, l]));
  const totals = new Map<number, number>();
  for (const i of incidents) {
    const lot = lotMap.get(i.idLot);
    if (!lot || !isoInRange(lot.dateProduction, p.du, p.au)) continue;
    totals.set(lot.numLigne, (totals.get(lot.numLigne) ?? 0) + i.tempsArret);
  }
  return [...totals.entries()]
    .map(([numLigne, total]) => ({ numLigne, total }))
    .sort((a, b) => a.numLigne - b.numLigne);
}

export function incidentsParType(incidents: Incident[], lots: Lot[], types: TypeIncident[], p: Periode) {
  const lotMap = new Map(lots.map((l) => [l.idLot, l]));
  const counts = new Map<string, number>(types.map((t) => [t.codeType, 0]));
  for (const i of incidents) {
    const lot = lotMap.get(i.idLot);
    if (!lot || !isoInRange(lot.dateProduction, p.du, p.au)) continue;
    counts.set(i.codeType, (counts.get(i.codeType) ?? 0) + 1);
  }
  return [...counts.entries()].map(([codeType, nombre]) => ({ codeType, nombre }));
}

/** Production par produit = nombre de lots fabriqués sur la période. */
export function productionParProduit(lots: Lot[], p: Periode) {
  const counts = new Map<string, number>();
  for (const l of lotsDansPeriode(lots, p)) counts.set(l.reference, (counts.get(l.reference) ?? 0) + 1);
  return [...counts.entries()]
    .map(([reference, nombre]) => ({ reference, nombre }))
    .sort((a, b) => b.nombre - a.nombre);
}

export function piecesStockBas(pieces: Piece[], seuil: number) {
  return pieces.filter((p) => p.qteStock <= seuil).sort((a, b) => a.qteStock - b.qteStock);
}
