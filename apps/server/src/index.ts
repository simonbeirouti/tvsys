import http from "node:http";
import { AuthService } from "./auth.js";
import { loadConfig } from "./config.js";
import { createRequestHandler } from "./http.js";
import { Store } from "./store.js";
import { SignageHub } from "./ws.js";

const config = loadConfig();
const store = new Store(config);
const auth = new AuthService(config, store);
let hub: SignageHub | undefined;

const server = http.createServer(createRequestHandler(store, auth, () => hub));
hub = new SignageHub(server, store, config, auth);

server.listen(config.port, config.host, () => {
  console.log(`[server] listening on http://${config.host}:${config.port}`);
  console.log(`[server] supabase project: ${config.supabaseUrl}`);
});

const shutdown = () => {
  console.log("[server] shutting down");
  hub?.close();
  server.close(() => {
    store.close();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
