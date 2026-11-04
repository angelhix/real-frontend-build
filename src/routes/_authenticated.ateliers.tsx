import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/app/confirm-delete";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, SimpleSelect } from "@/components/app/form-bits";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { EmptyPanel } from "@/components/app/states";
import { useApiMutation } from "@/components/app/use-api-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ateliersApi, lignesApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Atelier, Ligne } from "@/lib/api/types";
import { guard, pageHead } from "@/lib/guard";
import { indexBy, nomOperateur } from "@/lib/labels";
import { atelierSchema, ligneSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/ateliers")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/ateliers"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(q.ateliers),
      queryClient.ensureQueryData(q.lignes),
      queryClient.ensureQueryData(q.machines),
      queryClient.ensureQueryData(q.operateurs),
      queryClient.ensureQueryData(q.lots),
    ]),
  head: () => pageHead("Ateliers et lignes", "Gestion des ateliers, de leurs responsables et des lignes de fabrication."),
  component: AteliersPage,
});

function AteliersPage() {
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const { data: lignes } = useSuspenseQuery(q.lignes);
  const { data: machines } = useSuspenseQuery(q.machines);
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const { data: lots } = useSuspenseQuery(q.lots);

  const opMap = useMemo(() => indexBy(operateurs, (o) => o.matricule), [operateurs]);
  const [selected, setSelected] = useState<number | null>(ateliers[0]?.numAtelier ?? null);
  const [editAtelier, setEditAtelier] = useState<Atelier | "new" | null>(null);
  const [editLigne, setEditLigne] = useState<Ligne | "new" | null>(null);

  const removeAtelier = useApiMutation({
    mutationFn: (id: number) => ateliersApi.remove(id),
    invalidate: [qk.ateliers],
    success: "Atelier supprimé.",
  });
  const removeLigne = useApiMutation({
    mutationFn: (id: number) => lignesApi.remove(id),
    invalidate: [qk.lignes],
    success: "Ligne supprimée.",
  });

  const atelier = ateliers.find((a) => a.numAtelier === selected) ?? null;
  const lignesAtelier = lignes.filter((l) => l.numAtelier === selected);

  const columns: Column<Atelier>[] = [
    {
      key: "num",
      header: "N°",
      cell: (a) => <span className="font-mono text-xs">{a.numAtelier}</span>,
      sortValue: (a) => a.numAtelier,
      className: "w-16",
    },
    { key: "libelle", header: "Libellé", cell: (a) => <span className="font-medium">{a.libelle}</span>, sortValue: (a) => a.libelle },
    {
      key: "resp",
      header: "Responsable",
      cell: (a) => nomOperateur(opMap.get(a.responsable), a.responsable),
      sortValue: (a) => nomOperateur(opMap.get(a.responsable), a.responsable),
    },
    {
      key: "lignes",
      header: "Lignes",
      cell: (a) => lignes.filter((l) => l.numAtelier === a.numAtelier).length,
      sortValue: (a) => lignes.filter((l) => l.numAtelier === a.numAtelier).length,
    },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (a) => {
        const used = lignes.some((l) => l.numAtelier === a.numAtelier);
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Modifier"
              onClick={(e) => {
                e.stopPropagation();
                setEditAtelier(a);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <ConfirmDelete
              title={`Supprimer l'atelier « ${a.libelle} » ?`}
              blockedReason={used ? "Impossible : cet atelier comporte des lignes. Supprimez-les d'abord." : null}
              onConfirm={() => removeAtelier.mutateAsync(a.numAtelier)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        code="F1"
        title="Ateliers et lignes"
        description="Chaque atelier a un responsable et comporte plusieurs lignes de fabrication."
        actions={
          <Button onClick={() => setEditAtelier("new")}>
            <Plus className="size-4" /> Nouvel atelier
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <DataTable
          data={ateliers}
          columns={columns}
          rowKey={(a) => a.numAtelier}
          searchText={(a) => `${a.numAtelier} ${a.libelle} ${nomOperateur(opMap.get(a.responsable), a.responsable)}`}
          searchPlaceholder="Rechercher un atelier…"
          emptyMessage="Aucun atelier. Créez le premier atelier."
          initialSort={{ key: "num", dir: "asc" }}
          onRowClick={(a) => setSelected(a.numAtelier)}
          isRowActive={(a) => a.numAtelier === selected}
        />

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <SectionTitle
              actions={
                atelier && (
                  <Button size="sm" variant="outline" onClick={() => setEditLigne("new")}>
                    <Plus className="size-4" /> Ligne
                  </Button>
                )
              }
            >
              {atelier ? `Lignes — ${atelier.libelle}` : "Lignes de l'atelier"}
            </SectionTitle>
          </CardHeader>
          <CardContent>
            {!atelier ? (
              <EmptyPanel title="Sélectionnez un atelier">Ses lignes de fabrication s'afficheront ici.</EmptyPanel>
            ) : lignesAtelier.length === 0 ? (
              <EmptyPanel title="Aucune ligne">Ajoutez une ligne avec son nombre d'opérateurs nécessaires.</EmptyPanel>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {lignesAtelier.map((l) => {
                  const nbMachines = machines.filter((m) => m.numLigne === l.numLigne).length;
                  const nbLots = lots.filter((lot) => lot.numLigne === l.numLigne).length;
                  const used = nbMachines > 0 || nbLots > 0;
                  return (
                    <li key={l.numLigne} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex size-9 items-center justify-center rounded-sm bg-secondary font-mono text-sm font-semibold">
                        {l.numLigne}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">Ligne {l.numLigne}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.nbOperateurs} opérateur(s) nécessaire(s) · {nbMachines} machine(s)
                        </div>
                      </div>
                      {nbLots > 0 && <Badge variant="secondary">{nbLots} lots</Badge>}
                      <Button variant="ghost" size="icon" className="size-8" aria-label="Modifier la ligne" onClick={() => setEditLigne(l)}>
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete
                        title={`Supprimer la ligne ${l.numLigne} ?`}
                        blockedReason={
                          used ? "Impossible : cette ligne est référencée par des machines ou des lots." : null
                        }
                        onConfirm={() => removeLigne.mutateAsync(l.numLigne)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {editAtelier && (
        <AtelierDialog
          atelier={editAtelier === "new" ? null : editAtelier}
          onClose={() => setEditAtelier(null)}
          onCreated={(a) => setSelected(a.numAtelier)}
        />
      )}
      {editLigne && atelier && (
        <LigneDialog
          ligne={editLigne === "new" ? null : editLigne}
          defaultAtelier={atelier.numAtelier}
          onClose={() => setEditLigne(null)}
        />
      )}
    </div>
  );
}

function AtelierDialog({
  atelier,
  onClose,
  onCreated,
}: {
  atelier: Atelier | null;
  onClose: () => void;
  onCreated: (a: Atelier) => void;
}) {
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const form = useForm<z.infer<typeof atelierSchema>>({
    resolver: zodResolver(atelierSchema),
    defaultValues: { libelle: atelier?.libelle ?? "", responsable: atelier?.responsable ?? "" },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof atelierSchema>) =>
      atelier ? ateliersApi.update(atelier.numAtelier, v) : ateliersApi.create(v),
    invalidate: [qk.ateliers],
    success: atelier ? "Atelier modifié." : "Atelier créé.",
    onSuccess: (a) => {
      if (!atelier && a) onCreated(a);
      onClose();
    },
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={atelier ? `Modifier l'atelier n°${atelier.numAtelier}` : "Nouvel atelier"}
      description="Un atelier a un seul responsable, choisi parmi les opérateurs."
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Libellé" htmlFor="libelle" error={errors.libelle?.message}>
        <Input id="libelle" aria-invalid={!!errors.libelle} {...form.register("libelle")} />
      </Field>
      <Field label="Responsable" htmlFor="responsable" error={errors.responsable?.message}>
        <Controller
          control={form.control}
          name="responsable"
          render={({ field }) => (
            <SimpleSelect
              id="responsable"
              value={field.value}
              onValueChange={field.onChange}
              invalid={!!errors.responsable}
              placeholder="Choisir un opérateur"
              options={operateurs.map((o) => ({ value: o.matricule, label: nomOperateur(o), hint: o.matricule }))}
            />
          )}
        />
      </Field>
    </FormDialog>
  );
}

function LigneDialog({
  ligne,
  defaultAtelier,
  onClose,
}: {
  ligne: Ligne | null;
  defaultAtelier: number;
  onClose: () => void;
}) {
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const form = useForm<z.infer<typeof ligneSchema>>({
    resolver: zodResolver(ligneSchema),
    defaultValues: {
      numAtelier: String(ligne?.numAtelier ?? defaultAtelier),
      nbOperateurs: ligne ? String(ligne.nbOperateurs) : "",
    },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof ligneSchema>) => {
      const body = { numAtelier: Number(v.numAtelier), nbOperateurs: Number(v.nbOperateurs) };
      return ligne ? lignesApi.update(ligne.numLigne, body) : lignesApi.create(body);
    },
    invalidate: [qk.lignes],
    success: ligne ? "Ligne modifiée." : "Ligne ajoutée.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={ligne ? `Modifier la ligne ${ligne.numLigne}` : "Nouvelle ligne"}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Atelier" htmlFor="numAtelier" error={errors.numAtelier?.message}>
        <Controller
          control={form.control}
          name="numAtelier"
          render={({ field }) => (
            <SimpleSelect
              id="numAtelier"
              value={field.value}
              onValueChange={field.onChange}
              options={ateliers.map((a) => ({ value: String(a.numAtelier), label: a.libelle }))}
            />
          )}
        />
      </Field>
      <Field label="Nombre d'opérateurs nécessaires" htmlFor="nbOperateurs" error={errors.nbOperateurs?.message}>
        <Input
          id="nbOperateurs"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          aria-invalid={!!errors.nbOperateurs}
          {...form.register("nbOperateurs")}
        />
      </Field>
    </FormDialog>
  );
}
