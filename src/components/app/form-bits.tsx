import { Check, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder = "Choisir…",
  id,
  invalid,
  className,
  disabled,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid} className={cn(invalid && "border-destructive", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Aucune option disponible</div>
        ) : (
          options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
              {o.hint && <span className="ml-2 text-xs text-muted-foreground">{o.hint}</span>}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

/** Sélection multiple avec recherche (ouvriers d'un lot, intervenants d'une maintenance). */
export function MultiPicker({
  options,
  value,
  onChange,
  invalid,
  emptyMessage = "Aucun élément.",
}: {
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  invalid?: boolean;
  emptyMessage?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const nq = query.trim().toLowerCase();
    if (!nq) return options;
    return options.filter((o) => `${o.label} ${o.value} ${o.hint ?? ""}`.toLowerCase().includes(nq));
  }, [options, query]);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className={cn("rounded-md border border-input bg-background", invalid && "border-destructive")}>
      <div className="relative border-b border-border">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer…"
          className="h-9 rounded-none border-0 pl-8 shadow-none focus-visible:ring-0"
        />
      </div>
      <ul className="max-h-44 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
        {filtered.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">{emptyMessage}</li>}
        {filtered.map((o) => {
          const selected = value.includes(o.value);
          return (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggle(o.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                  selected && "bg-accent text-accent-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-sm border border-input",
                    selected && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {selected && <Check className="size-3" />}
                </span>
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint && <span className="font-mono text-xs text-muted-foreground">{o.hint}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border px-2 py-1 text-xs text-muted-foreground">
        {value.length} sélectionné(s)
      </div>
    </div>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</span>
  );
}
