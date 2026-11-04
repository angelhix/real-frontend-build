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
import { PageHeader } from "@/components/app/page-header";
import { useApiMutation } from "@/components/app/use-api-mutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { machinesApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Machine } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { guard, pageHead } from "@/lib/guard";
import { indexBy, libelleLigne } from "@/lib/labels";
import { machineSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/machines")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/machines"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(q.machines),
      queryClient.ensureQueryData(q.lignes),
      queryClient.ensureQueryData(q.ateliers),
      queryClient.ensureQueryData(q.maintenances),
    ]),
  head: () => pageHead("Machines", "Machines des lignes de fabrication."),
  component: MachinesPage,
});

function MachinesPage() {
  const { data: machines } = useSuspenseQuery(q.machines);
  const { data: lignes } = useSuspenseQuery(q.lignes);
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const { data: maintenances } = useSuspenseQuery(q.maintenances);
  const atMap = useMemo(() => indexBy(ateliers, (a) => a.numAtelier), [ateliers]);
  const liMap = useMemo(() => indexBy(lignes, (l) => l.numLigne), [lignes]);

  const [ligneFiltre, setLigneFiltre] = useState("all");
  const [edit, setEdit] = useState<Machine | "new" | null>(null);

  const remove = useApiMutation({
    mutationFn: (id: number) => machinesApi.remove(id),
    invalidate: [qk.machines],
    success: "Machine retirée.",
  });

  const data = ligneFiltre === "all" ? machines : machines.filter((m) => String(m.numLigne) === ligneFiltre);
  const ligneOptions = lignes.map((l) => ({ value: String(l.numLigne), label: libelleLigne(l, atMap) }));

  const lastMaintenance = (id: number) =>
    maintenances
      .filter((m) => m.idMachine === id)
      .map((m) => m.dateDebut)
      .sort()
      .at(-1);

  const columns: Column<Machine>[] = [
    { key: "id", header: "ID", cell: (m) => <span className="font-mono text-xs">{m.idMachine}</span>, sortValue: (m) => m.idMachine, className: "w-16" },
    { key: "libelle", header: "Libellé", cell: (m) => <span className="font-medium">{m.libelle}</span>, sortValue: (m) => m.libelle },
    { key: "ligne", header: "Ligne", cell: (m) => libelleLigne(liMap.get(m.numLigne), atMap), sortValue: (m) => m.numLigne },
    {
      key: "maint",
      header: "Dernière maintenance",
      cell: (m) => <span className="text-muted-foreground">{formatDate(lastMaintenance(m.idMachine))}</span>,
      sortValue: (m) => lastMaintenance(m.idMachine) ?? "",
    },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (m) => {
        const used = maintenances.some((x) => x.idMachine === m.idMachine);
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="size-8" aria-label="Modifier" onClick={() => setEdit(m)}>
              <Pencil className="size-4" />
            </Button>
            <ConfirmDelete
              title={`Retirer la machine « ${m.libelle} » ?`}
              blockedReason={used ? "Impossible : des maintenances sont enregistrées sur cette machine." : null}
              onConfirm={() => remove.mutateAsync(m.idMachine)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        code="F2"
        title="Machines"
        description="Une machine appartient à une seule ligne de fabrication."
        actions={
          <Button onClick={() => setEdit("new")} disabled={lignes.length === 0}>
            <Plus className="size-4" /> Ajouter une machine
          </Button>
        }
      />
      <DataTable
        data={data}
        columns={columns}
        rowKey={(m) => m.idMachine}
        searchText={(m) => `${m.idMachine} ${m.libelle} ${libelleLigne(liMap.get(m.numLigne), atMap)}`}
        searchPlaceholder="Rechercher une machine…"
        emptyMessage={lignes.length === 0 ? "Créez d'abord une ligne dans « Ateliers et lignes »." : "Aucune machine."}
        initialSort={{ key: "ligne", dir: "asc" }}
        toolbar={
          <SimpleSelect
            value={ligneFiltre}
            onValueChange={setLigneFiltre}
            className="w-full md:w-64"
            options={[{ value: "all", label: "Toutes les lignes" }, ...ligneOptions]}
          />
        }
      />
      {edit && (
        <MachineDialog
          machine={edit === "new" ? null : edit}
          defaultLigne={ligneFiltre !== "all" ? ligneFiltre : ""}
          ligneOptions={ligneOptions}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}

function MachineDialog({
  machine,
  defaultLigne,
  ligneOptions,
  onClose,
}: {
  machine: Machine | null;
  defaultLigne: string;
  ligneOptions: { value: string; label: string }[];
  onClose: () => void;
}) {
  const form = useForm<z.infer<typeof machineSchema>>({
    resolver: zodResolver(machineSchema),
    defaultValues: { libelle: machine?.libelle ?? "", numLigne: machine ? String(machine.numLigne) : defaultLigne },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof machineSchema>) => {
      const body = { libelle: v.libelle.trim(), numLigne: Number(v.numLigne) };
      return machine ? machinesApi.update(machine.idMachine, body) : machinesApi.create(body);
    },
    invalidate: [qk.machines],
    success: machine ? "Machine modifiée." : "Machine ajoutée.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={machine ? `Modifier la machine n°${machine.idMachine}` : "Ajouter une machine"}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Libellé" htmlFor="libelle" error={errors.libelle?.message}>
        <Input id="libelle" aria-invalid={!!errors.libelle} {...form.register("libelle")} />
      </Field>
      <Field label="Ligne" htmlFor="numLigne" error={errors.numLigne?.message}>
        <Controller
          control={form.control}
          name="numLigne"
          render={({ field }) => (
            <SimpleSelect
              id="numLigne"
              value={field.value}
              onValueChange={field.onChange}
              invalid={!!errors.numLigne}
              options={ligneOptions}
              placeholder="Choisir une ligne"
            />
          )}
        />
      </Field>
    </FormDialog>
  );
}
