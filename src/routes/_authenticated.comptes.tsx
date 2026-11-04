import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/app/confirm-delete";
import { DataTable, type Column } from "@/components/app/data-table";
import { Field, SimpleSelect } from "@/components/app/form-bits";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { useApiMutation } from "@/components/app/use-api-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { comptesApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Role, Utilisateur } from "@/lib/api/types";
import { useUtilisateur } from "@/lib/auth";
import { guard, pageHead } from "@/lib/guard";
import { indexBy, nomOperateur } from "@/lib/labels";
import { ROLES, ROLE_LABELS } from "@/lib/permissions";
import { compteSchema } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/comptes")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/comptes"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(q.comptes), queryClient.ensureQueryData(q.operateurs)]),
  head: () => pageHead("Comptes utilisateurs", "Gestion des comptes et des rôles d'accès."),
  component: ComptesPage,
});

function ComptesPage() {
  const moi = useUtilisateur();
  const { data: comptes } = useSuspenseQuery(q.comptes);
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const opMap = useMemo(() => indexBy(operateurs, (o) => o.matricule), [operateurs]);
  const [edit, setEdit] = useState<Utilisateur | "new" | null>(null);
  const [role, setRole] = useState("all");

  const remove = useApiMutation({
    mutationFn: (id: number) => comptesApi.remove(id),
    invalidate: [qk.comptes],
    success: "Compte supprimé.",
  });

  const columns: Column<Utilisateur>[] = [
    { key: "id", header: "Identifiant", cell: (c) => <span className="font-medium">{c.identifiant}</span>, sortValue: (c) => c.identifiant },
    { key: "role", header: "Rôle", cell: (c) => <Badge variant={c.role === "ADMIN" ? "default" : "secondary"}>{ROLE_LABELS[c.role]}</Badge>, sortValue: (c) => ROLE_LABELS[c.role] },
    {
      key: "op",
      header: "Opérateur lié",
      cell: (c) => (c.matricule ? `${nomOperateur(opMap.get(c.matricule), c.matricule)} (${c.matricule})` : <span className="text-muted-foreground">—</span>),
    },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="size-8" aria-label="Modifier" onClick={() => setEdit(c)}>
            <Pencil className="size-4" />
          </Button>
          <ConfirmDelete
            title={`Supprimer le compte « ${c.identifiant} » ?`}
            blockedReason={c.id === moi.id ? "Vous ne pouvez pas supprimer votre propre compte." : null}
            onConfirm={() => remove.mutateAsync(c.id)}
          />
        </div>
      ),
    },
  ];

  const data = role === "all" ? comptes : comptes.filter((c) => c.role === role);

  return (
    <div className="space-y-6">
      <PageHeader
        code="F11"
        title="Comptes utilisateurs"
        description="Chaque utilisateur ne voit que les fonctions autorisées par son rôle."
        actions={
          <Button onClick={() => setEdit("new")}>
            <UserPlus className="size-4" /> Nouveau compte
          </Button>
        }
      />
      <DataTable
        data={data}
        columns={columns}
        rowKey={(c) => c.id}
        searchText={(c) => `${c.identifiant} ${ROLE_LABELS[c.role]} ${c.matricule ?? ""}`}
        searchPlaceholder="Identifiant, rôle, matricule…"
        emptyMessage="Aucun compte."
        initialSort={{ key: "id", dir: "asc" }}
        toolbar={
          <SimpleSelect
            value={role}
            onValueChange={setRole}
            className="w-full md:w-56"
            options={[{ value: "all", label: "Tous les rôles" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))]}
          />
        }
      />
      {edit && <CompteDialog compte={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

const AUCUN = "__aucun__";

function CompteDialog({ compte, onClose }: { compte: Utilisateur | null; onClose: () => void }) {
  const { data: operateurs } = useSuspenseQuery(q.operateurs);
  const schema = useMemo(() => compteSchema(!compte), [compte]);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifiant: compte?.identifiant ?? "",
      role: compte?.role ?? "",
      matricule: compte?.matricule ?? AUCUN,
      motDePasse: "",
    },
  });
  const role = form.watch("role");
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof schema>) => {
      const body = {
        identifiant: v.identifiant.trim(),
        role: v.role as Role,
        matricule: v.matricule === AUCUN ? null : v.matricule,
        ...(v.motDePasse ? { motDePasse: v.motDePasse } : {}),
      };
      return compte ? comptesApi.update(compte.id, body) : comptesApi.create(body);
    },
    invalidate: [qk.comptes],
    success: compte ? "Compte modifié." : "Compte créé.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={compte ? `Modifier le compte « ${compte.identifiant} »` : "Nouveau compte"}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Identifiant" htmlFor="identifiant" error={errors.identifiant?.message}>
        <Input id="identifiant" autoComplete="off" aria-invalid={!!errors.identifiant} {...form.register("identifiant")} />
      </Field>
      <Field label="Rôle" htmlFor="role" error={errors.role?.message}>
        <Controller
          control={form.control}
          name="role"
          render={({ field }) => (
            <SimpleSelect
              id="role"
              value={field.value}
              onValueChange={field.onChange}
              invalid={!!errors.role}
              placeholder="Choisir un rôle"
              options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
          )}
        />
      </Field>
      <Field
        label="Opérateur lié"
        htmlFor="matricule"
        hint={role === "OPERATEUR" || role === "RESPONSABLE" ? "Recommandé : permet de pré-remplir ses saisies." : "Facultatif."}
      >
        <Controller
          control={form.control}
          name="matricule"
          render={({ field }) => (
            <SimpleSelect
              id="matricule"
              value={field.value}
              onValueChange={field.onChange}
              options={[
                { value: AUCUN, label: "Aucun" },
                ...operateurs.map((o) => ({ value: o.matricule, label: nomOperateur(o), hint: o.matricule })),
              ]}
            />
          )}
        />
      </Field>
      <Field
        label={compte ? "Nouveau mot de passe" : "Mot de passe"}
        htmlFor="motDePasse"
        error={errors.motDePasse?.message}
        hint={compte ? "Laisser vide pour conserver le mot de passe actuel." : "8 caractères minimum."}
      >
        <Input id="motDePasse" type="password" autoComplete="new-password" aria-invalid={!!errors.motDePasse} {...form.register("motDePasse")} />
      </Field>
    </FormDialog>
  );
}
