import { zodResolver } from "@hookform/resolvers/zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/app/confirm-delete";
import { DataTable, type Column } from "@/components/app/data-table";
import { Code, Field, SimpleSelect } from "@/components/app/form-bits";
import { FormDialog } from "@/components/app/form-dialog";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { EmptyPanel } from "@/components/app/states";
import { useApiMutation } from "@/components/app/use-api-mutation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { approvisionnementsApi, fournisseursApi } from "@/lib/api/endpoints";
import { q, qk } from "@/lib/api/queries";
import type { Approvisionnement, Fournisseur } from "@/lib/api/types";
import { formatDate, formatEuro, todayIso } from "@/lib/format";
import { guard, pageHead } from "@/lib/guard";
import { indexBy } from "@/lib/labels";
import { achatSchema, fournisseurSchema, toNumber } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/fournisseurs")({
  beforeLoad: ({ context }) => guard(context.utilisateur, "/fournisseurs"),
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(q.fournisseurs),
      queryClient.ensureQueryData(q.pieces),
      queryClient.ensureQueryData(q.approvisionnements()),
    ]),
  head: () => pageHead("Fournisseurs et achats", "Fournisseurs de pièces et historique des prix d'achat."),
  component: FournisseursPage,
});

function FournisseursPage() {
  const { data: fournisseurs } = useSuspenseQuery(q.fournisseurs);
  const { data: achats } = useSuspenseQuery(q.approvisionnements());
  const [edit, setEdit] = useState<Fournisseur | "new" | null>(null);

  const remove = useApiMutation({
    mutationFn: (code: string) => fournisseursApi.remove(code),
    invalidate: [qk.fournisseurs],
    success: "Fournisseur supprimé.",
  });

  const columns: Column<Fournisseur>[] = [
    { key: "code", header: "Code", cell: (f) => <Code>{f.codeFournisseur}</Code>, sortValue: (f) => f.codeFournisseur },
    { key: "rs", header: "Raison sociale", cell: (f) => <span className="font-medium">{f.raisonSociale}</span>, sortValue: (f) => f.raisonSociale },
    { key: "adr", header: "Adresse", cell: (f) => <span className="text-muted-foreground">{f.adresse || "—"}</span> },
    { key: "tel", header: "Téléphone", cell: (f) => <span className="font-mono text-xs">{f.telephone || "—"}</span> },
    {
      key: "pieces",
      header: "Pièces fournies",
      cell: (f) => new Set(achats.filter((a) => a.codeFournisseur === f.codeFournisseur).map((a) => a.reference)).size,
      sortValue: (f) => new Set(achats.filter((a) => a.codeFournisseur === f.codeFournisseur).map((a) => a.reference)).size,
    },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (f) => {
        const used = achats.some((a) => a.codeFournisseur === f.codeFournisseur);
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="size-8" aria-label="Modifier" onClick={() => setEdit(f)}>
              <Pencil className="size-4" />
            </Button>
            <ConfirmDelete
              title={`Supprimer ${f.raisonSociale} ?`}
              blockedReason={used ? "Impossible : des achats sont enregistrés pour ce fournisseur." : null}
              onConfirm={() => remove.mutateAsync(f.codeFournisseur)}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        code="F9"
        title="Fournisseurs et achats"
        description="Une pièce peut avoir plusieurs fournisseurs ; chaque prix d'achat est mémorisé avec sa date."
      />
      <Tabs defaultValue="achats">
        <TabsList>
          <TabsTrigger value="achats">Historique des achats</TabsTrigger>
          <TabsTrigger value="fournisseurs">Fournisseurs ({fournisseurs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="achats" className="mt-4">
          <AchatsPanel />
        </TabsContent>
        <TabsContent value="fournisseurs" className="mt-4">
          <DataTable
            data={fournisseurs}
            columns={columns}
            rowKey={(f) => f.codeFournisseur}
            searchText={(f) => `${f.codeFournisseur} ${f.raisonSociale} ${f.adresse ?? ""} ${f.telephone ?? ""}`}
            searchPlaceholder="Code, raison sociale, adresse…"
            emptyMessage="Aucun fournisseur."
            initialSort={{ key: "rs", dir: "asc" }}
            toolbar={
              <Button className="md:ml-auto" onClick={() => setEdit("new")}>
                <Plus className="size-4" /> Nouveau fournisseur
              </Button>
            }
          />
        </TabsContent>
      </Tabs>
      {edit && <FournisseurDialog fournisseur={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/** Scénario 5.4 : choisir une pièce, ajouter un achat, voir l'historique des prix par fournisseur. */
function AchatsPanel() {
  const { data: pieces } = useSuspenseQuery(q.pieces);
  const { data: fournisseurs } = useSuspenseQuery(q.fournisseurs);
  const { data: achats } = useSuspenseQuery(q.approvisionnements());
  const foMap = useMemo(() => indexBy(fournisseurs, (f) => f.codeFournisseur), [fournisseurs]);
  const [reference, setReference] = useState(pieces[0]?.reference ?? "");
  const [adding, setAdding] = useState(false);

  const removeAchat = useApiMutation({
    mutationFn: (a: Approvisionnement) => approvisionnementsApi.remove(a),
    invalidate: [["approvisionnements"]],
    success: "Achat supprimé.",
  });

  const piece = pieces.find((p) => p.reference === reference);
  const historique = achats.filter((a) => a.reference === reference);
  const parFournisseur = useMemo(() => {
    const groups = new Map<string, Approvisionnement[]>();
    historique.forEach((a) => groups.set(a.codeFournisseur, [...(groups.get(a.codeFournisseur) ?? []), a]));
    return [...groups.entries()].map(([code, list]) => {
      const sorted = [...list].sort((x, y) => x.dateAchat.localeCompare(y.dateAchat));
      const prix = sorted.map((s) => s.prixAchat);
      return {
        code,
        nom: foMap.get(code)?.raisonSociale ?? code,
        dernier: sorted.at(-1)!,
        min: Math.min(...prix),
        max: Math.max(...prix),
        nb: sorted.length,
      };
    });
  }, [historique, foMap]);

  const chartConfig: ChartConfig = Object.fromEntries(
    parFournisseur.map((f, i) => [f.code, { label: f.nom, color: SERIES_COLORS[i % SERIES_COLORS.length] }]),
  );
  const chartData = useMemo(() => {
    const dates = [...new Set(historique.map((a) => a.dateAchat.slice(0, 10)))].sort();
    return dates.map((d) => {
      const row: Record<string, string | number> = { date: formatDate(d) };
      historique.filter((a) => a.dateAchat.slice(0, 10) === d).forEach((a) => (row[a.codeFournisseur] = a.prixAchat));
      return row;
    });
  }, [historique]);

  const columns: Column<Approvisionnement>[] = [
    { key: "date", header: "Date d'achat", cell: (a) => formatDate(a.dateAchat), sortValue: (a) => a.dateAchat },
    { key: "f", header: "Fournisseur", cell: (a) => foMap.get(a.codeFournisseur)?.raisonSociale ?? a.codeFournisseur, sortValue: (a) => foMap.get(a.codeFournisseur)?.raisonSociale ?? "" },
    { key: "prix", header: "Prix d'achat", cell: (a) => <span className="font-mono">{formatEuro(a.prixAchat)}</span>, sortValue: (a) => a.prixAchat, className: "text-right", headClassName: "text-right" },
    {
      key: "actions",
      header: "",
      className: "w-12 text-right",
      cell: (a) => <ConfirmDelete title="Supprimer cet achat ?" onConfirm={() => removeAchat.mutateAsync(a)} />,
    },
  ];

  if (pieces.length === 0) {
    return <EmptyPanel title="Aucune pièce">Créez d'abord des pièces dans « Pièces et nomenclature ».</EmptyPanel>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Pièce" htmlFor="piece" className="sm:w-96">
          <SimpleSelect
            id="piece"
            value={reference}
            onValueChange={setReference}
            options={pieces.map((p) => ({ value: p.reference, label: `${p.reference} — ${p.libelle}` }))}
          />
        </Field>
        <Button onClick={() => setAdding(true)} disabled={!piece || fournisseurs.length === 0} className="sm:ml-auto">
          <ShoppingCart className="size-4" /> Enregistrer un achat
        </Button>
      </div>

      {historique.length === 0 ? (
        <EmptyPanel title="Aucun achat pour cette pièce">Enregistrez un premier achat auprès d'un fournisseur.</EmptyPanel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {parFournisseur.map((f) => (
              <Card key={f.code}>
                <CardContent className="space-y-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{f.nom}</span>
                    <Code>{f.code}</Code>
                  </div>
                  <div className="font-display text-2xl font-bold">{formatEuro(f.dernier.prixAchat)}</div>
                  <div className="text-xs text-muted-foreground">
                    Dernier achat le {formatDate(f.dernier.dateAchat)} · {f.nb} achat(s) · min {formatEuro(f.min)} / max {formatEuro(f.max)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <SectionTitle>Évolution des prix d'achat</SectionTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64 w-full">
                  <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={48} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {parFournisseur.map((f) => (
                      <Line key={f.code} dataKey={f.code} type="monotone" stroke={`var(--color-${f.code})`} strokeWidth={2} dot connectNulls />
                    ))}
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
            <DataTable
              data={historique}
              columns={columns}
              rowKey={(a) => `${a.codeFournisseur}-${a.dateAchat}`}
              initialSort={{ key: "date", dir: "desc" }}
              pageSize={6}
            />
          </div>
        </>
      )}
      {adding && piece && <AchatDialog reference={piece.reference} libelle={piece.libelle} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AchatDialog({ reference, libelle, onClose }: { reference: string; libelle: string; onClose: () => void }) {
  const { data: fournisseurs } = useSuspenseQuery(q.fournisseurs);
  const form = useForm<z.infer<typeof achatSchema>>({
    resolver: zodResolver(achatSchema),
    defaultValues: { codeFournisseur: "", dateAchat: todayIso(), prixAchat: "" },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof achatSchema>) =>
      approvisionnementsApi.create({ reference, codeFournisseur: v.codeFournisseur, dateAchat: v.dateAchat, prixAchat: toNumber(v.prixAchat) }),
    invalidate: [["approvisionnements"]],
    success: "Achat enregistré.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Enregistrer un achat"
      description={`${reference} — ${libelle}`}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Fournisseur" htmlFor="codeFournisseur" error={errors.codeFournisseur?.message}>
        <Controller
          control={form.control}
          name="codeFournisseur"
          render={({ field }) => (
            <SimpleSelect
              id="codeFournisseur"
              value={field.value}
              onValueChange={field.onChange}
              invalid={!!errors.codeFournisseur}
              placeholder="Choisir un fournisseur"
              options={fournisseurs.map((f) => ({ value: f.codeFournisseur, label: f.raisonSociale, hint: f.codeFournisseur }))}
            />
          )}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date d'achat" htmlFor="dateAchat" error={errors.dateAchat?.message}>
          <Input id="dateAchat" type="date" aria-invalid={!!errors.dateAchat} {...form.register("dateAchat")} />
        </Field>
        <Field label="Prix d'achat (€)" htmlFor="prixAchat" error={errors.prixAchat?.message}>
          <Input id="prixAchat" inputMode="decimal" aria-invalid={!!errors.prixAchat} {...form.register("prixAchat")} />
        </Field>
      </div>
    </FormDialog>
  );
}

function FournisseurDialog({ fournisseur, onClose }: { fournisseur: Fournisseur | null; onClose: () => void }) {
  const form = useForm<z.infer<typeof fournisseurSchema>>({
    resolver: zodResolver(fournisseurSchema),
    defaultValues: {
      codeFournisseur: fournisseur?.codeFournisseur ?? "",
      raisonSociale: fournisseur?.raisonSociale ?? "",
      adresse: fournisseur?.adresse ?? "",
      telephone: fournisseur?.telephone ?? "",
    },
  });
  const save = useApiMutation({
    mutationFn: (v: z.infer<typeof fournisseurSchema>) => {
      const body = {
        raisonSociale: v.raisonSociale.trim(),
        adresse: v.adresse.trim() || null,
        telephone: v.telephone.trim() || null,
      };
      return fournisseur
        ? fournisseursApi.update(fournisseur.codeFournisseur, body)
        : fournisseursApi.create({ codeFournisseur: v.codeFournisseur.trim(), ...body });
    },
    invalidate: [qk.fournisseurs],
    success: fournisseur ? "Fournisseur modifié." : "Fournisseur créé.",
    onSuccess: onClose,
  });
  const { errors } = form.formState;
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={fournisseur ? `Modifier ${fournisseur.raisonSociale}` : "Nouveau fournisseur"}
      onSubmit={form.handleSubmit((v) => save.mutate(v))}
      submitting={save.isPending}
    >
      <Field label="Code fournisseur" htmlFor="codeFournisseur" error={errors.codeFournisseur?.message} hint={fournisseur ? "Le code ne peut pas être modifié." : "Unique."}>
        <Input id="codeFournisseur" className="font-mono" disabled={!!fournisseur} aria-invalid={!!errors.codeFournisseur} {...form.register("codeFournisseur")} />
      </Field>
      <Field label="Raison sociale" htmlFor="raisonSociale" error={errors.raisonSociale?.message}>
        <Input id="raisonSociale" aria-invalid={!!errors.raisonSociale} {...form.register("raisonSociale")} />
      </Field>
      <Field label="Adresse" htmlFor="adresse" error={errors.adresse?.message}>
        <Input id="adresse" aria-invalid={!!errors.adresse} {...form.register("adresse")} />
      </Field>
      <Field label="Téléphone" htmlFor="telephone" error={errors.telephone?.message}>
        <Input id="telephone" type="tel" aria-invalid={!!errors.telephone} {...form.register("telephone")} />
      </Field>
    </FormDialog>
  );
}
