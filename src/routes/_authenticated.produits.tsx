import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PackagePlus, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/app/confirm-delete";
import { DataTable, type Column } from "@/components/app/data-table";
import { Code, Field } from "@/components/app/form-bits";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader } from "@/components/app/page-header";
import { useApiMutation } from "@/components/app/use-api-mutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { produitsApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Produit } from "@/lib/api/types";
import { formatEuro, formatNombre } from "@/lib/format";
import { guard, pageHead } from "@/lib/guard";
import { produitSchema, stockSchema, toNumber } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/produits")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/produits"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(q.produits), queryClient.ensureQueryData(q.lots)]),
  head: () => pageHead("Produits", "Produits fabriqués, prix de vente et stock."),
  component: ProduitsPage,
});

function ProduitsPage() {
  const { data: produits } = useSuspenseQuery(q.produits);
  const { data: lots } = useSuspenseQuery(q.lots);
  const [edit, setEdit] = useState<Produit | "new" | null>(null);
  const [stock, setStock] = useState<Produit | null>(null);

  const remove = useApiMutation({
    mutationFn: (ref: string) => produitsApi.remove(ref),
    invalidate: [qk.produits],
    success: "Produit supprimé.",
  });

  const columns: Column<Produit>[] = [
    { key: "ref", header: "Référence", cell: (p) => <Code>{p.reference}</Code>, sortValue: (p) => p.reference },
    { key: "des", header: "Désignation", cell: (p) => <span className="font-medium">{p.designation}</span>, sortValue: (p) => p.designation },
    { key: "prix", header: "Prix de vente", cell: (p) => formatEuro(p.prixVente), sortValue: (p) => p.prixVente, className: "tabular-nums" },
    {
      key: "stock",
      header: "Stock",
      cell: (p) => <span className="font-mono tabular-nums">{formatNombre(p.qteStock)}</span>,
      sortValue: (p) => p.qteStock,
    },
    {
      key: "lots",
      header: "Lots fabriqués",
      cell: (p) => lots.filter((l) => l.reference === p.reference).length,
      sortValue: (p) => lots.filter((l) => l.reference === p.reference).length,
    },
    {
      key: "actions",
      header: "",
      className: "w-32 text-right",
      cell: (p) => {
        const used = lots.some((l) => l.reference === p.reference);
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="size-8" aria-label="Mettre à jour le stock" onClick={() => setStock(p)}>
              <PackagePlus className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Modifier" onClick={() => setEdit(p)}>
              <Pencil className="size-4" />
            </Button>
            <ConfirmDelete
              title={`Supprimer le produit ${p.reference} ?`}
              blockedReason={used ? "Impossible : ce produit est référencé par des lots de production." : null}
              onConfirm={() => remove.mutateAsync(p.reference)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        code="F3"
        title="Produits et stock"
        description="Référence, désignation, prix de vente unitaire et quantité en stock."
        actions={
          <Button onClick={() => setEdit("new")}>
            <Plus className="size-4" /> Nouveau produit
          </Button>
        }
      />
      <DataTable
        data={produits}
        columns={columns}
        rowKey={(p) => p.reference}
        searchText={(p) => `${p.reference} ${p.designation}`}
        searchPlaceholder="Référence ou désignation…"
        emptyMessage="Aucun produit."
        initialSort={{ key: "ref", dir: "asc" }}
      />
      {edit && <ProduitDialog produit={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {stock && <StockDialog produit={stock} onClose={() => setStock(null)} />}
    </div>
  );
}

function ProduitDialog({ produit, onClose }: { produit: Produit | null; onClose: () => void }) {
  const form = useForm<z.infer<typeof produitSchema>>({
    resolver: zodResolver(produitSchema),
    defaultValues: {
      reference: produit?.reference ?? "",
      designation: produit?.designation ?? "",
      prixVente: produit ? String(produit.prixVente) : "",
      qteStock: produit ? String(produit.qteStock) : "0",
    },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof produitSchema>) => {
      const body = {
        designation: v.designation.trim(),
        prixVente: toNumber(v.prixVente),
        qteStock: Number(v.qteStock),
      };
      return produit
        ? produitsApi.update(produit.reference, body)
        : produitsApi.create({ reference: v.reference.trim(), ...body });
    },
    invalidate: [qk.produits],
    success: produit ? "Produit modifié." : "Produit créé.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={produit ? `Modifier ${produit.reference}` : "Nouveau produit"}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Référence" htmlFor="reference" error={errors.reference?.message} hint={produit ? "La référence ne peut pas être modifiée." : "Unique."}>
        <Input id="reference" className="font-mono" disabled={!!produit} aria-invalid={!!errors.reference} {...form.register("reference")} />
      </Field>
      <Field label="Désignation" htmlFor="designation" error={errors.designation?.message}>
        <Input id="designation" aria-invalid={!!errors.designation} {...form.register("designation")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prix de vente unitaire (€)" htmlFor="prixVente" error={errors.prixVente?.message}>
          <Input id="prixVente" inputMode="decimal" aria-invalid={!!errors.prixVente} {...form.register("prixVente")} />
        </Field>
        <Field label="Quantité en stock" htmlFor="qteStock" error={errors.qteStock?.message}>
          <Input id="qteStock" type="number" min={0} step={1} aria-invalid={!!errors.qteStock} {...form.register("qteStock")} />
        </Field>
      </div>
    </FormDialog>
  );
}

function StockDialog({ produit, onClose }: { produit: Produit; onClose: () => void }) {
  const form = useForm<z.infer<typeof stockSchema>>({
    resolver: zodResolver(stockSchema),
    defaultValues: { qteStock: String(produit.qteStock) },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof stockSchema>) => produitsApi.updateStock(produit.reference, Number(v.qteStock)),
    invalidate: [qk.produits],
    success: "Stock mis à jour.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Stock — ${produit.designation}`}
      description={`Stock actuel : ${formatNombre(produit.qteStock)}`}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
      submitLabel="Mettre à jour"
    >
      <Field label="Nouvelle quantité en stock" htmlFor="qteStock" error={errors.qteStock?.message}>
        <Input id="qteStock" type="number" min={0} step={1} autoFocus aria-invalid={!!errors.qteStock} {...form.register("qteStock")} />
      </Field>
    </FormDialog>
  );
}
