import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  headClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyMessage?: string;
  toolbar?: ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
  onRowClick?: (row: T) => void;
  isRowActive?: (row: T) => boolean;
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Liste avec recherche, tri et pagination (section 6 du cahier des charges). */
export function DataTable<T>({
  data,
  columns,
  rowKey,
  searchText,
  searchPlaceholder = "Rechercher…",
  pageSize = 10,
  emptyMessage = "Aucun élément.",
  toolbar,
  initialSort,
  onRowClick,
  isRowActive,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!searchText || !query.trim()) return data;
    const nq = normalize(query.trim());
    return data.filter((row) => normalize(searchText(row)).includes(nq));
  }, [data, query, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const get = col.sortValue;
    return [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "fr", { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const rows = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  return (
    <div className="space-y-3">
      {(searchText || toolbar) && (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {searchText && (
            <div className="relative md:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="pl-8"
                aria-label="Rechercher"
              />
            </div>
          )}
          {toolbar && <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <TableHead key={col.key} className={cn("h-10 text-xs uppercase tracking-wide", col.headClassName)}>
                    {col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 font-semibold hover:text-foreground"
                      >
                        {col.header}
                        {active ? (
                          sort?.dir === "asc" ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      <span className="font-semibold">{col.header}</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  {query ? `Aucun résultat pour « ${query} ».` : emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  data-state={isRowActive?.(row) ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer", "data-[state=selected]:bg-accent")}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn("py-2.5", col.className)}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {sorted.length === 0
            ? "0 élément"
            : `${current * pageSize + 1}–${Math.min(sorted.length, (current + 1) * pageSize)} sur ${sorted.length}`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage(current - 1)}
            disabled={current === 0}
            aria-label="Page précédente"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 font-mono">
            {current + 1}/{pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage(current + 1)}
            disabled={current >= pageCount - 1}
            aria-label="Page suivante"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
