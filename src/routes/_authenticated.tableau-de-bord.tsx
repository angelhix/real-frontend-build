import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertOctagon, ArrowRight, Boxes, Clock, Layers, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Code, SimpleSelect } from "@/components/app/form-bits";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { EmptyPanel } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { q } from "@/lib/api/queries";
import { useUtilisateur } from "@/lib/auth";
import { daysAgoIso, formatMinutes, formatNombre, todayIso } from "@/lib/format";
import { guard, pageHead } from "@/lib/guard";
import { indexBy } from "@/lib/labels";
import { SEUIL_STOCK_BAS, navFor } from "@/lib/permissions";
import {
  incidentsParType,
  lotsDansPeriode,
  piecesStockBas,
  productionParProduit,
  tempsArretParLigne,
  type Periode,
} from "@/lib/stats";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/tableau-de-bord"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(q.lots),
      queryClient.ensureQueryData(q.incidents),
      queryClient.ensureQueryData(q.typesIncident),
      queryClient.ensureQueryData(q.lignes),
      queryClient.ensureQueryData(q.ateliers),
      queryClient.ensureQueryData(q.produits),
      queryClient.ensureQueryData(q.pieces),
    ]),
  head: () => pageHead("Tableau de bord", "Temps d'arrêt, incidents, production et stocks bas."),
  component: TableauDeBord,
});

const PERIODES: Record<string, { label: string; jours: number | null }> = {
  "7": { label: "7 derniers jours", jours: 7 },
  "30": { label: "30 derniers jours", jours: 30 },
  "90": { label: "90 derniers jours", jours: 90 },
  "365": { label: "12 derniers mois", jours: 365 },
  tout: { label: "Toute la période", jours: null },
};

function Kpi({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: LucideIcon; tone?: "alert" }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</div>
          {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <span
          className={
            tone === "alert"
              ? "flex size-9 items-center justify-center rounded-sm bg-destructive/10 text-destructive"
              : "flex size-9 items-center justify-center rounded-sm bg-accent text-accent-foreground"
          }
        >
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function TableauDeBord() {
  const utilisateur = useUtilisateur();
  const { data: lots } = useSuspenseQuery(q.lots);
  const { data: incidents } = useSuspenseQuery(q.incidents);
  const { data: types } = useSuspenseQuery(q.typesIncident);
  const { data: lignes } = useSuspenseQuery(q.lignes);
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const { data: produits } = useSuspenseQuery(q.produits);
  const { data: pieces } = useSuspenseQuery(q.pieces);

  const [periode, setPeriode] = useState("30");
  const p: Periode = useMemo(() => {
    const j = PERIODES[periode].jours;
    return j === null ? {} : { du: daysAgoIso(j), au: todayIso() };
  }, [periode]);

  const atMap = useMemo(() => indexBy(ateliers, (a) => a.numAtelier), [ateliers]);
  const liMap = useMemo(() => indexBy(lignes, (l) => l.numLigne), [lignes]);
  const prMap = useMemo(() => indexBy(produits, (x) => x.reference), [produits]);
  const tyMap = useMemo(() => indexBy(types, (t) => t.codeType), [types]);

  const arretLigne = tempsArretParLigne(incidents, lots, p).map((r) => ({
    ...r,
    ligne: `L${r.numLigne}`,
    atelier: atMap.get(liMap.get(r.numLigne)?.numAtelier ?? -1)?.libelle ?? "",
  }));
  const parType = incidentsParType(incidents, lots, types, p).map((r) => ({
    ...r,
    libelle: tyMap.get(r.codeType)?.libelle ?? r.codeType,
  }));
  const production = productionParProduit(lots, p).map((r) => ({
    ...r,
    designation: prMap.get(r.reference)?.designation ?? r.reference,
  }));
  const stockBas = piecesStockBas(pieces, SEUIL_STOCK_BAS);
  const nbLots = lotsDansPeriode(lots, p).length;
  const nbIncidents = parType.reduce((s, r) => s + r.nombre, 0);
  const totalArret = arretLigne.reduce((s, r) => s + r.total, 0);

  const arretConfig: ChartConfig = { total: { label: "Temps d'arrêt (min)", color: "var(--chart-1)" } };
  const typeConfig: ChartConfig = { nombre: { label: "Incidents", color: "var(--chart-2)" } };
  const prodConfig: ChartConfig = { nombre: { label: "Lots", color: "var(--chart-3)" } };

  const raccourcis = navFor(utilisateur.role).filter((n) => n.to !== "/tableau-de-bord").slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        code="F10"
        title="Tableau de bord"
        description="Indicateurs de production, d'incidents et de stock."
        actions={
          <SimpleSelect
            value={periode}
            onValueChange={setPeriode}
            className="w-48"
            options={Object.entries(PERIODES).map(([value, v]) => ({ value, label: v.label }))}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Temps d'arrêt total" value={formatMinutes(totalArret)} sub={`sur ${arretLigne.length} ligne(s)`} icon={Clock} tone={totalArret > 0 ? "alert" : undefined} />
        <Kpi label="Incidents" value={formatNombre(nbIncidents)} sub={`${types.length} type(s) suivis`} icon={AlertOctagon} />
        <Kpi label="Lots produits" value={formatNombre(nbLots)} sub={`${production.length} produit(s)`} icon={Layers} />
        <Kpi label="Pièces en stock bas" value={formatNombre(stockBas.length)} sub={`seuil ≤ ${SEUIL_STOCK_BAS}`} icon={Boxes} tone={stockBas.length ? "alert" : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Temps d'arrêt par ligne</SectionTitle>
          </CardHeader>
          <CardContent>
            {arretLigne.length === 0 ? (
              <EmptyPanel title="Aucun arrêt sur la période" />
            ) : (
              <ChartContainer config={arretConfig} className="h-64 w-full">
                <BarChart data={arretLigne} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="ligne" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} width={40} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => {
                          const r = payload?.[0]?.payload as (typeof arretLigne)[number] | undefined;
                          return r ? `Ligne ${r.numLigne} · ${r.atelier}` : "";
                        }}
                      />
                    }
                  />
                  <Bar dataKey="total" fill="var(--color-total)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Incidents par type</SectionTitle>
          </CardHeader>
          <CardContent>
            {nbIncidents === 0 ? (
              <EmptyPanel title="Aucun incident sur la période" />
            ) : (
              <ChartContainer config={typeConfig} className="h-64 w-full">
                <BarChart data={parType} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis type="category" dataKey="libelle" tickLine={false} axisLine={false} fontSize={11} width={110} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="nombre" fill="var(--color-nombre)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Production par produit</SectionTitle>
          </CardHeader>
          <CardContent>
            {production.length === 0 ? (
              <EmptyPanel title="Aucun lot sur la période" />
            ) : (
              <ChartContainer config={prodConfig} className="h-64 w-full">
                <BarChart data={production} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="reference" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={32} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => (payload?.[0]?.payload as { designation?: string })?.designation ?? ""}
                      />
                    }
                  />
                  <Bar dataKey="nombre" fill="var(--color-nombre)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Pièces en stock bas</SectionTitle>
          </CardHeader>
          <CardContent>
            {stockBas.length === 0 ? (
              <EmptyPanel title="Aucune pièce sous le seuil" />
            ) : (
              <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {stockBas.map((x) => (
                  <li key={x.reference} className="flex items-center gap-3 px-3 py-2">
                    <Code>{x.reference}</Code>
                    <span className="min-w-0 flex-1 truncate text-sm">{x.libelle}</span>
                    {x.qteStock <= 0 ? (
                      <Badge variant="destructive">Rupture</Badge>
                    ) : (
                      <span className="font-mono text-sm font-semibold">{x.qteStock}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {raccourcis.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-semibold">Accès rapides</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {raccourcis.map((r) => (
              <Button key={r.to} asChild variant="outline" className="h-auto justify-between py-3">
                <Link to={r.to}>
                  {r.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
