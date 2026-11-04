import type { Atelier, Ligne, Machine, Operateur } from "./api/types";

export function indexBy<T, K extends string | number>(items: T[], key: (t: T) => K): Map<K, T> {
  return new Map(items.map((i) => [key(i), i]));
}

export const nomOperateur = (o: Operateur | undefined, fallback = "—") =>
  o ? `${o.prenom} ${o.nom}` : fallback;

export function libelleLigne(l: Ligne | undefined, ateliers: Map<number, Atelier>) {
  if (!l) return "—";
  const a = ateliers.get(l.numAtelier);
  return a ? `Ligne ${l.numLigne} · ${a.libelle}` : `Ligne ${l.numLigne}`;
}

export function libelleMachine(m: Machine | undefined) {
  return m ? `${m.libelle}` : "—";
}
