import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FilterX, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { DataTable, type Column } from "@/components/app/data-table";
import { Code, Field, MultiPicker, SimpleSelect } from "@/components/app/form-bits";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { useApiMutation } from "@/components/app/use-api-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lotsApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Lot } from "@/lib/api/types";
import { useUtilisateur } from "@/lib/auth";
import { formatDate, isoInRange, todayIso } from "@/lib/format";
import { guard, pageHead } from "@/lib/guard";
import { indexBy, libelleLigne, nomOperateur } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { lotSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/lots")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/lots"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(q.lots),
      queryClient.ensureQueryData(q.lignes),
      queryClient.ensureQueryData(q.ateliers),
      queryClient.ensureQueryData(q.produits),
      queryClient.ensureQueryData(q.operateurs),
      queryClient.ensureQueryData(q.incidents),
    ]),
  head: () => pageHead("Lots de production", "Enregistrement et historique des lots de production."),
  component: LotsPage,
});

function LotsPage() {
  const utilisateur = useUtilisateur();
  const { data: lots } = useSuspenseQuery(q.lots);
  const { data: lignes } = useSuspenseQuery(q.lignes);
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const { data: produits } = useSuspenseQuery(q.produits);
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const { data: incidents } = useSuspenseQuery(q.incidents);

  const atMap = useMemo(() => indexBy(ateliers, (a) => a.numAtelier), [ateliers]);
  const liMap = useMemo(() => indexBy(lignes, (l) => l.numLigne), [lignes]);
  const prMap = useMemo(() => indexBy(produits, (p) => p.reference), [produits]);
  const opMap = useMemo(() => indexBy(operateurs, (o) => o.matricule), [operateurs]);

  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [ligne, setLigne] = useState("all");
  const [produit, setProduit] = useState("all");
  const [creating, setCreating] = useState(false);

  const filtered = lots.filter(
    (l) =>
      isoInRange(l.dateProduction, du || undefined, au || undefined) &&
      (ligne === "all" || String(l.numLigne) === ligne) &&
      (produit === "all" || l.reference === produit),
  );
  const hasFilters = du || au || ligne !== "all" || produit !== "all";

  const columns: Column<Lot>[] = [
    { key: "id", header: "Lot", cell: (l) => <span className="font-mono text-xs font-semibold">#{l.idLot}</span>, sortValue: (l) => l.idLot, className: "w-20" },
    { key: "date", header: "Date", cell: (l) => formatDate(l.dateProduction), sortValue: (l) => l.dateProduction },
    { key: "ligne", header: "Ligne", cell: (l) => libelleLigne(liMap.get(l.numLigne), atMap), sortValue: (l) => l.numLigne },
    {
      key: "produit",
      header: "Produit",
      cell: (l) => (
        <div className="flex flex-col">
          <span className="font-medium">{prMap.get(l.reference)?.designation ?? "—"}</span>
          <span className="font-mono text-xs text-muted-foreground">{l.reference}</span>
        </div>
      ),
      sortValue: (l) => prMap.get(l.reference)?.designation ?? l.reference,
    },
    {
      key: "ouvriers",
      header: "Ouvriers",
      cell: (l) => (
        <div className="flex flex-wrap gap-1">
          {l.ouvriers.map((m) => (
            <Badge key={m} variant="secondary" className="font-normal">
              {nomOperateur(opMap.get(m), m)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "incidents",
      header: "Incidents",
      cell: (l) => {
        const n = incidents.filter((i) => i.idLot === l.idLot).length;
        return n ? <Badge variant="destructive">{n}</Badge> : <span className="text-muted-foreground">0</span>;
      },
      sortValue: (l) => incidents.filter((i) => i.idLot === l.idLot).length,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        code="F4"
        title="Lots de production"
        description="Chaque lot indique la ligne, le produit fabriqué, la date et les ouvriers."
        actions={
          can.enregistrerLot(utilisateur.role) && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Enregistrer un lot
            </Button>
          )
        }
      />
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(l) => l.idLot}
        searchText={(l) =>
          `${l.idLot} ${l.reference} ${prMap.get(l.reference)?.designation ?? ""} ${l.ouvriers
            .map((m) => `${m} ${nomOperateur(opMap.get(m), "")}`)
            .join(" ")}`
        }
        searchPlaceholder="N° de lot, produit, ouvrier…"
        emptyMessage={hasFilters ? "Aucun lot ne correspond aux filtres." : "Aucun lot enregistré."}
        initialSort={{ key: "date", dir: "desc" }}
        toolbar={
          <>
            <div className="flex items-center gap-1.5">
              <label htmlFor="du" className="text-xs text-muted-foreground">Du</label>
              <Input id="du" type="date" value={du} onChange={(e) => setDu(e.target.value)} className="w-40" />
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor="au" className="text-xs text-muted-foreground">au</label>
              <Input id="au" type="date" value={au} onChange={(e) => setAu(e.target.value)} className="w-40" />
            </div>
            <SimpleSelect
              value={ligne}
              onValueChange={setLigne}
              className="w-48"
              options={[
                { value: "all", label: "Toutes les lignes" },
                ...lignes.map((l) => ({ value: String(l.numLigne), label: libelleLigne(l, atMap) })),
              ]}
            />
            <SimpleSelect
              value={produit}
              onValueChange={setProduit}
              className="w-48"
              options={[
                { value: "all", label: "Tous les produits" },
                ...produits.map((p) => ({ value: p.reference, label: p.designation })),
              ]}
            />
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDu("");
                  setAu("");
                  setLigne("all");
                  setProduit("all");
                }}
              >
                <FilterX className="size-4" /> Effacer
              </Button>
            )}
          </>
        }
      />
      {creating && <LotDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function LotDialog({ onClose }: { onClose: () => void }) {
  const utilisateur = useUtilisateur();
  const { data: lignes } = useSuspenseQuery(q.lignes);
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const { data: produits } = useSuspenseQuery(q.produits);
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const atMap = useMemo(() => indexBy(ateliers, (a) => a.numAtelier), [ateliers]);

  const moi = utilisateur.matricule && operateurs.some((o) => o.matricule === utilisateur.matricule)
    ? [utilisateur.matricule]
    : [];

  const form = useForm<z.infer<typeof lotSchema>>({
    resolver: zodResolver(lotSchema),
    defaultValues: { numLigne: "", reference: "", dateProduction: todayIso(), ouvriers: moi },
  });
  const numLigne = form.watch("numLigne");
  const nbRequis = lignes.find((l) => String(l.numLigne) === numLigne)?.nbOperateurs;
  const nbChoisis = form.watch("ouvriers").length;

  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof lotSchema>) =>
      lotsApi.create({
        numLigne: Number(v.numLigne),
        reference: v.reference,
        dateProduction: v.dateProduction,
        ouvriers: v.ouvriers,
      }),
    invalidate: [qk.lots, qk.produits],
    success: (lot) => (lot?.idLot ? `Lot #${lot.idLot} enregistré.` : "Lot enregistré."),
    onSuccess: onClose,
  });
  const { errors } = form.formState;

  return (
    <FormDialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title="Enregistrer un lot de production"
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ligne de production" htmlFor="numLigne" error={errors.numLigne?.message}>
          <Controller
            control={form.control}
            name="numLigne"
            render={({ field }) => (
              <SimpleSelect
                id="numLigne"
                value={field.value}
                onValueChange={field.onChange}
                invalid={!!errors.numLigne}
                placeholder="Choisir une ligne"
                options={lignes.map((l) => ({ value: String(l.numLigne), label: libelleLigne(l, atMap) }))}
              />
            )}
          />
        </Field>
        <Field label="Date de production" htmlFor="dateProduction" error={errors.dateProduction?.message}>
          <Input id="dateProduction" type="date" max={todayIso()} aria-invalid={!!errors.dateProduction} {...form.register("dateProduction")} />
        </Field>
      </div>
      <Field label="Produit fabriqué" htmlFor="reference" error={errors.reference?.message}>
        <Controller
          control={form.control}
          name="reference"
          render={({ field }) => (
            <SimpleSelect
              id="reference"
              value={field.value}
              onValueChange={field.onChange}
              invalid={!!errors.reference}
              placeholder="Choisir un produit"
              options={produits.map((p) => ({ value: p.reference, label: p.designation, hint: p.reference }))}
            />
          )}
        />
      </Field>
      <Field
        label="Ouvriers"
        error={errors.ouvriers?.message}
        hint={
          nbRequis !== undefined ? (
            <>
              Cette ligne nécessite {nbRequis} opérateur(s) — {nbChoisis} sélectionné(s).
            </>
          ) : (
            "Au moins un ouvrier."
          )
        }
      >
        <Controller
          control={form.control}
          name="ouvriers"
          render={({ field }) => (
            <MultiPicker
              value={field.value}
              onChange={field.onChange}
              invalid={!!errors.ouvriers}
              options={operateurs.map((o) => ({ value: o.matricule, label: nomOperateur(o), hint: o.matricule }))}
              emptyMessage="Aucun opérateur."
            />
          )}
        />
      </Field>
      <p className="text-xs text-muted-foreground">
        <Code>N° de lot</Code> attribué automatiquement à l'enregistrement.
      </p>
    </FormDialog>
  );
}
