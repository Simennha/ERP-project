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

If you already know exactly what you want next (e.g. "build the notifications
bell" or "start on the HR module"), just say that directly — the session will
still benefit from reading this file first, but you don't need the generic
prompt above.

## Current status (what's real vs. what's a stub)

| Area | Status |
|---|---|
| Monorepo scaffold, tooling | Done |
| Auth (JWT + refresh cookie), RBAC | Done |
| Real-time event bus (Socket.io + Redis) | Done |
| Audit logging (explicit + auto-diff extension) | Done |
| Notifications (persistence + live push) | Backend done, **no frontend UI at all** — no bell icon, no notification list page. `NotificationService`/`GET /notifications`/`POST /notifications/:id/read` exist and work; nothing in `apps/web` calls them yet |
| Workflow/automation engine (json-logic conditions, 5 action types, CRUD API) | Done, **no admin UI yet** (API only) |
| Inventory (products, warehouses, stock, movements) | Done (backend + UI) |
| Sales (customers, orders, full draft→confirmed→fulfilled/cancelled lifecycle) | Done (backend + UI), reserves/commits/releases real stock |
| Finance, HR, Procurement, Projects | **Not started** — permission keys reserved in `packages/contracts/src/permissions.ts`, nothing else |
| Dashboard | **Partial** — `GET /dashboard/summary` + 4 real KPI tiles with drill-down links, live-updating (`apps/api/src/dashboard/`, `apps/web/src/app/dashboard/page.tsx`). **Not** the generalized widget-registry framework from the original plan (see "Suggested next phases") — this is 4 hand-written numbers, not a pluggable per-module widget system |
| Reporting | **Not started** |

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
      inventory/            Warehouse/Product/StockItem/StockMovement + StockService (see below)
      sales/                Customer/SalesOrder/SalesOrderLine/Invoice + order lifecycle
  web/                      Next.js app
    src/
      lib/auth/             AuthProvider/useAuth() (access token in memory, refresh via cookie)
      lib/realtime/         useDomainEvents() - Socket.io client hook
      lib/inventory/, lib/sales/   Feature API clients
      app/inventory/, app/sales/  Feature pages
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

> **Note on this repo's history:** every phase of this project so far was built
> on a machine with no Node.js/pnpm/Docker installed at all — every agent that
> wrote code here did so by hand, cross-checking imports/exports by reading
> files rather than compiling. That means **the very first `pnpm install` +
> `pnpm typecheck` on a real machine is this project's first-ever compile.**
> Expect to fix a handful of minor issues (a version mismatch, a Prisma type
> nuance) — the architecture and wiring have been carefully reviewed, but
> nothing here has been machine-verified until you do it.

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
debugging. Manage via the REST API (`/workflows`) — there's no admin UI yet.

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
- There is **no global app shell/sidebar yet** — each feature module (
  `app/inventory/layout.tsx`, `app/sales/layout.tsx`) renders its own small
  section nav. Building a real one is dashboard-phase scope.
- There is **no shared `useTableFilters` hook yet** — pages that read
  filters from the URL do so directly via `useSearchParams` (see
  `app/inventory/stock/page.tsx`). Extract a shared hook once enough pages
  need it (flagged as dashboard-phase scope in the plan).
- Live updates: `useDomainEvents(callback, filterEventName?)` — see
  `app/inventory/stock/page.tsx` and `app/sales/orders/[id]/page.tsx` for the
  two established patterns (silent background refetch vs. targeted
  per-row/per-line update).

## How this was built (context for continuing the work)

This project was built by an orchestrating Claude Code session that
decomposed the work into phases and delegated most of the implementation to
parallel Opus sub-agents working in isolated git worktrees, each briefed with
a narrow scope and an explicit list of files it must NOT touch (to keep
parallel agents collision-free). The orchestrator reviewed every agent's diff
by hand before merging — reading the actual code, not trusting the agent's
self-report — because the dev machine had no Node.js/npm/Docker installed, so
**nothing could be compiled or run**; correctness was established by careful
reading and cross-referencing, not execution. If you're continuing this
project as an AI agent: keep that discipline. If you're continuing it as a
human with a working toolchain: run `pnpm typecheck` immediately and treat
any error as expected-and-fixable, not a sign something is deeply wrong.

## Handoff — read this first if you're the next session

The previous session was stopped by an explicit time-box (the user asked to
work until a specific time, then write handoff notes), **not** because a
phase was finished and it was a natural stopping point. Concretely, at
cutoff:

- Everything described in the status table above as "Done" is genuinely
  merged to `main` and was carefully hand-reviewed (see "How this was built"
  below) — safe to build on.
- The dashboard row ("Partial") was the very last thing touched. It's a
  complete, working, small vertical slice (real numbers, real drill-down
  links, live-updating) — not a half-finished framework. Don't treat it as
  broken; treat it as intentionally minimal.
- **Nothing was left mid-edit or uncommitted.** Run `git log --oneline -20`
  and `git status` to confirm before doing anything else — if `git status`
  isn't clean, something unexpected happened after this README was written
  and you should investigate before proceeding.
- No agent worktrees should be left lying around (`.claude/worktrees/` is
  gitignored and should be empty or absent — if you find stale ones from an
  interrupted run, check `git worktree list` and clean up with
  `git worktree remove` before starting new work, per the pattern used
  throughout this project).

### Suggested next phases, roughly in priority order

1. **Notifications frontend** — the backend is fully built and unused. Add a
   bell icon + dropdown (or a `/notifications` page) that calls
   `GET /notifications` and `POST /notifications/:id/read`. This is the
   highest-value gap: the workflow engine's `notify` action already creates
   these rows, so there's real data waiting with no UI to see it.
   **Live-push gotcha to fix first:** `NotificationService.send()`
   broadcasts via `emitToUser(userId, 'notification.created', dto)` — a RAW
   socket.io event name carrying a bare `NotificationDto` — which is a
   *different* channel from `RealtimeGateway`'s `'domain-event'` broadcast
   that `useDomainEvents()` listens on (see `realtime.gateway.ts`'s
   `REALTIME_EVENT` constant vs. `notifications.service.ts`'s
   `NOTIFICATION_CREATED_EVENT`). `useDomainEvents()` as written will
   **never** see a notification push. Either add a small second hook that
   listens for a named raw socket event, or (probably cleaner) change
   notification creation to also flow through `EventBusService.emit()` so
   there's one real-time channel, not two. Decide and document whichever way
   you go — right now it's an inconsistency, not a deliberate design.
2. **Generalize the dashboard into the widget-registry framework** described
   in the original project plan: each module contributes its own
   `widgets.ts` (auto-discovered, not one shared array everyone edits), a
   proper `requiredPermission`-aware widget component registry, and the
   shared `useTableFilters` hook (extract it now — both `app/inventory/stock`
   and the dashboard KPI links independently reimplement "read a filter from
   the URL," which was flagged as a TODO in both places).
3. **Finance, HR, Procurement, Projects stubs** — permission keys already
   exist in `packages/contracts/src/permissions.ts`; each needs a Nest
   module, 1-2 entities, basic CRUD, a nav entry, and one dashboard widget
   wired to a real query — follow the Inventory/Sales modules as the
   reference shape, and the "additive-only edits to shared files" discipline
   described above.
4. **Workflow admin UI** — a form-based (not visual-canvas) builder for
   `WorkflowDefinition`/`WorkflowAction` against the existing `/workflows`
   API.
5. **A real app shell/nav** — right now each feature module renders its own
   small section nav (`app/inventory/layout.tsx`, `app/sales/layout.tsx`) and
   the dashboard links to them ad hoc. A persistent sidebar/top-nav that
   reflects the user's permissions belongs here.
