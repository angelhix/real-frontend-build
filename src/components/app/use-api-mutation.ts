import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api/client";

interface Options<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>;
  invalidate?: QueryKey[];
  success?: string | ((data: TData, vars: TVars) => string);
  onSuccess?: (data: TData, vars: TVars) => void;
}

/** Mutation avec invalidation du cache et messages clairs (succès / erreur serveur). */
export function useApiMutation<TData = unknown, TVars = void>(opts: Options<TData, TVars>) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: opts.mutationFn,
    onSuccess: async (data, vars) => {
      await Promise.all(
        (opts.invalidate ?? []).map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
      if (opts.success) {
        toast.success(typeof opts.success === "function" ? opts.success(data, vars) : opts.success);
      }
      opts.onSuccess?.(data, vars);
    },
    onError: (err) => {
      toast.error(errorMessage(err));
    },
  });
}
