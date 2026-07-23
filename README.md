# ERP System

A custom, single-company ERP platform unifying finance, sales, inventory, HR,
projects, procurement, and reporting: real-time cross-module data sharing,
customizable workflows/automation, RBAC, and executive dashboards. TypeScript
monorepo (NestJS + Next.js + Prisma/PostgreSQL), built so a single-company
deployment today doesn't paint the project into a corner later.

This file is for **whoever (human or another Claude instance) picks this
project up next**, possibly with no memory of how it was built. Read it
before touching code.

## Starting a new session

> Read README.md, then check `git log --oneline -20` and `git status` to
> confirm the repo matches this file. Read "Handoff" below and either pick up
> its top item or ask which to prioritize. Check whether Node/pnpm/Docker are
> installed — that determines whether you can verify changes with `pnpm
> typecheck`/`pnpm dev` or need to fall back to hand-review (see "How this was
> built").

If you already know what you want next, just say so — you don't need the
prompt above.

## Current status

| Area | Status |
|---|---|
| Monorepo scaffold, tooling | Done |
| Auth (JWT + refresh cookie), RBAC | Done |
| Real-time event bus (Socket.io + Redis) | Done |
| Audit logging (explicit + auto-diff extension) | Done |
| Notifications (persistence + live push) | Done — bell + dropdown in the app shell, live push via a dedicated socket channel |
| Workflow/automation engine (json-logic conditions, 5 action types) | Done — form-based admin UI at `/workflows`, per-run history |
| Inventory (products, warehouses, stock, movements) | Done |
| Sales (customers, orders, draft→confirmed→fulfilled/cancelled) | Done — reserves/commits/releases real stock |
| Procurement (purchase orders, receiving) | Done — `PurchaseOrderLine[]` tied to `Product`; receiving calls `StockService` per line (partial receipt supported), see "Inventory ↔ Sales/Procurement" below |
| Finance (Invoices) | Done — CRUD on `Invoice` (1:1 with `SalesOrder`); `confirm()`/`fulfill()` auto-create/transition these, manual "New Invoice" is a secondary path |
| HR (Employees), Projects | Done — single-entity CRUD stubs, permission-per-action, one dashboard KPI each |
| Dashboard | Done — widget-registry framework (`apps/api/src/core/dashboard-widgets/`); modules self-register KPIs, dashboard page knows nothing about them |
| App shell / nav | Done — sticky, permission-aware shell bar styled after SAP Fiori (`apps/web/src/components/app-shell.tsx`); module sections with real sub-pages keep a local sub-nav |
| Admin page | Done — `/admin`, gated on `admin:users.manage`, a role/permission reference (not a real user-management UI yet, see Handoff) |
| Accessibility | Done — skip link, landmark regions, focus traps/Escape on dialogs and the notification dropdown, keyboard-visible focus rings, shared `StatusBadge` (never color-only) |
| Reporting | Done — 7 fixed cross-module report types, CSV export, `/reporting/reports` |

If picking this up cold: read `apps/api/src/procurement/purchase-orders.service.ts`
(`receive()`) or `apps/api/src/sales/sales-orders.service.ts`
(`confirm()`/`fulfill()`/`cancel()`) — both tie auth, the event bus, and a
cross-module call into Inventory's `StockService` together end to end.

## Tech stack

- **Monorepo:** pnpm workspaces + Turborepo
- **API:** NestJS 10, a modular monolith — one Nest module per business
  domain, one deployable process
- **Web:** Next.js 14 (App Router) + Tailwind + shadcn/ui-style components
- **Database:** PostgreSQL via Prisma 5, **multi-file schema**
  (`packages/database/prisma/schema/*.prisma`)
- **Auth:** JWT access token (Bearer, in-memory) + httpOnly-cookie refresh,
  Passport.js
- **Real-time:** Socket.io + Redis pub/sub (`apps/api/src/core/event-bus`),
  degrades to in-process delivery without Redis
- **Workflow conditions:** json-logic-js (never raw `eval`)

## Repository layout

```
apps/
  api/                      NestJS API
    src/
      auth/, users/         Login/refresh/me, user lookups
      prisma/               Injectable PrismaService
      common/                Guards, decorators, pipes, filters
      core/
        event-bus/          EventBusService (typed emit) + Socket.io gateway
        audit/               AuditService + auto-diff Prisma extension
        notifications/       NotificationService + REALTIME_BROADCASTER
        workflow/             Automation engine: trigger -> condition -> action
        dashboard-widgets/    DashboardWidgetRegistry
      inventory/            Warehouse/Product/StockItem/StockMovement + StockService
      sales/                Customer/SalesOrder/SalesOrderLine/Invoice + lifecycle
      finance/              InvoicesController/Service
      hr/                   EmployeesController/Service
      procurement/           PurchaseOrder/PurchaseOrderLine + receiving flow
      projects/              ProjectsController/Service (mounted at /projects)
      dashboard/             Aggregates every module's KPI provider
  web/                      Next.js app
    src/
      lib/auth/             AuthProvider/useAuth()
      lib/realtime/         useDomainEvents() - Socket.io client hook
      lib/notifications/    Notifications API client + useNotificationPush()
      lib/dashboard/        Dashboard API client + widget-kind -> renderer registry
      lib/hooks/            useTableFilters() - URL-driven filters
      lib/inventory/, lib/sales/, lib/finance/, lib/hr/,
      lib/procurement/, lib/projects/, lib/workflow/   Per-module API clients
      components/app-shell.tsx   Persistent, permission-aware shell bar
      app/inventory/, app/sales/, app/finance/, app/hr/,
      app/procurement/, app/projects/, app/workflows/, app/admin/   Pages
packages/
  contracts/                Shared DTOs (zod), permission/event registries,
                             workflow action types - cross-app source of truth
  database/
    prisma/schema/          Multi-file Prisma schema
    prisma/seed.ts          Seeds Company, Permissions, Owner role, admin User
  ui/                       Shared React components (Button, Card, DataTable,
                             KpiCard, StatusBadge, ...)
  auth/                     Framework-agnostic permission-check math
  config/                   Shared tsconfig/ESLint/Tailwind presets
  utils/                    Currency/date/formatting helpers
docker-compose.yml          Postgres + Redis for local dev
```

## Prerequisites

- **Node.js 20 LTS** (>= 20.11)
- **pnpm 9** (`corepack enable` then `corepack prepare pnpm@9.5.0 --activate`)
- **PostgreSQL 16** and **Redis 7** — via Docker (`docker compose up -d`).
  Redis is optional for a single dev instance (event bus degrades to
  in-process delivery without it). Postgres is required.

> **Windows-specific gotchas:**
> - `corepack enable` can fail with `EPERM` without admin rights. Fix:
>   `npm install -g pnpm@9.5.0` instead.
> - `apps/api`'s `nest start --watch` (`deleteOutDir: true`) can silently emit
>   zero files then crash with `Cannot find module '...\dist\main'` if a stale
>   `tsconfig.tsbuildinfo`/`tsconfig.build.tsbuildinfo` survives a `dist/`
>   deletion. Fix: delete both `.tsbuildinfo` files (gitignored, always safe)
>   and rebuild.
> - Background dev-server processes may survive a harness's "stop task" and
>   hold file locks (blocks Postgres advisory locks / Prisma client
>   regeneration / Tailwind config reloads). If something inexplicably hangs,
>   check `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` in
>   PowerShell and force-kill the real PIDs.
> - A workspace-package change (e.g. `packages/config/tailwind-preset.js`)
>   may not hot-reload into a running `next dev` — if a Tailwind class stops
>   applying after such a change, `rm -rf apps/web/.next` and restart.

## Setup

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Create your local env file (edit secrets as needed)
cp .env.example .env

# 3. Start Postgres (and Redis) locally
docker compose up -d

# 4. Create the database schema (also generates the Prisma client)
pnpm --filter @erp/database db:migrate

# 5. Seed the company, permissions, Owner role, and admin user
pnpm --filter @erp/database db:seed

# 6. Type-check everything before first run
pnpm typecheck

# 7. Run everything (API on :3001, web on :3000)
pnpm dev
```

Then open <http://localhost:3000>, sign in with:

- **Email:** `admin@example.com`
- **Password:** `ChangeMe123!`

(dev defaults in `.env.example` — `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`;
change before any real deployment, then re-run the seed to re-hash).

### Trying the real-time demo

1. **Inventory → Products**: create a product. **Inventory → Stock**: adjust
   it to give it `quantityOnHand`.
2. **Sales → Customers**: create a customer. **Sales → Orders → New**: build
   an order against that product.
3. Open **Inventory → Stock** in a second tab.
4. Back in the first tab, open the order, click **Confirm (reserve stock)** —
   the second tab's stock grid updates live (Socket.io end to end).
5. Click **Fulfill** to deduct on-hand stock, or **Cancel** to release the
   reservation.
6. Same idea on the buy side: **Procurement → Purchase Orders → New**, add
   lines against a product, **Submit**, then **Receive** (full or partial) —
   watch the same Stock grid tick up live.

### Available root scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Runs all apps/packages in watch mode via Turborepo |
| `pnpm build` | Builds every package and app (packages first) |
| `pnpm typecheck` | Type-checks every workspace |
| `pnpm lint` | Lints every workspace |
| `pnpm db:migrate` | `prisma migrate dev` in `@erp/database` |
| `pnpm db:seed` | Runs the seed script in `@erp/database` |
| `pnpm format` | Formats the repo with Prettier |

Per-package database commands (run from anywhere):

```bash
pnpm --filter @erp/database db:generate    # regenerate the Prisma client
pnpm --filter @erp/database db:migrate     # create/apply a dev migration
pnpm --filter @erp/database db:reset       # drop + re-migrate + re-seed
pnpm --filter @erp/database db:studio      # open Prisma Studio
```

All Prisma commands are wrapped in `dotenv-cli` so they read the root `.env`
even when run from `packages/database`.

> **Web → API URL:** the browser talks to `http://localhost:3001` by default.
> Override via `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`.

## Architecture & conventions (read before extending)

### `packages/contracts` is the load-bearing package

Every cross-cutting concept is defined once here and imported by both
`apps/api` and `apps/web`:

- `permissions.ts` — `PERMISSIONS` + `PERMISSION_DEFINITIONS` (seeded into the
  DB). **Adding a permission is always additive** — append, never
  reorder/remove.
- `events.ts` — `EVENTS`, `DomainEvent<T>`, `EventPayloadMap` (typed payload
  per event name — `EventBusService.emit()` is generically typed off this).
- `workflow.ts` — action types + per-type config shapes.
- `notifications.ts`, `audit.ts` — shared DTO shapes for those services.
- `common/pagination.ts` — `paginationQuerySchema`/`Paginated<T>`, used by
  every paginated list endpoint.

### RBAC

Permission keys follow `<module>:<resource>.<action>` (e.g.
`inventory:stock.adjust`). `@RequirePermission(...)` + the global
`PermissionsGuard` enforce **AND** semantics. The same check
(`checkRequiredPermissions` in `packages/auth`) powers the web's
`useAuth().hasPermission(...)` — client and server agree, though the server
is what actually enforces it. Roles are admin-creatable in principle (no
hardcoded split beyond the seeded "Owner"), but there's no admin UI to
actually create one yet (see Handoff).

### Multi-file Prisma schema

`packages/database/prisma/schema/` holds multiple `.prisma` files
(`prismaSchemaFolder` preview feature) so adding a business domain doesn't
require editing a file everyone else touches. Adding a model:

1. Create `packages/database/prisma/schema/<yourmodule>.prisma`.
2. If it relates to a foundation model (`Company`, `User`) or another
   module's model, add the single back-relation field to that other file —
   nothing else.
3. Every business table carries `companyId` (+ usually `createdById`/
   `updatedById`, `createdAt`/`updatedAt`), always read from the
   authenticated request, never hardcoded.

### The event bus / real-time layer

`EventBusService.emit(name, companyId, payload, actorUserId?)`
(`apps/api/src/core/event-bus/event-bus.service.ts`): writes a durable
`EventLog` row, emits in-process via `EventEmitter2` (workflow engine +
Socket.io gateway both subscribe), best-effort publishes to Redis for
cross-instance fan-out. **Always emit after your DB transaction commits.**
Frontend subscribes via `useDomainEvents()`
(`apps/web/src/lib/realtime/use-domain-events.ts`).

### The workflow/automation engine

DB-configured rules, not a visual builder: a `WorkflowDefinition` fires when
its `triggerEvent` (one of `EVENTS`) matches and its `conditionsJson`
(json-logic-js against the event payload) passes, then runs ordered
`WorkflowAction`s (`notify`|`updateField`|`createRecord`|`callWebhook`|
`assignTask`) via `ActionHandlerRegistry` (`apps/api/src/core/workflow/`).
Every firing logs to `WorkflowRun`. Managed via `/workflows` REST + a
form-based admin UI (conditions stay a raw JSON textarea, deliberately).

### Inventory ↔ Sales/Procurement: the reference integration pattern

`StockService` (`apps/api/src/inventory/stock.service.ts`) is the **only**
path that changes stock — `reserve()`/`commitReservation()`/`release()`/
`adjust()`, each transactional with a `StockMovement` audit row, each
emitting `inventory.stock.updated` (+ `inventory.stock.low` near reorder
point) after commit, each behind `SELECT ... FOR UPDATE` row locking.

- **Sales** (`SalesOrdersService.confirm()`/`fulfill()`/`cancel()`):
  confirm reserves each line, fulfill commits (decrements on-hand + reserved),
  cancel releases. No per-line warehouse picker — orders reserve against the
  company's single "default" (first active) warehouse; `fulfill()`/`cancel()`
  resolve the warehouse from the `StockMovement` ledger written at
  confirm-time rather than re-resolving "the default."
- **Procurement** (`PurchaseOrdersService.receive()`): the inbound mirror.
  `PurchaseOrderLine[]` (productId, warehouseId, quantityOrdered,
  quantityReceived, unitCost) ties a PO to real stock. `receive()` accepts a
  per-line received quantity (partial receipt allowed — a line can be
  received across multiple calls), calls `StockService.adjust()` per line
  (positive delta), and flips PO status to `partiallyReceived` or `received`
  once every line's `quantityReceived` reaches its `quantityOrdered`. Emits
  `procurement.purchaseOrder.received` (and `.partiallyReceived`) so
  Workflow automations can react to it.

Both cross-module writes share the same known limitation: `StockService`
manages its own transaction per call, so a multi-line confirm/receive is
sequential calls with a compensating rollback on failure (release for sales,
nothing to compensate for receive — a partial receipt on failure is left as
correctly-partial, not rolled back), not one wrapping DB transaction.

### Decimal handling

Prisma `Decimal` fields (money: `costPrice`, `salePrice`, `unitPrice`,
`unitCost`, `totalAmount`, ...) are Decimal.js objects at runtime, not plain
numbers. **Every DTO mapper explicitly stringifies them** (`.toString()`/
`.toFixed(2)`) rather than relying on default JSON serialization. The
frontend keeps money as strings, only `Number(...)` for display/sum. Follow
this for any new money field.

### Frontend conventions

- `useAuth()` (`apps/web/src/lib/auth/auth-context.tsx`) exposes `user`,
  `permissions`, `hasPermission()`, `getAccessToken()`, `login()`/`logout()`.
- Feature modules get their own typed fetch client (`lib/inventory/api.ts`,
  `lib/sales/api-client.ts`) rather than a shared generic one.
- `AppShell` (`components/app-shell.tsx`) is the persistent, permission-aware
  shell bar — every destination filtered by `hasPermission(...)` before
  showing. Module sections with real multi-page sub-navigation (Inventory,
  Sales) keep a local sub-nav; single-resource modules don't.
- `RequirePermissionPage` (`lib/auth/require-permission-page.tsx`) is the
  shared client-side page gate (loading → redirect-to-login → "Access
  denied" → children).
- `useTableFilters` (`lib/hooks/use-table-filters.ts`) — pass an explicit
  type argument (`useTableFilters<{ x: string; y: boolean }>({...})`) rather
  than letting it infer from the defaults object (TS infers literal types
  like `false` instead of `boolean` from object-literal args against a
  union-constrained generic).
- Live updates: `useDomainEvents(callback, filterEventName?)` — see
  `app/inventory/stock/page.tsx` and `app/sales/orders/[id]/page.tsx` for
  silent-refetch vs. targeted per-row-update patterns.
- `StatusBadge` (`@erp/ui`) — shared colored-pill status indicator (text +
  tone, never color alone); every module's status column/detail view uses it.

## How this was built

Early phases were built on a machine with no Node/pnpm/Docker at all — code
was hand-reviewed, not compiled, using parallel Opus sub-agents in isolated
git worktrees with narrow, non-overlapping file scopes. A later session got a
real toolchain and has machine-verified every change since: `pnpm typecheck` +
`pnpm lint` after every edit, plus an actual Playwright/curl pass against the
running dev server before committing — compiling is necessary but not
sufficient (real bugs here were only caught by actually clicking through a
feature). **If you have a toolchain, use it this way; if not, fall back to
narrow-scoped agent briefs and careful hand review.**

## Handoff — read this first if you're the next session

Everything in the status table above is merged to `main`, typechecks/lints
clean, and was exercised in a real browser session (not just compiled) before
being committed. Run `git log --oneline -20` and `git status` first — if the
tree isn't clean, something unexpected happened after this was written;
investigate before proceeding. No stale agent worktrees should exist
(`git worktree list` should be empty/absent; `.claude/worktrees/` is
gitignored).

### Suggested next phases, roughly in priority order

1. **Automated tests** — there are currently **zero** automated tests
   anywhere in this repo. Every phase has been verified by hand (typecheck +
   lint + a real Playwright/curl pass) rather than a regression suite. With
   10 modules now, this is the biggest structural risk to future changes — a
   good starting scope: NestJS's built-in Jest setup for `StockService`'s
   reserve/commit/release/adjust (row-level locking under concurrency, not
   just correctness), the workflow engine's model/field allowlist and
   condition evaluation, and both `confirm()`'s and `receive()`'s
   compensating/partial-failure behavior.
2. **HR ↔ User linking** — `Employee` is standalone with no relation to
   `User`, so there's no self-service ("my profile," "my time off") story yet
   — flagged in `hr.prisma`'s docblock as the intended growth path.
3. **Users/Roles admin API + UI** — `admin:users.manage`/`admin:roles.manage`
   are reserved and seeded, but there's no way, via API or UI, to create a
   second user or role. Every module so far has only been exercised by the
   seeded Owner plus one hand-created read-only test role
   (`packages/database/prisma/create-test-user.ts` — a throwaway dev script).
   The `/admin` page is a static reference for what roles *should* look like,
   not a way to create them — this is the natural next step to make it real.
4. **Workflow conditions as a real (optional) visual builder** — currently a
   raw json-logic-js JSON textarea, deliberately. Only worth building if usage
   shows admins actually struggling with raw JSON — don't build speculatively.
