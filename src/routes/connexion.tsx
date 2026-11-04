import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Eye, EyeOff, LogIn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Field } from "@/components/app/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, tokenStore } from "@/lib/api/client";
import { authApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/queries";
import { homeFor } from "@/lib/permissions";
import { loginSchema } from "@/lib/validation";

interface Search {
  expire?: boolean;
}

export const Route = createFileRoute("/connexion")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    expire: s.expire === 1 || s.expire === "1" || s.expire === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Connexion · TWIN_3 Gestion d'usine" },
      { name: "description", content: "Connectez-vous à l'application de gestion d'usine TWIN_3." },
      { property: "og:title", content: "Connexion · TWIN_3 Gestion d'usine" },
      {
        property: "og:description",
        content: "Connectez-vous à l'application de gestion d'usine TWIN_3.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Connexion,
});

type FormValues = z.infer<typeof loginSchema>;

function Connexion() {
  const { expire } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifiant: "", motDePasse: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await authApi.login(values.identifiant.trim(), values.motDePasse);
      tokenStore.set(res.token);
      queryClient.setQueryData(qk.me, res.utilisateur);
      navigate({ to: homeFor(res.utilisateur.role), replace: true });
    } catch (e) {
      setServerError(errorMessage(e));
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="hazard-stripe absolute inset-x-0 top-0 h-2" />
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-sm bg-sidebar-primary font-display text-base font-black text-sidebar-primary-foreground">
            T3
          </span>
          <span className="font-display text-lg font-bold text-sidebar-accent-foreground">TWIN_3</span>
        </div>
        <div className="max-w-md space-y-5">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-sidebar-accent-foreground">
            L'usine, ligne par ligne.
          </h1>
          <p className="text-sidebar-foreground/70">
            Lots fabriqués, temps d'arrêt, maintenances et stock de pièces : toute l'activité des ateliers au
            même endroit.
          </p>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-sidebar-border bg-sidebar-border font-mono text-xs">
            {[
              ["F4", "Lots"],
              ["F6", "Incidents"],
              ["F7", "Maintenance"],
            ].map(([code, label]) => (
              <div key={code} className="bg-sidebar p-3">
                <dt className="text-sidebar-primary">{code}</dt>
                <dd className="mt-1 text-sidebar-foreground/80">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="font-mono text-xs text-sidebar-foreground/40">Gestion d'usine · v1.0</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="flex size-10 items-center justify-center rounded-sm bg-primary font-display font-black text-primary-foreground">
              T3
            </span>
          </div>
          <h2 className="font-display text-2xl font-bold">Connexion</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saisissez votre identifiant et votre mot de passe.
          </p>

          {expire && !serverError && (
            <div className="mt-6 flex gap-2 rounded-md border border-warning bg-warning/15 p-3 text-sm text-warning-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Votre session a expiré. Veuillez vous reconnecter.
            </div>
          )}
          {serverError && (
            <div
              role="alert"
              className="mt-6 flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {serverError}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Field label="Identifiant" htmlFor="identifiant" error={errors.identifiant?.message}>
              <Input
                id="identifiant"
                autoComplete="username"
                autoFocus
                aria-invalid={!!errors.identifiant}
                {...form.register("identifiant")}
              />
            </Field>
            <Field label="Mot de passe" htmlFor="motDePasse" error={errors.motDePasse?.message}>
              <div className="relative">
                <Input
                  id="motDePasse"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  aria-invalid={!!errors.motDePasse}
                  className="pr-10"
                  {...form.register("motDePasse")}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <LogIn className="size-4" />
              {isSubmitting ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
          <p className="mt-6 text-xs text-muted-foreground">
            Les comptes sont créés par l'administrateur. Contactez-le en cas d'oubli du mot de passe.
          </p>
        </div>
      </main>
    </div>
  );
}
