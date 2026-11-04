import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ConfirmDelete({
  title,
  description,
  onConfirm,
  blockedReason,
  trigger,
}: {
  title: string;
  description?: ReactNode;
  onConfirm: () => Promise<unknown>;
  /** Si défini, la suppression est bloquée avec ce message clair. */
  blockedReason?: string | null;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const button = trigger ?? (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-destructive"
      aria-label="Supprimer"
      disabled={!!blockedReason}
      onClick={(e) => {
        e.stopPropagation();
        setOpen(true);
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );

  return (
    <>
      {blockedReason ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} onClick={(e) => e.stopPropagation()}>
              {button}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{blockedReason}</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>
              {description ?? "Cette action est définitive."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } catch {
                  // le message d'erreur est affiché par la mutation
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Suppression…" : "Supprimer"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
