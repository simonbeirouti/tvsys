import { createRootRouteWithContext, createRoute, createRouter, Outlet, redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { App, DEFAULT_COMPANY_ID, isScreenFilter, type ScreenFilter } from "./App.js";
import { queryClient } from "./query.js";

export interface RouterContext {
  queryClient: QueryClient;
}

export interface CompanySearch {
  filter: ScreenFilter;
}

const normalizeCompanySearch = (search: Record<string, unknown>): CompanySearch => ({
  filter: isScreenFilter(search.filter) ? search.filter : "all"
});

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({
      to: "/companies/$companyId",
      params: { companyId: DEFAULT_COMPANY_ID },
      search: { filter: "all" }
    });
  }
});

export const companyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/companies/$companyId",
  validateSearch: normalizeCompanySearch,
  component: App
});

export const displayRoute = createRoute({
  getParentRoute: () => companyRoute,
  path: "displays/$displayId"
});

const routeTree = rootRoute.addChildren([indexRoute, companyRoute.addChildren([displayRoute])]);

export const router = createRouter({
  routeTree,
  context: { queryClient }
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
