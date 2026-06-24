# Shared UI Package

`@tvsys/ui` is the shared React UI package for TVSys. It owns the reusable Tailwind/shadcn setup used by both the controller and TV client.

## Current State

1. Package path: `packages/ui`.
2. Package name: `@tvsys/ui`.
3. React target: React 19, exposed as a peer dependency.
4. Styling stack: Tailwind CSS v4, shadcn, `tw-animate-css`, Geist variable font, and CSS custom properties.
5. Shared shadcn primitives are generated under `packages/ui/src/components` and exported as paths such as:
   - `@tvsys/ui/components/button`
   - `@tvsys/ui/components/card`
   - `@tvsys/ui/components/sidebar`
   - `@tvsys/ui/components/tabs`
   - `@tvsys/ui/components/input`
   - `@tvsys/ui/components/label`
6. Shared utilities currently available:
   - `@tvsys/ui/lib/utils`
7. Shared stylesheet:
   - `@tvsys/ui/styles.css`

## App Integration

Both browser apps depend on `@tvsys/ui` with `workspace:*`.

Both apps import the shared stylesheet before their local stylesheet:

```ts
import "@tvsys/ui/styles.css";
import "./styles.css";
```

This gives both apps the shared Tailwind utilities, shadcn theme tokens, and base UI styling while still allowing app-specific layout CSS to stay local.

The controller uses shared shadcn primitives for the authenticated cafe dashboard, device list, forms, cards, OTP sign-in, and device controls. The TV client uses shared primitives for OTP setup and status UI. Scene rendering and Pixi/stage CSS remain app-local so TV playback layout stays isolated.

## Adding Components

Add reusable shadcn primitives from inside the UI package:

```bash
pnpm --filter @tvsys/ui exec shadcn add <component> -y
```

Use `-o` when intentionally overwriting an existing generated primitive:

```bash
pnpm --filter @tvsys/ui exec shadcn add input label -y -o
```

Do not generate shadcn components into `apps/controller` or `apps/tv-client`. App-specific compositions, such as dashboard/sidebar company navigation, should remain in the app unless they become reusable primitives.

## Tailwind Sources

`packages/ui/src/styles/globals.css` scans:

1. `packages/ui/src/**/*.{ts,tsx}`
2. `apps/controller/src/**/*.{ts,tsx}`
3. `apps/tv-client/src/**/*.{ts,tsx}`

Each app has a Vite config with the React plugin and Tailwind v4 plugin.

## Verification

Run these checks after changing shared UI:

```bash
pnpm --filter @tvsys/ui typecheck
pnpm --filter @tvsys/controller typecheck
pnpm --filter @tvsys/tv-client typecheck
pnpm --filter @tvsys/controller build
pnpm --filter @tvsys/tv-client build
pnpm --filter @tvsys/controller test
pnpm --filter @tvsys/tv-client test
```

For a quick runtime smoke test, start both apps:

```bash
pnpm --parallel --filter @tvsys/controller --filter @tvsys/tv-client dev
```

Then confirm:

1. Controller loads at `http://localhost:5173/`.
2. TV client loads at `http://localhost:5174/`.
3. TV client setup/status screens are styled.
4. TV scene playback still fills the display without dashboard layout styles leaking into the stage.
