import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";

import { DataTable, type Column } from "@/components/app/data-table";
import { Field, MultiPicker, SimpleSelect } from "@/components/app/form-bits";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { useApiMutation } from "@/components/app/use-api-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maintenancesApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Maintenance } from "@/lib/api/types";
import { useUtilisateur } from "@/lib/auth";
import { formatDate, formatMinutes, todayIso } from "@/lib/format";
import { guard, pageHead } from "@/lib/guard";
import { indexBy, libelleLigne, nomOperateur } from "@/lib/labels";
import { maintenanceSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/maintenances")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/maintenances"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(q.maintenances),
      queryClient.ensureQueryData(q.machines),
      queryClient.ensureQueryData(q.lignes),
      queryClient.ensureQueryData(q.ateliers),
      queryClient.ensureQueryData(q.operateurs),
      queryClient.ensureQueryData(q.pieces),
    ]),
  head: () => pageHead("Maintenances", "Enregistrement des maintenances machines et des pièces consommées."),
  component: MaintenancesPage,
});

function MaintenancesPage() {
  const { data: maintenances } = useSuspenseQuery(q.maintenances);
  const { data: machines } = useSuspenseQuery(q.machines);
  const { data: lignes } = useSuspenseQuery(q.lignes);
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const { data: pieces } = useSuspenseQuery(q.pieces);

  const maMap = useMemo(() => indexBy(machines, (m) => m.idMachine), [machines]);
  const liMap = useMemo(() => indexBy(lignes, (l) => l.numLigne), [lignes]);
  const atMap = useMemo(() => indexBy(ateliers, (a) => a.numAtelier), [ateliers]);
  const opMap = useMemo(() => indexBy(operateurs, (o) => o.matricule), [operateurs]);
  const piMap = useMemo(() => indexBy(pieces, (p) => p.reference), [pieces]);

  const [machine, setMachine] = useState("all");
  const [creating, setCreating] = useState(false);

  const data = machine === "all" ? maintenances : maintenances.filter((m) => String(m.idMachine) === machine);

  const columns: Column<Maintenance>[] = [
    { key: "id", header: "N°", cell: (m) => <span className="font-mono text-xs font-semibold">{m.idMaintenance}</span>, sortValue: (m) => m.idMaintenance, className: "w-16" },
    {
      key: "date",
      header: "Début",
      cell: (m) => (
        <span>
          {formatDate(m.dateDebut)} <span className="font-mono text-xs text-muted-foreground">{m.heureDebut.slice(0, 5)}</span>
        </span>
      ),
      sortValue: (m) => `${m.dateDebut} ${m.heureDebut}`,
    },
    {
      key: "machine",
      header: "Machine",
      cell: (m) => {
        const mach = maMap.get(m.idMachine);
        return (
          <div className="flex flex-col">
            <span className="font-medium">{mach?.libelle ?? `Machine ${m.idMachine}`}</span>
            <span className="text-xs text-muted-foreground">{libelleLigne(liMap.get(mach?.numLigne ?? -1), atMap)}</span>
          </div>
        );
      },
      sortValue: (m) => maMap.get(m.idMachine)?.libelle ?? "",
    },
    { key: "duree", header: "Durée", cell: (m) => <span className="font-mono">{formatMinutes(m.dureeMinutes)}</span>, sortValue: (m) => m.dureeMinutes },
    {
      key: "ops",
      header: "Intervenants",
      cell: (m) => (
        <div className="flex flex-wrap gap-1">
          {m.operateurs.map((x) => (
            <Badge key={x} variant="secondary" className="font-normal">{nomOperateur(opMap.get(x), x)}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "pieces",
      header: "Pièces consommées",
      cell: (m) =>
        m.pieces.length === 0 ? (
          <span className="text-muted-foreground">Aucune</span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {m.pieces.map((p) => (
              <li key={p.reference}>
                <span className="font-mono font-semibold">{p.quantite}×</span> {piMap.get(p.reference)?.libelle ?? p.reference}
              </li>
            ))}
          </ul>
        ),
      sortValue: (m) => m.pieces.reduce((s, p) => s + p.quantite, 0),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        code="F7"
        title="Maintenances"
        description="Date, heure de début, durée, intervenants et pièces consommées (le stock est décrémenté)."
        actions={
          <Button onClick={() => setCreating(true)} disabled={machines.length === 0}>
            <Wrench className="size-4" /> Enregistrer une maintenance
          </Button>
        }
      />
      <DataTable
        data={data}
        columns={columns}
        rowKey={(m) => m.idMaintenance}
        searchText={(m) =>
          `${m.idMaintenance} ${maMap.get(m.idMachine)?.libelle ?? ""} ${m.operateurs.map((x) => nomOperateur(opMap.get(x), x)).join(" ")} ${m.pieces
            .map((p) => `${p.reference} ${piMap.get(p.reference)?.libelle ?? ""}`)
            .join(" ")}`
        }
        searchPlaceholder="Machine, intervenant, pièce…"
        emptyMessage="Aucune maintenance enregistrée."
        initialSort={{ key: "date", dir: "desc" }}
        toolbar={
          <SimpleSelect
            value={machine}
            onValueChange={setMachine}
            className="w-full md:w-64"
            options={[{ value: "all", label: "Toutes les machines" }, ...machines.map((m) => ({ value: String(m.idMachine), label: m.libelle }))]}
          />
        }
      />
      {creating && <MaintenanceDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

/** Scénario 5.2 : machine, date/heure/durée, intervenants, pièces consommées avec contrôle du stock. */
function MaintenanceDialog({ onClose }: { onClose: () => void }) {
  const utilisateur = useUtilisateur();
  const { data: machines } = useSuspenseQuery(q.machines);
  const { data: lignes } = useSuspenseQuery(q.lignes);
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const { data: pieces } = useSuspenseQuery(q.pieces);
  const liMap = useMemo(() => indexBy(lignes, (l) => l.numLigne), [lignes]);
  const atMap = useMemo(() => indexBy(ateliers, (a) => a.numAtelier), [ateliers]);
  const stocks = useMemo(() => Object.fromEntries(pieces.map((p) => [p.reference, p.qteStock])), [pieces]);
  const schema = useMemo(() => maintenanceSchema(stocks), [stocks]);

  const moi =
    utilisateur.matricule && operateurs.some((o) => o.matricule === utilisateur.matricule) ? [utilisateur.matricule] : [];
  const now = new Date();
  const heure = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { idMachine: "", dateDebut: todayIso(), heureDebut: heure, dureeMinutes: "", operateurs: moi, pieces: [] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "pieces" });
  const lignesPieces = form.watch("pieces");

  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof schema>) =>
      maintenancesApi.create({
        idMachine: Number(v.idMachine),
        dateDebut: v.dateDebut,
        heureDebut: v.heureDebut,
        dureeMinutes: Number(v.dureeMinutes),
        operateurs: v.operateurs,
        pieces: v.pieces.map((p) => ({ reference: p.reference, quantite: Number(p.quantite) })),
      }),
    invalidate: [qk.maintenances, qk.pieces],
    success: (m) => (m?.idMaintenance ? `Maintenance n°${m.idMaintenance} enregistrée, stocks mis à jour.` : "Maintenance enregistrée."),
    onSuccess: onClose,
  });
  const { errors } = form.formState;

  return (
    <FormDialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title="Enregistrer une maintenance"
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Machine" htmlFor="idMachine" error={errors.idMachine?.message}>
        <Controller
          control={form.control}
          name="idMachine"
          render={({ field }) => (
            <SimpleSelect
              id="idMachine"
              value={field.value}
              onValueChange={field.onChange}
              invalid={!!errors.idMachine}
              placeholder="Choisir une machine"
              options={machines.map((m) => ({
                value: String(m.idMachine),
                label: m.libelle,
                hint: libelleLigne(liMap.get(m.numLigne), atMap),
              }))}
            />
          )}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date" htmlFor="dateDebut" error={errors.dateDebut?.message}>
          <Input id="dateDebut" type="date" aria-invalid={!!errors.dateDebut} {...form.register("dateDebut")} />
        </Field>
        <Field label="Heure de début" htmlFor="heureDebut" error={errors.heureDebut?.message}>
          <Input id="heureDebut" type="time" aria-invalid={!!errors.heureDebut} {...form.register("heureDebut")} />
        </Field>
        <Field label="Durée (minutes)" htmlFor="dureeMinutes" error={errors.dureeMinutes?.message}>
          <Input id="dureeMinutes" type="number" min={1} step={1} inputMode="numeric" aria-invalid={!!errors.dureeMinutes} {...form.register("dureeMinutes")} />
        </Field>
      </div>
      <Field label="Opérateurs intervenants" error={errors.operateurs?.message}>
        <Controller
          control={form.control}
          name="operateurs"
          render={({ field }) => (
            <MultiPicker
              value={field.value}
              onChange={field.onChange}
              invalid={!!errors.operateurs}
              options={operateurs.map((o) => ({ value: o.matricule, label: nomOperateur(o), hint: o.matricule }))}
            />
          )}
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pièces consommées</Label>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ reference: "", quantite: "1" })}>
            <Plus className="size-4" /> Ajouter une pièce
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
            Aucune pièce consommée.
          </p>
        ) : (
          <ul className="space-y-2">
            {fields.map((f, i) => {
              const ref = lignesPieces[i]?.reference;
              const stock = ref ? stocks[ref] : undefined;
              const err = errors.pieces?.[i];
              return (
                <li key={f.id} className="rounded-md border border-border p-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Controller
                        control={form.control}
                        name={`pieces.${i}.reference`}
                        render={({ field }) => (
                          <SimpleSelect
                            value={field.value}
                            onValueChange={field.onChange}
                            invalid={!!err?.reference}
                            placeholder="Choisir une pièce"
                            options={pieces.map((p) => ({
                              value: p.reference,
                              label: `${p.reference} — ${p.libelle}`,
                              hint: `stock ${p.qteStock}`,
                              disabled: p.qteStock <= 0,
                            }))}
                          />
                        )}
                      />
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={stock}
                      step={1}
                      className="w-24"
                      aria-label="Quantité"
                      aria-invalid={!!err?.quantite}
                      {...form.register(`pieces.${i}.quantite`)}
                    />
                    <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Retirer la pièce" onClick={() => remove(i)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-1 flex justify-between gap-2 text-xs">
                    <span className="font-medium text-destructive">{err?.reference?.message ?? err?.quantite?.message ?? ""}</span>
                    {stock !== undefined && <span className="text-muted-foreground">Disponible : {stock}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </FormDialog>
  );
}
