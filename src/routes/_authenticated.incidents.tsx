import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertOctagon, ArrowLeft, FilterX, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/app/confirm-delete";
import { DataTable, type Column } from "@/components/app/data-table";
import { Code, Field, SimpleSelect } from "@/components/app/form-bits";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { useApiMutation } from "@/components/app/use-api-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { incidentsApi, typesIncidentApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Incident, Lot, TypeIncident } from "@/lib/api/types";
import { useUtilisateur } from "@/lib/auth";
import { formatDate, formatMinutes, isoInRange } from "@/lib/format";
import { guard, pageHead } from "@/lib/guard";
import { indexBy, libelleLigne } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { incidentSchema, typeIncidentSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/incidents")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/incidents"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(q.incidents),
      queryClient.ensureQueryData(q.typesIncident),
      queryClient.ensureQueryData(q.lots),
      queryClient.ensureQueryData(q.lignes),
      queryClient.ensureQueryData(q.ateliers),
      queryClient.ensureQueryData(q.produits),
    ]),
  head: () => pageHead("Incidents", "Déclaration et suivi des incidents de production."),
  component: IncidentsPage,
});

function IncidentsPage() {
  const utilisateur = useUtilisateur();
  const { data: incidents } = useSuspenseQuery(q.incidents);
  const { data: types } = useSuspenseQuery(q.typesIncident);
  const { data: lots } = useSuspenseQuery(q.lots);
  const { data: lignes } = useSuspenseQuery(q.lignes);
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const { data: produits } = useSuspenseQuery(q.produits);

  const atMap = useMemo(() => indexBy(ateliers, (a) => a.numAtelier), [ateliers]);
  const liMap = useMemo(() => indexBy(lignes, (l) => l.numLigne), [lignes]);
  const lotMap = useMemo(() => indexBy(lots, (l) => l.idLot), [lots]);
  const tyMap = useMemo(() => indexBy(types, (t) => t.codeType), [types]);
  const prMap = useMemo(() => indexBy(produits, (p) => p.reference), [produits]);

  const [type, setType] = useState("all");
  const [ligne, setLigne] = useState("all");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [declaring, setDeclaring] = useState(false);
  const [editType, setEditType] = useState<TypeIncident | "new" | null>(null);

  const removeType = useApiMutation({
    mutationFn: (code: string) => typesIncidentApi.remove(code),
    invalidate: [qk.typesIncident],
    success: "Type d'incident supprimé.",
  });

  const filtered = incidents.filter((i) => {
    const lot = lotMap.get(i.idLot);
    return (
      (type === "all" || i.codeType === type) &&
      (ligne === "all" || String(lot?.numLigne) === ligne) &&
      (!du && !au ? true : lot ? isoInRange(lot.dateProduction, du || undefined, au || undefined) : false)
    );
  });
  const hasFilters = type !== "all" || ligne !== "all" || du || au;
  const totalArret = filtered.reduce((s, i) => s + i.tempsArret, 0);

  const columns: Column<Incident>[] = [
    { key: "num", header: "N°", cell: (i) => <span className="font-mono text-xs font-semibold">{i.numIncident}</span>, sortValue: (i) => i.numIncident, className: "w-16" },
    {
      key: "type",
      header: "Type",
      cell: (i) => (
        <div className="flex items-center gap-2">
          <Code>{i.codeType}</Code>
          <span>{tyMap.get(i.codeType)?.libelle ?? ""}</span>
        </div>
      ),
      sortValue: (i) => i.codeType,
    },
    {
      key: "lot",
      header: "Lot",
      cell: (i) => {
        const lot = lotMap.get(i.idLot);
        return (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold">#{i.idLot}</span>
            {lot && (
              <span className="text-xs text-muted-foreground">
                {formatDate(lot.dateProduction)} · {prMap.get(lot.reference)?.designation ?? lot.reference}
              </span>
            )}
          </div>
        );
      },
      sortValue: (i) => i.idLot,
    },
    {
      key: "ligne",
      header: "Ligne",
      cell: (i) => libelleLigne(liMap.get(lotMap.get(i.idLot)?.numLigne ?? -1), atMap),
      sortValue: (i) => lotMap.get(i.idLot)?.numLigne ?? 0,
    },
    {
      key: "arret",
      header: "Temps d'arrêt",
      cell: (i) => <span className="font-mono tabular-nums">{formatMinutes(i.tempsArret)}</span>,
      sortValue: (i) => i.tempsArret,
      className: "text-right",
      headClassName: "text-right",
    },
  ];

  const typeColumns: Column<TypeIncident>[] = [
    { key: "code", header: "Code", cell: (t) => <Code>{t.codeType}</Code>, sortValue: (t) => t.codeType, className: "w-28" },
    { key: "lib", header: "Libellé", cell: (t) => <span className="font-medium">{t.libelle}</span>, sortValue: (t) => t.libelle },
    {
      key: "nb",
      header: "Incidents",
      cell: (t) => incidents.filter((i) => i.codeType === t.codeType).length,
      sortValue: (t) => incidents.filter((i) => i.codeType === t.codeType).length,
    },
    ...(can.gererTypesIncident(utilisateur.role)
      ? [
          {
            key: "actions",
            header: "",
            className: "w-24 text-right",
            cell: (t: TypeIncident) => {
              const used = incidents.some((i) => i.codeType === t.codeType);
              return (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Modifier" onClick={() => setEditType(t)}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDelete
                    title={`Supprimer le type ${t.codeType} ?`}
                    blockedReason={used ? "Impossible : des incidents utilisent ce type." : null}
                    onConfirm={() => removeType.mutateAsync(t.codeType)}
                  />
                </div>
              );
            },
          } satisfies Column<TypeIncident>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        code="F6"
        title="Incidents de production"
        description="Chaque incident concerne un seul lot ; son type et le temps d'arrêt sont notés."
        actions={
          can.declarerIncident(utilisateur.role) && (
            <Button onClick={() => setDeclaring(true)}>
              <AlertOctagon className="size-4" /> Déclarer un incident
            </Button>
          )
        }
      />
      <Tabs defaultValue="incidents">
        <TabsList>
          <TabsTrigger value="incidents">Incidents ({incidents.length})</TabsTrigger>
          <TabsTrigger value="types">Types d'incident ({types.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="incidents" className="mt-4 space-y-3">
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(i) => i.numIncident}
            searchText={(i) => `${i.numIncident} ${i.codeType} ${tyMap.get(i.codeType)?.libelle ?? ""} ${i.idLot}`}
            searchPlaceholder="N°, type, lot…"
            emptyMessage={hasFilters ? "Aucun incident ne correspond aux filtres." : "Aucun incident déclaré."}
            initialSort={{ key: "num", dir: "desc" }}
            toolbar={
              <>
                <SimpleSelect
                  value={type}
                  onValueChange={setType}
                  className="w-48"
                  options={[{ value: "all", label: "Tous les types" }, ...types.map((t) => ({ value: t.codeType, label: `${t.codeType} — ${t.libelle}` }))]}
                />
                <SimpleSelect
                  value={ligne}
                  onValueChange={setLigne}
                  className="w-48"
                  options={[{ value: "all", label: "Toutes les lignes" }, ...lignes.map((l) => ({ value: String(l.numLigne), label: libelleLigne(l, atMap) }))]}
                />
                <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} className="w-40" aria-label="Lots produits à partir du" />
                <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} className="w-40" aria-label="Lots produits jusqu'au" />
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={() => { setType("all"); setLigne("all"); setDu(""); setAu(""); }}>
                    <FilterX className="size-4" /> Effacer
                  </Button>
                )}
              </>
            }
          />
          <p className="text-right text-sm text-muted-foreground">
            Temps d'arrêt cumulé : <span className="font-mono font-semibold text-foreground">{formatMinutes(totalArret)}</span>
          </p>
        </TabsContent>
        <TabsContent value="types" className="mt-4">
          <DataTable
            data={types}
            columns={typeColumns}
            rowKey={(t) => t.codeType}
            searchText={(t) => `${t.codeType} ${t.libelle}`}
            searchPlaceholder="Code ou libellé…"
            emptyMessage="Aucun type d'incident."
            initialSort={{ key: "code", dir: "asc" }}
            toolbar={
              can.gererTypesIncident(utilisateur.role) && (
                <Button className="md:ml-auto" onClick={() => setEditType("new")}>
                  <Plus className="size-4" /> Nouveau type
                </Button>
              )
            }
          />
        </TabsContent>
      </Tabs>
      {declaring && <DeclarerIncidentDialog onClose={() => setDeclaring(false)} />}
      {editType && <TypeDialog type={editType === "new" ? null : editType} onClose={() => setEditType(null)} />}
    </div>
  );
}

/** Scénario 5.1 : choix du lot récent, puis du type et du temps d'arrêt. */
function DeclarerIncidentDialog({ onClose }: { onClose: () => void }) {
  const { data: lots } = useSuspenseQuery(q.lots);
  const { data: types } = useSuspenseQuery(q.typesIncident);
  const { data: lignes } = useSuspenseQuery(q.lignes);
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const { data: produits } = useSuspenseQuery(q.produits);
  const atMap = useMemo(() => indexBy(ateliers, (a) => a.numAtelier), [ateliers]);
  const liMap = useMemo(() => indexBy(lignes, (l) => l.numLigne), [lignes]);
  const prMap = useMemo(() => indexBy(produits, (p) => p.reference), [produits]);

  const [step, setStep] = useState<1 | 2>(1);
  const [recherche, setRecherche] = useState("");

  const form = useForm<z.infer<typeof incidentSchema>>({
    resolver: zodResolver(incidentSchema),
    defaultValues: { idLot: "", codeType: "", tempsArret: "" },
  });
  const idLot = form.watch("idLot");
  const lotChoisi = lots.find((l) => String(l.idLot) === idLot);

  const recents = useMemo(() => {
    const sorted = [...lots].sort((a, b) => b.dateProduction.localeCompare(a.dateProduction) || b.idLot - a.idLot);
    const nq = recherche.trim().toLowerCase().replace(/^#/, "");
    if (!nq) return sorted.slice(0, 12);
    return sorted
      .filter((l) =>
        `${l.idLot} ${l.reference} ${prMap.get(l.reference)?.designation ?? ""} ${libelleLigne(liMap.get(l.numLigne), atMap)}`
          .toLowerCase()
          .includes(nq),
      )
      .slice(0, 30);
  }, [lots, recherche, prMap, liMap, atMap]);

  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof incidentSchema>) =>
      incidentsApi.create({ idLot: Number(v.idLot), codeType: v.codeType, tempsArret: Number(v.tempsArret) }),
    invalidate: [qk.incidents],
    success: (inc) => (inc?.numIncident ? `Incident n°${inc.numIncident} enregistré.` : "Incident enregistré."),
    onSuccess: onClose,
  });
  const { errors } = form.formState;

  const lotLabel = (l: Lot) => `${formatDate(l.dateProduction)} · ${prMap.get(l.reference)?.designation ?? l.reference}`;

  return (
    <FormDialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title="Déclarer un incident"
      description={step === 1 ? "Étape 1/2 — Sélectionnez le lot concerné." : "Étape 2/2 — Type d'incident et temps d'arrêt."}
      onSubmit={
        step === 1
          ? (e) => {
              e.preventDefault();
              if (!idLot) {
                form.setError("idLot", { message: "Sélectionnez un lot." });
                return;
              }
              setStep(2);
            }
          : form.handleSubmit((v) => save.mutate(v))
      }
      submitting={save.isPending}
      submitLabel={step === 1 ? "Continuer" : "Enregistrer l'incident"}
    >
      {step === 1 ? (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un lot : n°, produit, ligne…"
              className="pl-8"
            />
          </div>
          {errors.idLot && <p role="alert" className="text-xs font-medium text-destructive">{errors.idLot.message}</p>}
          {recents.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Lot introuvable pour « {recherche} ». Essayez un autre numéro ou produit.
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border" role="listbox">
              {recents.map((l) => {
                const sel = String(l.idLot) === idLot;
                return (
                  <li key={l.idLot}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={sel}
                      onClick={() => {
                        form.setValue("idLot", String(l.idLot));
                        form.clearErrors("idLot");
                      }}
                      onDoubleClick={() => {
                        form.setValue("idLot", String(l.idLot));
                        setStep(2);
                      }}
                      className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted", sel && "bg-accent")}
                    >
                      <span className="w-14 font-mono text-sm font-semibold">#{l.idLot}</span>
                      <span className="flex-1 text-sm">{lotLabel(l)}</span>
                      <span className="hidden text-xs text-muted-foreground sm:inline">{libelleLigne(liMap.get(l.numLigne), atMap)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!recherche && <p className="text-xs text-muted-foreground">Les 12 lots les plus récents sont affichés.</p>}
        </>
      ) : (
        <>
          {lotChoisi && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/50 px-3 py-2">
              <Badge variant="outline" className="font-mono">Lot #{lotChoisi.idLot}</Badge>
              <span className="flex-1 text-sm">{lotLabel(lotChoisi)}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" /> Changer
              </Button>
            </div>
          )}
          <Field label="Type d'incident" htmlFor="codeType" error={errors.codeType?.message}>
            <Controller
              control={form.control}
              name="codeType"
              render={({ field }) => (
                <SimpleSelect
                  id="codeType"
                  value={field.value}
                  onValueChange={field.onChange}
                  invalid={!!errors.codeType}
                  placeholder="Choisir un type"
                  options={types.map((t) => ({ value: t.codeType, label: `${t.codeType} — ${t.libelle}` }))}
                />
              )}
            />
          </Field>
          <Field label="Temps d'arrêt (minutes)" htmlFor="tempsArret" error={errors.tempsArret?.message} hint="Nombre entier, 0 si aucun arrêt.">
            <Input id="tempsArret" type="number" min={0} step={1} inputMode="numeric" autoFocus aria-invalid={!!errors.tempsArret} {...form.register("tempsArret")} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

function TypeDialog({ type, onClose }: { type: TypeIncident | null; onClose: () => void }) {
  const form = useForm<z.infer<typeof typeIncidentSchema>>({
    resolver: zodResolver(typeIncidentSchema),
    defaultValues: { codeType: type?.codeType ?? "", libelle: type?.libelle ?? "" },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof typeIncidentSchema>) =>
      type
        ? typesIncidentApi.update(type.codeType, { libelle: v.libelle.trim() })
        : typesIncidentApi.create({ codeType: v.codeType.trim().toUpperCase(), libelle: v.libelle.trim() }),
    invalidate: [qk.typesIncident],
    success: type ? "Type modifié." : "Type créé.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={type ? `Modifier le type ${type.codeType}` : "Nouveau type d'incident"}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Code" htmlFor="codeType" error={errors.codeType?.message} hint={type ? "Le code ne peut pas être modifié." : "10 caractères max., unique."}>
        <Input id="codeType" className="font-mono uppercase" disabled={!!type} aria-invalid={!!errors.codeType} {...form.register("codeType")} />
      </Field>
      <Field label="Libellé" htmlFor="libelle" error={errors.libelle?.message}>
        <Input id="libelle" aria-invalid={!!errors.libelle} {...form.register("libelle")} />
      </Field>
    </FormDialog>
  );
}
