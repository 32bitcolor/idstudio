# IDStudio — Instructional Designer Workspace

A self-hosted web app for instructional design teams: a full-featured Kanban board,
ID-tailored project management (ADDIE/SAM), a storyboarding suite, a certification &
exam builder, and LMS integration (LearnUpon). Built to run on your own Proxmox server.

> **Status: Phase 1 complete — Phase 2 next.** The foundation (auth, multi-user workspaces
> with roles, and the self-hosting stack) and the full Kanban board (boards, drag-and-drop,
> card details, checklists, comments, attachments, and filters) are built and verified.
> Up next: project management. See the **[Roadmap](#roadmap)** below.

## Tech stack

| Layer        | Choice |
| ------------ | ------ |
| Framework    | Next.js 16 (App Router, React 19) — UI, API, Server Actions |
| Language     | TypeScript end to end |
| Database     | PostgreSQL 16 + Prisma 7 (with `@prisma/adapter-pg` driver adapter) |
| Auth         | Email/password, argon2 hashing, signed-JWT sessions (`jose`) + a Data Access Layer. Per-workspace roles (ADMIN / MEMBER) |
| Validation   | Zod 4 |
| Background   | BullMQ + Redis (worker process) |
| Object store | MinIO (S3-compatible) — used from Phase 1 for attachments |
| Reverse proxy| Caddy (automatic HTTPS) |
| Packaging    | Docker Compose |

### A note on auth
We deliberately use the lightweight **`jose` session + Data Access Layer** pattern from the
official Next.js 16 docs rather than NextAuth/Auth.js. NextAuth v5 is still beta and predates
Next 16's "Proxy" (middleware) rename and async request APIs; for a foundation we didn't want
to bet on unproven compatibility. The user-facing result (email/password login + roles) is the
same, and it's fully self-contained. This can be swapped for an auth library later if needed.

## Project layout

```
src/
  app/
    (auth)/login, (auth)/signup   Auth pages
    dashboard/                     Protected dashboard (role-gated admin panel)
    actions/auth.ts                Server Actions: signup / login / logout
  components/                      Auth form client components
  lib/
    db.ts        Prisma client (singleton, pg adapter)
    session.ts   jose encrypt/decrypt + session cookie
    dal.ts       Data Access Layer: getCurrentUser / requireUser / requireAdmin
    password.ts  argon2 hash/verify
    validation.ts Zod schemas
  proxy.ts       Next 16 "Proxy" (formerly middleware) — optimistic auth gate
prisma/
  schema.prisma  Models: User, Workspace, Membership, Role
  seed.ts        Idempotent first-admin seed
worker/index.ts  BullMQ worker (LMS sync lands here in Phase 5)
deploy/Caddyfile Reverse-proxy config
Dockerfile       Multi-stage: deps → build → migrate / app / worker
docker-compose.yml
```

## Local development

Prerequisites: Node.js 20+ and Docker.

```bash
# 1. Install dependencies
npm install

# 2. Start Postgres + Redis (and create your env)
cp .env.example .env          # then edit secrets
docker compose up -d postgres redis

# 3. Apply the schema and seed the first admin
npm run db:migrate            # creates/applies migrations
npm run db:seed               # creates admin@idstudio.local / changeme123

# 4. Run the app + (optionally) the worker
npm run dev                   # http://localhost:3000
npm run worker                # in a second terminal
```

Sign in at http://localhost:3000 with the seeded admin, or create a new workspace via **Sign up**.

### Useful scripts
- `npm run build` — production build (standalone output)
- `npm run db:migrate` — create & apply a migration (dev)
- `npm run db:deploy` — apply migrations (prod / CI)
- `npm run db:seed` — seed the first admin (idempotent)

## Deploying to your Proxmox server

See **[docs/DEPLOY-PROXMOX.md](docs/DEPLOY-PROXMOX.md)** for the full walkthrough. In short:
create an Ubuntu VM, install Docker, copy this repo + a filled-in `.env`, point DNS at the VM,
and run `docker compose up -d`. Caddy provisions HTTPS, the `migrate` service applies the schema
and seeds the admin, then the app and worker start.

## Roadmap

- ✅ **Phase 0 — Foundation:** auth, multi-user workspaces with roles, Docker/Proxmox stack
- ✅ **Phase 1 — Kanban:** boards, drag-and-drop, card details (description, due date, labels,
  assignees), checklists, comments, attachments, and filters
- ⬜ **Phase 2 — Project management** *(next)* — ADDIE/SAM workflows, milestones, deliverables,
  review cycles, time tracking
- ⬜ **Phase 3 — Storyboarding suite**
- ⬜ **Phase 4 — Certifications & exam builder**
- ⬜ **Phase 5 — LearnUpon integration**

Full detail in `.claude/plans/deep-jumping-treehouse.md`.
