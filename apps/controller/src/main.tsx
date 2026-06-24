import React from "react";
import ReactDOM from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider } from "@tanstack/react-router";
import "@tvsys/ui/styles.css";
import "./styles.css";
import { TooltipProvider } from "@tvsys/ui/components/tooltip";
import { queryClient, queryPersister } from "./query.js";
import { router } from "./router.js";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
