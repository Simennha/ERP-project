# ERP System

A custom, single-company ERP platform that unifies finance, sales, inventory, HR,
projects, procurement, and reporting behind one system: real-time cross-module
data sharing, customizable workflows/automation, role-based access control, and
executive dashboards with drill-down. Built as a TypeScript monorepo (NestJS +
Next.js + Prisma/PostgreSQL), designed so a single-company deployment today
doesn't paint the project into a corner if it needs to grow later.

This file is written for **whoever (human or another Claude instance) picks this
project up next**, possibly on a different machine with no memory of how it was
built. Read this before touching code.

## Starting a new Claude Code session on this project

Tell it something like:

> Read README.md end to end, then check `git log --oneline -20` and
> `git status` to confirm the repo matches what it describes. Then read the
> "Handoff" section and either pick up the top-priority item there, or ask me
> which of the "Suggested next phases" to prioritize before starting.

What that gets you: the session orients itself (current status, architecture,
conventions, where the last one stopped) before writing anything, confirms
the repo's actual state matches this file rather than assuming it, and checks
with you on priority instead of silently guessing which unfinished thread to
pull on. It should also check whether Node.js/pnpm/Docker are installed on
*this* machine — that determines whether it can run `pnpm typecheck`/`pnpm
dev` to verify its own changes as it goes, or whether it's back to the
hand-review discipline described in "How this was built" below (the machine
this project was originally built on had none of those installed).

If you already know exactly what you want next (e.g. "add a test suite" or
"build the Users/Roles admin UI"), just say that directly — the session will
still benefit from reading this file first, but you don't need the generic
prompt above.

## Current status (what's real vs. what's a stub)

| Area | Status |
|---|---|
| Monorepo scaffold, tooling | Done |
| Auth (JWT + refresh cookie), RBAC | Done |
| Real-time event bus (Socket.io + Redis) | Done |
| Audit logging (explicit + auto-diff extension) | Done |
| Notifications (persistence + live push) | Done (backend + UI) — bell icon + dropdown in the global app shell, live push via a dedicated socket channel (`apps/web/src/lib/notifications/`, `apps/web/src/components/notification-bell.tsx`) |
| Workflow/automation engine (json-logic conditions, 5 action types, CRUD API) | Done (backend + UI) — form-based admin builder at `/workflows` (`apps/web/src/app/workflows/`), plus per-workflow run history for debugging |
| Inventory (products, warehouses, stock, movements) | Done (backend + UI) |
| Sales (customers, orders, full draft→confirmed→fulfilled/cancelled lifecycle) | Done (backend + UI), reserves/commits/releases real stock |
| Finance (Invoices) | Done (backend + UI) — CRUD against the pre-existing `Invoice` model (1:1 with `SalesOrder`); `SalesOrdersService.confirm()`/`fulfill()` already auto-create/transition these, so the manual "New Invoice" flow is a secondary path for orders that lifecycle hasn't reached yet |
| HR (Employees), Procurement (Purchase Orders), Projects | Done (backend + UI) — single-entity CRUD stubs, permission-per-action, one dashboard KPI each. Built in parallel by isolated worktree agents, hand-reviewed and integrated (see git log around "Add Finance, HR, Procurement, Projects module stubs") |
| Dashboard | Done — generalized widget-registry framework (`apps/api/src/core/dashboard-widgets/`, `apps/web/src/lib/dashboard/widget-registry.tsx`). Every module self-registers its own KPI provider; the dashboard page itself knows nothing about Inventory/Sales/Finance/etc. Adding a widget to an existing module needs zero dashboard-code changes |
| App shell / nav | Done — persistent, permission-aware top nav (`apps/web/src/components/app-shell.tsx`) links to all 8 destinations; module sections that have real sub-pages (Inventory, Sales) keep a local sub-nav, single-resource modules don't |
| `useTableFilters` hook | Done (`apps/web/src/lib/hooks/use-table-filters.ts`), extracted from `app/inventory/stock/page.tsx`'s original hand-rolled version |
| Reporting | Done (backend + UI) — 7 fixed cross-module report types (`packages/contracts/src/reporting.ts`), each a saved config re-run live against current data, CSV export. `/reporting/reports` |

If you're picking this up cold: the fastest way to see the system's shape is to
read `apps/api/src/sales/sales-orders.service.ts` (`confirm()`/`fulfill()`/
`cancel()`) — it's the one place that ties auth, the event bus, and a
cross-module service call (Inventory's `StockService`) together end to end.

## Tech stack

- **Monorepo:** pnpm workspaces + Turborepo
- **API:** NestJS 10 (TypeScript), a modular monolith — one Nest module per
  business domain, all in one deployable process
- **Web:** Next.js 14 (App Router) + Tailwind CSS + shadcn/ui-style components
- **Database:** PostgreSQL via Prisma 5, **multi-file schema**
  (`packages/database/prisma/schema/*.prisma` — see below)
- **Auth:** JWT access token (Bearer, in-memory on the client) + httpOnly-cookie
  refresh token, Passport.js
- **Real-time:** Socket.io + Redis pub/sub (`apps/api/src/core/event-bus`),
  degrades gracefully to in-process delivery if Redis is unavailable
- **Workflow conditions:** json-logic-js (never raw `eval`)

## Repository layout

```
apps/
  api/                      NestJS API
    src/
      auth/, users/         Login/refresh/me, user lookups
      prisma/               Injectable PrismaService (extends PrismaClient)
      common/                Guards, decorators, pipes, filters shared app-wide
      core/
        event-bus/          EventBusService (typed emit) + Socket.io RealtimeGateway
        audit/               AuditService + Prisma extension for auto-diffing tagged models
        notifications/       NotificationService + REALTIME_BROADCASTER abstraction
        workflow/             Automation engine: trigger match -> condition eval -> action handlers
        dashboard-widgets/    DashboardWidgetRegistry - modules self-register a KPI provider here
      inventory/            Warehouse/Product/StockItem/StockMovement + StockService (see below)
      sales/                Customer/SalesOrder/SalesOrderLine/Invoice + order lifecycle
      finance/              InvoicesController/Service - CRUD against sales.prisma's Invoice model
      hr/                   EmployeesController/Service
      procurement/           PurchaseOrdersController/Service
      projects/              ProjectsController/Service (mounted at top-level /projects)
      dashboard/             Aggregates every module's DashboardWidgetProvider into one summary
  web/                      Next.js app
    src/
      lib/auth/             AuthProvider/useAuth() (access token in memory, refresh via cookie)
      lib/realtime/         useDomainEvents() - Socket.io client hook
      lib/notifications/    Notifications API client + useNotificationPush() (separate raw-socket channel)
      lib/dashboard/        Dashboard API client + widget-kind -> renderer-component registry
      lib/hooks/            useTableFilters() - shared "read filters from the URL" hook
      lib/inventory/, lib/sales/, lib/finance/, lib/hr/,
      lib/procurement/, lib/projects/, lib/workflow/   Feature API clients (one per module)
      components/app-shell.tsx   Persistent, permission-aware top nav (mounted from Providers)
      app/inventory/, app/sales/, app/finance/, app/hr/,
      app/procurement/, app/projects/, app/workflows/   Feature pages
packages/
  contracts/                Shared DTOs (zod), permission key registry, event name registry,
                             workflow action config types - THE cross-app source of truth
  database/
    prisma/schema/          Multi-file Prisma schema (see "Adding a model" below)
    prisma/seed.ts          Seeds a Company, all Permissions, an Owner role, an admin User
  ui/                       Shared React components (Button, Card, DataTable, KpiCard, ...)
  auth/                     Framework-agnostic permission-check math (guard + hook both use it)
  config/                   Shared tsconfig presets, ESLint config, Tailwind preset
  utils/                    Currency/date/formatting helpers
docker-compose.yml          Postgres + Redis for local dev
```

## Prerequisites

- **Node.js 20 LTS** (>= 20.11)
- **pnpm 9** (`corepack enable` then `corepack prepare pnpm@9.5.0 --activate`)
- **PostgreSQL 16** and **Redis 7** — easiest via Docker (`docker compose up -d`).
  Redis is optional for a single dev instance (the event bus degrades to
  in-process delivery without it — you'll just lose cross-instance fan-out,
  not real-time within one running API process). Postgres is required.

> **Note on this repo's history:** every phase through the initial dashboard
> slice was built on a machine with no Node.js/pnpm/Docker installed at all —
> every agent that wrote code did so by hand, cross-checking imports/exports
> by reading files rather than compiling. A later session ran the first-ever
> `pnpm install` + `pnpm typecheck` on a real machine (Windows) and found
> exactly two real bugs from that hand-written era (both fixed — see git log
> around "First machine-verified compile"), confirming the architecture and
> wiring held up. Since then, every phase has been built with a working
> toolchain and machine-verified (typecheck + lint + a real Playwright browser
> session) before being committed — if you're picking this up with a working
> toolchain, keep doing that; don't fall back to hand-review-only discipline.
>
> **Windows-specific gotchas hit along the way**, worth knowing before you
> assume something's broken:
> - `corepack enable` can fail with `EPERM` if you don't have admin rights to
>   write shims into `C:\Program Files\nodejs`. Fix: `npm install -g pnpm@9.5.0`
>   instead of corepack.
> - `apps/api`'s `nest start --watch` (`deleteOutDir: true` in its
>   `nest-cli.json`) can silently emit zero files and then crash with
>   `Cannot find module '...\dist\main'` if `dist/` was deleted (e.g. after
>   force-killing a stuck dev-server process tree) while a stale
>   `tsconfig.tsbuildinfo` / `tsconfig.build.tsbuildinfo` survives — TypeScript's
>   incremental build trusts that cache's timestamps over checking whether
>   `dist/` still exists. Fix: delete both `.tsbuildinfo` files (gitignored,
>   always safe to delete) and rebuild.
> - Background dev-server processes started by an agent harness may not be
>   fully killed by the harness's own "stop task" action on Windows — the
>   `pnpm -> turbo -> nest`/`tsc --watch` child-process tree can survive and
>   hold file locks (blocked a Postgres advisory lock during `prisma migrate
>   dev` once, blocked Prisma client regeneration another time). If something
>   inexplicably hangs or fails with a lock/permission error, check
>   `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` in PowerShell and
>   force-kill the real PIDs rather than assuming the code is broken.

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

# 6. Type-check everything before first run (this is the project's first-ever compile — see note above)
pnpm typecheck

# 7. Run everything (API on :3001, web on :3000)
pnpm dev
```

Then open <http://localhost:3000>, sign in with:

- **Email:** `admin@example.com`
- **Password:** `ChangeMe123!`

(dev defaults in `.env.example` — `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`;
change them before any real deployment, then re-run the seed to re-hash).

### Trying the real-time demo

1. Log in, go to **Inventory → Products**, create a product (set a cost/sale
   price). Go to **Inventory → Stock**, adjust it to give it some
   `quantityOnHand` (the product won't have a stock row until you adjust it
   once).
2. Go to **Sales → Customers**, create a customer.
3. Go to **Sales → Orders → New**, build an order against that product.
4. Open the **Inventory → Stock** page in a second browser tab/window.
5. Back in the first tab, open the order and click **Confirm (reserve
   stock)**. The second tab's stock grid should update live (no refresh) —
   that's the Socket.io event bus working end to end.
6. Click **Fulfill** to actually deduct on-hand stock, or **Cancel** to
   release the reservation.

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

All Prisma commands are wrapped in `dotenv-cli` so they read the single root
`.env` even though they run from `packages/database`.

> **Web → API URL:** the browser talks to the API at `http://localhost:3001`
> by default. To override, set `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`
> (Next.js only auto-loads env files from its own directory).

## Architecture & conventions (read before extending)

### `packages/contracts` is the load-bearing package

Every cross-cutting concept is defined ONCE here and imported by both
`apps/api` and `apps/web`:

- `permissions.ts` — the full permission key registry (`PERMISSIONS` +
  `PERMISSION_DEFINITIONS`, seeded into the DB). **Adding a permission is
  always additive** — append to both, never reorder/remove.
- `events.ts` — `EVENTS` (domain event names), `DomainEvent<T>` envelope,
  `EventPayloadMap` (typed payload per event name — `EventBusService.emit()`
  is generically typed off this, so a wrong payload shape is a compile error).
- `workflow.ts` — action types + per-type config shapes for the automation
  engine.
- `notifications.ts`, `audit.ts` — shared input/DTO shapes for those services.
- `common/pagination.ts` — `paginationQuerySchema` (zod) and `Paginated<T>` —
  every paginated list endpoint in the project uses this exact envelope.

### RBAC

Permission keys follow `<module>:<resource>.<action>` (e.g.
`inventory:stock.adjust`). `@RequirePermission(...)` (class- or method-level)
+ the global `PermissionsGuard` enforce **AND** semantics (every listed key
required). The same check (`checkRequiredPermissions` in `packages/auth`)
powers the web's `useAuth().hasPermission(...)` — client and server always
agree, though the server is what actually enforces it. Roles are fully
admin-creatable (no hardcoded role split beyond the seeded "Owner").

### Multi-file Prisma schema

`packages/database/prisma/schema/` holds multiple `.prisma` files (the
`prismaSchemaFolder` preview feature) — `schema.prisma` (foundation: Company,
User, Role, Permission, ...), `notification.prisma`, `workflow.prisma`,
`event-log.prisma`, `inventory.prisma`, `sales.prisma`. **This split exists
specifically so adding a new business domain doesn't require editing a file
everyone else also touches.** Adding a model:

1. Create `packages/database/prisma/schema/<yourmodule>.prisma`.
2. If it relates to a foundation model (`Company`, `User`) or another
   module's model (e.g. a new `SalesOrderLine`-style FK into `Product`),
   Prisma requires the back-relation field to exist on the *other* model too
   — add that one field to the other file. Keep this to the minimum single
   line; don't touch anything else in a file you don't own.
3. Every business table carries `companyId` (+ usually `createdById`/
   `updatedById`, `createdAt`/`updatedAt`) — this is the single-company-today,
   easy-to-extend-later convention. `companyId` is always read from the
   authenticated request (`@CurrentUser()`/CLS context), never hardcoded.

### The event bus / real-time layer

`EventBusService.emit(name, companyId, payload, actorUserId?)`
(`apps/api/src/core/event-bus/event-bus.service.ts`) is how every module
announces something happened. Each call: writes a durable `EventLog` row,
emits in-process via `EventEmitter2` (so `@OnEvent(name)` / `@OnEvent('**')`
listeners fire — this is how the workflow engine and the Socket.io gateway
both subscribe), and best-effort publishes to Redis for cross-instance
fan-out. **Always emit after your DB transaction commits** — subscribers
should never see a phantom update. The frontend subscribes via
`apps/web/src/lib/realtime/use-domain-events.ts`'s `useDomainEvents()` hook,
which opens an authenticated Socket.io connection and calls back on the
company's broadcast room.

### The workflow/automation engine

DB-configured rules, not a visual builder: a `WorkflowDefinition` fires when
its `triggerEvent` (one of `EVENTS`) matches, if its `conditionsJson`
(json-logic-js tree evaluated against the event payload) passes, then runs its
ordered `WorkflowAction`s (`notify` | `updateField` | `createRecord` |
`callWebhook` | `assignTask`) via `ActionHandlerRegistry`
(`apps/api/src/core/workflow/`). Every firing is logged to `WorkflowRun` for
debugging. Managed via the REST API (`/workflows`) and a form-based admin UI
(`apps/web/src/app/workflows/` — conditions stay a raw json-logic-js JSON
textarea rather than a graphical rule builder, deliberately, per the original
plan's "form-based, not visual-canvas" framing); the run history is visible
on each workflow's detail page.

### Inventory ↔ Sales: the reference integration pattern

`StockService` (`apps/api/src/inventory/stock.service.ts`) is the **only**
path that changes stock — `reserve()`/`commitReservation()`/`release()`/
`adjust()`, each transactional with its `StockMovement` audit row and each
emitting `inventory.stock.updated` (+ `inventory.stock.low` near the reorder
point) after commit. `SalesOrdersService.confirm()`/`fulfill()`/`cancel()`
(`apps/api/src/sales/sales-orders.service.ts`) call into it — read that file's
docblocks for the full write-up of how a cross-module write is composed
(including the known limitation: `StockService` manages its own transaction
per call, so a multi-line order confirm uses sequential reserve calls with a
compensating `release()` rollback on failure, not one wrapping DB
transaction — documented in detail at the top of `confirm()`).

**v1 simplification:** there's no per-line warehouse picker yet — orders
always reserve against the company's single "default" (first active)
warehouse. `fulfill()`/`cancel()` look up which warehouse a line was actually
reserved at via the `StockMovement` ledger (not by re-resolving "the
default") so they stay correct even if that changes later.

### Decimal handling

Prisma `Decimal` fields (money: `costPrice`, `salePrice`, `unitPrice`,
`totalAmount`, ...) are Decimal.js objects at runtime, not plain numbers.
**Every DTO mapper explicitly stringifies them** (`.toString()` or
`.toFixed(2)`) rather than relying on default JSON serialization. The
frontend keeps money as strings and only does `Number(...)` for display/sum.
Follow this pattern for any new money field.

### Frontend conventions

- `useAuth()` (`apps/web/src/lib/auth/auth-context.tsx`) exposes `user`,
  `permissions`, `hasPermission()`, `getAccessToken()` (for feature API
  clients to attach `Authorization: Bearer`), `login()`/`logout()`.
- Feature modules get their own typed fetch client (`lib/inventory/api.ts`,
  `lib/sales/api-client.ts`) rather than a shared generic one — each mirrors
  its backend module's DTOs.
- `AppShell` (`components/app-shell.tsx`, mounted once from `Providers`) is
  the persistent, permission-aware top nav — every destination is filtered by
  `hasPermission(requiredPermission)` before it's shown. Module sections with
  real multi-page sub-navigation (Inventory's Products/Warehouses/Stock,
  Sales's Orders/Customers) still render their own local sub-nav underneath
  it; single-resource modules (Finance, HR, Procurement, Projects, Workflows)
  don't — a local nav with exactly one link to itself added nothing.
- `useTableFilters` (`lib/hooks/use-table-filters.ts`) is the shared "read
  filters from the URL query string" hook — see `app/inventory/stock/page.tsx`
  for the reference usage. Pass an explicit type argument
  (`useTableFilters<{ x: string; y: boolean }>({...})`) rather than letting it
  infer from the defaults object — TS infers literal types (e.g. `false`
  instead of `boolean`) from object-literal arguments against a
  union-constrained generic, which then rejects normal toggle code like
  `setFilter('y', !y)`.
- Live updates: `useDomainEvents(callback, filterEventName?)` — see
  `app/inventory/stock/page.tsx` and `app/sales/orders/[id]/page.tsx` for the
  two established patterns (silent background refetch vs. targeted
  per-row/per-line update).

## How this was built (context for continuing the work)

This project was built by an orchestrating Claude Code session that
decomposed the work into phases. Early phases (through the initial dashboard
slice) delegated implementation to parallel Opus sub-agents working in
isolated git worktrees, each briefed with a narrow scope and an explicit list
of files it must NOT touch (to keep parallel agents collision-free); the
orchestrator reviewed every diff by hand before merging, because the dev
machine had no Node.js/npm/Docker installed and **nothing could be compiled
or run** — correctness was established by careful reading and
cross-referencing, not execution.

A later session, on a machine with a real toolchain, ran the first-ever
compile, fixed what it found, and continued the same phased approach but with
machine verification at every step: `pnpm typecheck` + `pnpm lint` after every
change, and a real headless-Chromium (Playwright) browser session to actually
exercise each new feature end-to-end before committing — not just "it
compiles," but "I logged in and clicked through it." That session also reused
the parallel-worktree-agent pattern for the four structurally-identical
Finance/HR/Procurement/Projects stubs (see git log around "Add Finance, HR,
Procurement, Projects module stubs" for how collisions were avoided: the
shared-file touchpoints — Prisma back-relations, `app.module.ts` registration
— were resolved by the orchestrator up front, not discovered via merge
conflicts after the fact).

**If you're continuing this project as an AI agent:** if you have a working
toolchain, use it — `pnpm typecheck`/`pnpm lint` after every change, and
actually run the app (`pnpm dev` + a browser, real or automated) before
declaring a feature done. Compiling is necessary but not sufficient; several
real bugs in this codebase's history were only caught by actually clicking
through the feature (e.g. a live-push notification silently going nowhere
because of a wrong user ID — passed typecheck fine, only visible by watching
it not arrive in a browser). If you have no toolchain, fall back to the
original hand-review discipline: narrow, explicit-file-list agent briefs,
and careful reading over trusting a self-report.

## Handoff — read this first if you're the next session

Every phase from the previous "Suggested next phases" list is now done —
Notifications frontend, the dashboard widget-registry framework, all four
remaining business-module stubs, the workflow admin UI, and a real app shell
are all built, integrated, and verified in a real browser session. This was a
natural stopping point (list exhausted), not a time-box cutoff:

- Everything in the status table above marked "Done" is merged to `main`,
  typechecks/lints clean across all workspace packages, and was exercised in
  a real browser (not just compiled) before being committed.
- **Nothing was left mid-edit or uncommitted.** Run `git log --oneline -20`
  and `git status` to confirm before doing anything else — if `git status`
  isn't clean, something unexpected happened after this README was written
  and you should investigate before proceeding.
- No agent worktrees should be left lying around (`.claude/worktrees/` is
  gitignored and should be empty or absent — if you find stale ones from an
  interrupted run, check `git worktree list` and clean up with
  `git worktree remove` before starting new work; note some worktree
  directories can hit Windows' path-length limit on plain deletion — a
  `robocopy <empty-dir> <target> /MIR` "mirror an empty dir over it" trick
  clears those where `rm -rf` can't).
- Dev-only artifacts you'll see in a fresh `pnpm dev` + login: the seeded
  admin's test data from verification sessions (a few products/warehouses/
  purchase orders/projects/employees named things like "Test Widget" or
  "Trigger Widget") may still be in your local Postgres volume depending on
  whether you're reusing the same `docker compose` volume — harmless, delete
  via the UI or `db:reset` if it bothers you.

### Suggested next phases, roughly in priority order

Since the list above was written, **Reporting** shipped (7 cross-module
report types, CSV export — see the status table) and a fresh-eyes security
audit (a background agent with no memory of the building session, briefed to
find problems and report back, not fix them) surfaced 15 real findings —
everything critical/high/medium severity is fixed (see git log around "Fix
critical/high findings from a fresh-eyes security audit" and "Fix medium/low
findings..."), including a real vulnerability: workflow `updateField`/
`createRecord` allowed writing to *any* Prisma model/field by string
(gated only by `admin:workflow.manage`), which could have overwritten
`User.passwordHash` or created rows in another company. Now scoped to a
business-domain model allowlist + field denylist + forced company-scoping.

1. **Automated tests** — there are currently **zero** automated tests
   anywhere in this repo (`find . -iname "*.spec.ts" -o -iname "*.test.ts"`
   returns nothing). Every phase so far — including the security fixes above —
   has been verified by hand (typecheck + lint + a real Playwright/curl pass
   against the running dev server) rather than a regression suite. With 9
   modules now, that's the biggest structural risk to future changes — a good
   starting scope: NestJS's built-in Jest setup for the trickiest business
   logic (`StockService`'s reserve/commit/release — now with row-level
   locking worth regression-testing under concurrency, not just correctness —
   the workflow engine's model/field allowlist and condition evaluation,
   `SalesOrdersService.confirm()`'s compensating-release rollback).
2. **Procurement line items** — `PurchaseOrder` is currently a single
   `totalAmount` with no `PurchaseOrderLine`/`Product` tie, unlike `SalesOrder`
   (real `SalesOrderLine[]`). A real receiving flow (PO line → Inventory
   `StockService.adjust()`) needs that structure first — flagged in
   `procurement.prisma`'s docblock.
3. **HR ↔ User linking** — `Employee` is currently standalone with no relation
   to `User`, so there's no self-service ("my profile," "my time off") story
   yet — flagged in `hr.prisma`'s docblock as the intended growth path.
4. **Users/Roles admin API + UI** — `admin:users.manage`/`admin:roles.manage`
   permission keys are reserved and seeded, but there is no way, via the API
   or UI, to create a second user or role — the "roles are fully
   admin-creatable" line elsewhere in this file describes the *enforcement*
   machinery (`PermissionsGuard`, `hasPermission`), not an actual admin
   surface. Every module built so far has only ever been exercised by a
   super-user (the seeded Owner) plus one hand-created read-only test role
   (`packages/database/prisma/create-test-user.ts` — a throwaway dev script,
   not a real feature). A real admin UI for this is overdue.
5. **Workflow conditions as a real (optional) visual builder** — currently a
   raw json-logic-js JSON textarea (deliberately, per the original plan's
   "form-based, not visual-canvas" framing). If usage shows admins actually
   struggling with raw JSON, a constrained visual builder for the common
   comparison operators would be the next step — but don't build this
   speculatively; the textarea is a legitimate, shipped v1.

Two low-severity/cosmetic findings from the audit, not worth a dedicated pass
but easy to fold into other work nearby: `packages/ui`'s `CardDescription`/
`CardFooter`/`KpiCard`'s `delta` prop are built but never actually used
anywhere in `apps/web` (dead surface area — either wire one up or drop them);
`lib/dashboard/widget-registry.tsx`'s money formatting hardcodes `currency:
'USD'` rather than reading it from `Company.settingsJson`, fine for the
current single-currency deployment but worth a comment if not fixed outright.
