import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Crown, Pencil, Plus } from "lucide-react";
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
import { equipesApi, operateursApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Equipe, Operateur } from "@/lib/api/types";
import { formatDate, todayIso } from "@/lib/format";
import { guard, pageHead } from "@/lib/guard";
import { indexBy, nomOperateur } from "@/lib/labels";
import { equipeSchema, operateurSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/operateurs")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/operateurs"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(q.operateurs),
      queryClient.ensureQueryData(q.equipes),
      queryClient.ensureQueryData(q.ateliers),
    ]),
  head: () => pageHead("Opérateurs et équipes", "Opérateurs, affectations aux équipes et responsables."),
  component: OperateursPage,
});

function OperateursPage() {
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const { data: equipes } = useSuspenseQuery(q.equipes);
  const { data: ateliers } = useSuspenseQuery(q.ateliers);
  const eqMap = useMemo(() => indexBy(equipes, (e) => e.numEquipe), [equipes]);
  const opMap = useMemo(() => indexBy(operateurs, (o) => o.matricule), [operateurs]);

  const [editOp, setEditOp] = useState<Operateur | "new" | null>(null);
  const [editEq, setEditEq] = useState<Equipe | "new" | null>(null);
  const [equipeFiltre, setEquipeFiltre] = useState("all");

  const removeOp = useApiMutation({
    mutationFn: (m: string) => operateursApi.remove(m),
    invalidate: [qk.operateurs],
    success: "Opérateur supprimé.",
  });
  const removeEq = useApiMutation({
    mutationFn: (n: number) => equipesApi.remove(n),
    invalidate: [qk.equipes],
    success: "Équipe supprimée.",
  });

  const responsabilites = (m: string) => {
    const r: string[] = [];
    ateliers.filter((a) => a.responsable === m).forEach((a) => r.push(`atelier « ${a.libelle} »`));
    equipes.filter((e) => e.responsable === m).forEach((e) => r.push(`équipe « ${e.libelle} »`));
    return r;
  };

  const opColumns: Column<Operateur>[] = [
    { key: "mat", header: "Matricule", cell: (o) => <Code>{o.matricule}</Code>, sortValue: (o) => o.matricule },
    {
      key: "nom",
      header: "Nom",
      cell: (o) => {
        const resp = responsabilites(o.matricule);
        return (
          <span className="inline-flex items-center gap-1.5 font-medium">
            {o.nom.toUpperCase()} {o.prenom}
            {resp.length > 0 && <Crown className="size-3.5 text-primary" aria-label="Responsable" />}
          </span>
        );
      },
      sortValue: (o) => `${o.nom} ${o.prenom}`,
    },
    { key: "entree", header: "Entrée", cell: (o) => formatDate(o.dateEntree), sortValue: (o) => o.dateEntree },
    {
      key: "equipe",
      header: "Équipe",
      cell: (o) => eqMap.get(o.numEquipe)?.libelle ?? "—",
      sortValue: (o) => eqMap.get(o.numEquipe)?.libelle ?? "",
    },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (o) => {
        const resp = responsabilites(o.matricule);
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="size-8" aria-label="Modifier" onClick={() => setEditOp(o)}>
              <Pencil className="size-4" />
            </Button>
            <ConfirmDelete
              title={`Supprimer ${o.prenom} ${o.nom} ?`}
              blockedReason={resp.length ? `Impossible : responsable de ${resp.join(", ")}.` : null}
              onConfirm={() => removeOp.mutateAsync(o.matricule)}
            />
          </div>
        );
      },
    },
  ];

  const eqColumns: Column<Equipe>[] = [
    { key: "num", header: "N°", cell: (e) => <span className="font-mono text-xs">{e.numEquipe}</span>, sortValue: (e) => e.numEquipe, className: "w-16" },
    { key: "lib", header: "Libellé", cell: (e) => <span className="font-medium">{e.libelle}</span>, sortValue: (e) => e.libelle },
    {
      key: "resp",
      header: "Responsable",
      cell: (e) =>
        e.responsable ? nomOperateur(opMap.get(e.responsable), e.responsable) : <span className="text-muted-foreground">Non désigné</span>,
      sortValue: (e) => (e.responsable ? nomOperateur(opMap.get(e.responsable), e.responsable) : ""),
    },
    {
      key: "membres",
      header: "Membres",
      cell: (e) => <Badge variant="secondary">{operateurs.filter((o) => o.numEquipe === e.numEquipe).length}</Badge>,
      sortValue: (e) => operateurs.filter((o) => o.numEquipe === e.numEquipe).length,
    },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (e) => {
        const used = operateurs.some((o) => o.numEquipe === e.numEquipe);
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="size-8" aria-label="Modifier" onClick={() => setEditEq(e)}>
              <Pencil className="size-4" />
            </Button>
            <ConfirmDelete
              title={`Supprimer l'équipe « ${e.libelle} » ?`}
              blockedReason={used ? "Impossible : des opérateurs sont affectés à cette équipe." : null}
              onConfirm={() => removeEq.mutateAsync(e.numEquipe)}
            />
          </div>
        );
      },
    },
  ];

  const opData = equipeFiltre === "all" ? operateurs : operateurs.filter((o) => String(o.numEquipe) === equipeFiltre);

  return (
    <div className="space-y-6">
      <PageHeader
        code="F5"
        title="Opérateurs et équipes"
        description="Chaque opérateur appartient à une seule équipe ; chaque équipe a un seul responsable."
      />
      <Tabs defaultValue="operateurs">
        <TabsList>
          <TabsTrigger value="operateurs">Opérateurs ({operateurs.length})</TabsTrigger>
          <TabsTrigger value="equipes">Équipes ({equipes.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="operateurs" className="mt-4">
          <DataTable
            data={opData}
            columns={opColumns}
            rowKey={(o) => o.matricule}
            searchText={(o) => `${o.matricule} ${o.nom} ${o.prenom}`}
            searchPlaceholder="Matricule, nom, prénom…"
            emptyMessage={equipes.length === 0 ? "Créez d'abord une équipe." : "Aucun opérateur."}
            initialSort={{ key: "nom", dir: "asc" }}
            toolbar={
              <>
                <SimpleSelect
                  value={equipeFiltre}
                  onValueChange={setEquipeFiltre}
                  className="w-full md:w-56"
                  options={[
                    { value: "all", label: "Toutes les équipes" },
                    ...equipes.map((e) => ({ value: String(e.numEquipe), label: e.libelle })),
                  ]}
                />
                <Button className="md:ml-auto" onClick={() => setEditOp("new")} disabled={equipes.length === 0}>
                  <Plus className="size-4" /> Nouvel opérateur
                </Button>
              </>
            }
          />
        </TabsContent>
        <TabsContent value="equipes" className="mt-4">
          <DataTable
            data={equipes}
            columns={eqColumns}
            rowKey={(e) => e.numEquipe}
            searchText={(e) => `${e.numEquipe} ${e.libelle}`}
            searchPlaceholder="Rechercher une équipe…"
            emptyMessage="Aucune équipe."
            initialSort={{ key: "num", dir: "asc" }}
            toolbar={
              <Button className="md:ml-auto" onClick={() => setEditEq("new")}>
                <Plus className="size-4" /> Nouvelle équipe
              </Button>
            }
          />
        </TabsContent>
      </Tabs>

      {editOp && <OperateurDialog operateur={editOp === "new" ? null : editOp} onClose={() => setEditOp(null)} />}
      {editEq && <EquipeDialog equipe={editEq === "new" ? null : editEq} onClose={() => setEditEq(null)} />}
    </div>
  );
}

function OperateurDialog({ operateur, onClose }: { operateur: Operateur | null; onClose: () => void }) {
  const { data: equipes } = useSuspenseQuery(q.equipes);
  const form = useForm<z.infer<typeof operateurSchema>>({
    resolver: zodResolver(operateurSchema),
    defaultValues: {
      matricule: operateur?.matricule ?? "",
      nom: operateur?.nom ?? "",
      prenom: operateur?.prenom ?? "",
      dateEntree: operateur?.dateEntree?.slice(0, 10) ?? todayIso(),
      numEquipe: operateur ? String(operateur.numEquipe) : "",
    },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof operateurSchema>) => {
      const body = { nom: v.nom.trim(), prenom: v.prenom.trim(), dateEntree: v.dateEntree, numEquipe: Number(v.numEquipe) };
      return operateur
        ? operateursApi.update(operateur.matricule, body)
        : operateursApi.create({ matricule: v.matricule.trim(), ...body });
    },
    invalidate: [qk.operateurs],
    success: operateur ? "Opérateur modifié." : "Opérateur créé.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={operateur ? `Modifier ${operateur.prenom} ${operateur.nom}` : "Nouvel opérateur"}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Matricule" htmlFor="matricule" error={errors.matricule?.message} hint={operateur ? "Le matricule ne peut pas être modifié." : "Unique."}>
        <Input id="matricule" className="font-mono" disabled={!!operateur} aria-invalid={!!errors.matricule} {...form.register("matricule")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" htmlFor="nom" error={errors.nom?.message}>
          <Input id="nom" aria-invalid={!!errors.nom} {...form.register("nom")} />
        </Field>
        <Field label="Prénom" htmlFor="prenom" error={errors.prenom?.message}>
          <Input id="prenom" aria-invalid={!!errors.prenom} {...form.register("prenom")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date d'entrée" htmlFor="dateEntree" error={errors.dateEntree?.message}>
          <Input id="dateEntree" type="date" aria-invalid={!!errors.dateEntree} {...form.register("dateEntree")} />
        </Field>
        <Field label="Équipe" htmlFor="numEquipe" error={errors.numEquipe?.message}>
          <Controller
            control={form.control}
            name="numEquipe"
            render={({ field }) => (
              <SimpleSelect
                id="numEquipe"
                value={field.value}
                onValueChange={field.onChange}
                invalid={!!errors.numEquipe}
                placeholder="Choisir une équipe"
                options={equipes.map((e) => ({ value: String(e.numEquipe), label: e.libelle }))}
              />
            )}
          />
        </Field>
      </div>
    </FormDialog>
  );
}

const AUCUN = "__aucun__";

function EquipeDialog({ equipe, onClose }: { equipe: Equipe | null; onClose: () => void }) {
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const form = useForm<z.infer<typeof equipeSchema>>({
    resolver: zodResolver(equipeSchema),
    defaultValues: { libelle: equipe?.libelle ?? "", responsable: equipe?.responsable ?? AUCUN },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof equipeSchema>) => {
      const body = { libelle: v.libelle.trim(), responsable: v.responsable === AUCUN || !v.responsable ? null : v.responsable };
      return equipe ? equipesApi.update(equipe.numEquipe, body) : equipesApi.create(body);
    },
    invalidate: [qk.equipes],
    success: equipe ? "Équipe modifiée." : "Équipe créée.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  const membres = equipe ? operateurs.filter((o) => o.numEquipe === equipe.numEquipe) : [];
  const candidats = equipe && membres.length ? membres : operateurs;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={equipe ? `Modifier l'équipe n°${equipe.numEquipe}` : "Nouvelle équipe"}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Libellé" htmlFor="libelle" error={errors.libelle?.message}>
        <Input id="libelle" aria-invalid={!!errors.libelle} {...form.register("libelle")} />
      </Field>
      <Field
        label="Responsable d'équipe"
        htmlFor="responsable"
        error={errors.responsable?.message}
        hint={equipe && membres.length ? "Choisi parmi les membres de l'équipe." : "Vous pourrez le désigner plus tard."}
      >
        <Controller
          control={form.control}
          name="responsable"
          render={({ field }) => (
            <SimpleSelect
              id="responsable"
              value={field.value}
              onValueChange={field.onChange}
              options={[
                { value: AUCUN, label: "Aucun pour l'instant" },
                ...candidats.map((o) => ({ value: o.matricule, label: nomOperateur(o), hint: o.matricule })),
              ]}
            />
          )}
        />
      </Field>
    </FormDialog>
  );
}
