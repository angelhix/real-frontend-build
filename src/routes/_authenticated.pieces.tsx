import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, PackagePlus, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/app/confirm-delete";
import { DataTable, type Column } from "@/components/app/data-table";
import { Code, Field, SimpleSelect } from "@/components/app/form-bits";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { EmptyPanel } from "@/components/app/states";
import { useApiMutation } from "@/components/app/use-api-mutation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api/client";
import { piecesApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Piece } from "@/lib/api/types";
import { formatEuro, formatNombre } from "@/lib/format";
import { guard, pageHead } from "@/lib/guard";
import { indexBy } from "@/lib/labels";
import { SEUIL_STOCK_BAS } from "@/lib/permissions";
import { composantSchema, pieceSchema, stockSchema, toNumber } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/pieces")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/pieces"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(q.pieces), queryClient.ensureQueryData(q.maintenances)]),
  head: () => pageHead("Pièces et nomenclature", "Pièces détachées, stock et composition."),
  component: PiecesPage,
});

export function StockBadge({ qte }: { qte: number }) {
  if (qte <= 0) return <Badge variant="destructive">Rupture</Badge>;
  if (qte <= SEUIL_STOCK_BAS)
    return <Badge className="border-transparent bg-warning text-warning-foreground hover:bg-warning">Stock bas</Badge>;
  return null;
}

function PiecesPage() {
  const { data: pieces } = useSuspenseQuery(q.pieces);
  const { data: maintenances } = useSuspenseQuery(q.maintenances);
  const [selected, setSelected] = useState<string | null>(null);
  const [edit, setEdit] = useState<Piece | "new" | null>(null);
  const [stock, setStock] = useState<Piece | null>(null);
  const [stockBas, setStockBas] = useState(false);

  const remove = useApiMutation({
    mutationFn: (ref: string) => piecesApi.remove(ref),
    invalidate: [qk.pieces],
    success: "Pièce supprimée.",
    onSuccess: (_d, ref) => selected === ref && setSelected(null),
  });

  const data = stockBas ? pieces.filter((p) => p.qteStock <= SEUIL_STOCK_BAS) : pieces;
  const nbBas = pieces.filter((p) => p.qteStock <= SEUIL_STOCK_BAS).length;

  const columns: Column<Piece>[] = [
    { key: "ref", header: "Référence", cell: (p) => <Code>{p.reference}</Code>, sortValue: (p) => p.reference },
    { key: "lib", header: "Libellé", cell: (p) => <span className="font-medium">{p.libelle}</span>, sortValue: (p) => p.libelle },
    { key: "prix", header: "Prix unitaire HT", cell: (p) => formatEuro(p.prixUnitaireHT), sortValue: (p) => p.prixUnitaireHT, className: "tabular-nums" },
    {
      key: "stock",
      header: "Stock",
      cell: (p) => (
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums">{formatNombre(p.qteStock)}</span>
          <StockBadge qte={p.qteStock} />
        </div>
      ),
      sortValue: (p) => p.qteStock,
    },
    {
      key: "actions",
      header: "",
      className: "w-32 text-right",
      cell: (p) => {
        const used = maintenances.some((m) => m.pieces.some((x) => x.reference === p.reference));
        return (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Mettre à jour le stock" onClick={() => setStock(p)}>
              <PackagePlus className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Modifier" onClick={() => setEdit(p)}>
              <Pencil className="size-4" />
            </Button>
            <ConfirmDelete
              title={`Supprimer la pièce ${p.reference} ?`}
              blockedReason={used ? "Impossible : cette pièce a été consommée lors de maintenances." : null}
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
        code="F8"
        title="Pièces et nomenclature"
        description="Une pièce peut entrer, en un ou plusieurs exemplaires, dans la composition d'une autre pièce."
        actions={
          <Button onClick={() => setEdit("new")}>
            <Plus className="size-4" /> Nouvelle pièce
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <DataTable
          data={data}
          columns={columns}
          rowKey={(p) => p.reference}
          searchText={(p) => `${p.reference} ${p.libelle}`}
          searchPlaceholder="Référence ou libellé…"
          emptyMessage={stockBas ? "Aucune pièce en stock bas." : "Aucune pièce."}
          initialSort={{ key: "ref", dir: "asc" }}
          onRowClick={(p) => setSelected(p.reference)}
          isRowActive={(p) => p.reference === selected}
          toolbar={
            <Button variant={stockBas ? "default" : "outline"} size="sm" onClick={() => setStockBas((v) => !v)}>
              <AlertTriangle className="size-4" /> Stock bas ({nbBas})
            </Button>
          }
        />
        <CompositionPanel reference={selected} pieces={pieces} />
      </div>
      {edit && <PieceDialog piece={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {stock && <StockDialog piece={stock} onClose={() => setStock(null)} />}
    </div>
  );
}

function CompositionPanel({ reference, pieces }: { reference: string | null; pieces: Piece[] }) {
  const piMap = useMemo(() => indexBy(pieces, (p) => p.reference), [pieces]);
  const piece = reference ? piMap.get(reference) : undefined;
  const composition = useQuery({ ...q.composition(reference ?? ""), enabled: !!reference });
  const [adding, setAdding] = useState(false);

  const removeComp = useApiMutation({
    mutationFn: (comp: string) => piecesApi.removeComposant(reference!, comp),
    invalidate: [qk.composition(reference ?? "")],
    success: "Composant retiré.",
  });

  const comps = composition.data ?? [];
  const coutTotal = comps.reduce((s, c) => s + (piMap.get(c.pieceComposant)?.prixUnitaireHT ?? 0) * c.quantite, 0);

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <SectionTitle
          actions={
            piece && (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Composant
              </Button>
            )
          }
        >
          {piece ? `Composition — ${piece.libelle}` : "Composition"}
        </SectionTitle>
      </CardHeader>
      <CardContent>
        {!piece ? (
          <EmptyPanel title="Sélectionnez une pièce">Sa nomenclature s'affichera ici.</EmptyPanel>
        ) : composition.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : composition.isError ? (
          <p role="alert" className="text-sm text-destructive">{errorMessage(composition.error)}</p>
        ) : comps.length === 0 ? (
          <EmptyPanel title="Pièce élémentaire">Elle n'est composée d'aucune autre pièce.</EmptyPanel>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-md border border-border">
              {comps.map((c) => {
                const p = piMap.get(c.pieceComposant);
                return (
                  <li key={c.pieceComposant} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-10 font-mono text-sm font-semibold">{c.quantite}×</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p?.libelle ?? c.pieceComposant}</div>
                      <div className="font-mono text-xs text-muted-foreground">{c.pieceComposant}</div>
                    </div>
                    <ConfirmDelete
                      title={`Retirer ${c.pieceComposant} de la composition ?`}
                      onConfirm={() => removeComp.mutateAsync(c.pieceComposant)}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-right text-xs text-muted-foreground">
              Coût des composants : <span className="font-mono font-semibold text-foreground">{formatEuro(coutTotal)}</span> HT
            </p>
          </>
        )}
      </CardContent>
      {adding && piece && (
        <ComposantDialog
          parent={piece}
          pieces={pieces.filter((p) => p.reference !== piece.reference && !comps.some((c) => c.pieceComposant === p.reference))}
          onClose={() => setAdding(false)}
        />
      )}
    </Card>
  );
}

function ComposantDialog({ parent, pieces, onClose }: { parent: Piece; pieces: Piece[]; onClose: () => void }) {
  const form = useForm<z.infer<typeof composantSchema>>({
    resolver: zodResolver(composantSchema),
    defaultValues: { pieceComposant: "", quantite: "1" },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof composantSchema>) =>
      piecesApi.addComposant(parent.reference, { pieceComposant: v.pieceComposant, quantite: Number(v.quantite) }),
    invalidate: [qk.composition(parent.reference)],
    success: "Composant ajouté.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Ajouter un composant à ${parent.reference}`}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Pièce composant" htmlFor="pieceComposant" error={errors.pieceComposant?.message}>
        <Controller
          control={form.control}
          name="pieceComposant"
          render={({ field }) => (
            <SimpleSelect
              id="pieceComposant"
              value={field.value}
              onValueChange={field.onChange}
              invalid={!!errors.pieceComposant}
              placeholder="Choisir une pièce"
              options={pieces.map((p) => ({ value: p.reference, label: `${p.reference} — ${p.libelle}` }))}
            />
          )}
        />
      </Field>
      <Field label="Quantité" htmlFor="quantite" error={errors.quantite?.message}>
        <Input id="quantite" type="number" min={1} step={1} aria-invalid={!!errors.quantite} {...form.register("quantite")} />
      </Field>
    </FormDialog>
  );
}

function PieceDialog({ piece, onClose }: { piece: Piece | null; onClose: () => void }) {
  const form = useForm<z.infer<typeof pieceSchema>>({
    resolver: zodResolver(pieceSchema),
    defaultValues: {
      reference: piece?.reference ?? "",
      libelle: piece?.libelle ?? "",
      prixUnitaireHT: piece ? String(piece.prixUnitaireHT) : "",
      qteStock: piece ? String(piece.qteStock) : "0",
    },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof pieceSchema>) => {
      const body = { libelle: v.libelle.trim(), prixUnitaireHT: toNumber(v.prixUnitaireHT), qteStock: Number(v.qteStock) };
      return piece ? piecesApi.update(piece.reference, body) : piecesApi.create({ reference: v.reference.trim(), ...body });
    },
    invalidate: [qk.pieces],
    success: piece ? "Pièce modifiée." : "Pièce créée.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={piece ? `Modifier ${piece.reference}` : "Nouvelle pièce"}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Référence" htmlFor="reference" error={errors.reference?.message} hint={piece ? "La référence ne peut pas être modifiée." : "Unique."}>
        <Input id="reference" className="font-mono" disabled={!!piece} aria-invalid={!!errors.reference} {...form.register("reference")} />
      </Field>
      <Field label="Libellé" htmlFor="libelle" error={errors.libelle?.message}>
        <Input id="libelle" aria-invalid={!!errors.libelle} {...form.register("libelle")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prix unitaire HT (€)" htmlFor="prixUnitaireHT" error={errors.prixUnitaireHT?.message}>
          <Input id="prixUnitaireHT" inputMode="decimal" aria-invalid={!!errors.prixUnitaireHT} {...form.register("prixUnitaireHT")} />
        </Field>
        <Field label="Quantité en stock" htmlFor="qteStock" error={errors.qteStock?.message}>
          <Input id="qteStock" type="number" min={0} step={1} aria-invalid={!!errors.qteStock} {...form.register("qteStock")} />
        </Field>
      </div>
    </FormDialog>
  );
}

function StockDialog({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  const form = useForm<z.infer<typeof stockSchema>>({
    resolver: zodResolver(stockSchema),
    defaultValues: { qteStock: String(piece.qteStock) },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof stockSchema>) => piecesApi.updateStock(piece.reference, Number(v.qteStock)),
    invalidate: [qk.pieces],
    success: "Stock mis à jour.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Stock — ${piece.libelle}`}
      description={`Stock actuel : ${formatNombre(piece.qteStock)}`}
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
