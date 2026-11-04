import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { PageError, PagePending } from "./components/app/states";
import { ApiError } from "./lib/api/client";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PagePending,
    defaultErrorComponent: PageError,
  });

  return router;
};
