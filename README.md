# Everything in this README.md is generated my Microsoft Copilot using Opus Claude.
# Pretty much the entire code of this web application was generated my Microsoft Copilot using Opus Claude based on input from a non-programmer / developer. Even the ROADMAP.md and SPRINT_BACKLOG.md were drafted by the AI.
# OM Operations Platform

A district-aware web application for managing the full lifecycle of operations & maintenance (O&M) work — from request intake, through work order assignment, contractor execution, field inspection, and closeout. Built on ArcGIS Enterprise + SDE at Duplantis Design Group (DDG).

---

## What this repo contains

A React + TypeScript single-page app (Vite) that authenticates against Portal for ArcGIS via OAuth and reads/writes against SDE-backed feature services for requests and work orders.

- **`om-app/`** — the React/TypeScript app source
  - `src/config/` — ArcGIS config (Portal URL, OAuth app ID)
  - `src/services/` — REST service clients (`requestService.ts`, `workOrderService.ts`)
  - `src/components/` — UI components (request list, work order list, assignment views)
- **`SPRINT_BACKLOG.md`** — working task list, organized by epic
- **`ROADMAP.md`** — vision, principles, phases, role model

---

## How it fits together

```
                ┌──────────────────────┐
                │  Portal for ArcGIS   │
                │  (OAuth + REST)      │
                └──────────┬───────────┘
                           │
                           ▼
┌─────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  React app  │───▶│  Feature Services│───▶│  SDE / SQL Server│
│  (this repo)│    │  (om_request,    │    │  (triggers,      │
│             │    │   om_work_order, │    │   archiving,     │
│             │    │   *_notes)       │    │   relationships) │
└─────────────┘    └──────────────────┘    └──────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Power Automate  │
                  │  (notifications) │
                  └──────────────────┘
```

The SDE geodatabase is the source of truth. Business rules live as close to the data as practical: domains, relationship classes, triggers, and archiving. The app is a thin, opinionated interface over that foundation.

---

## Local development

This app is developed in **GitHub Codespaces** against the DDG Portal for ArcGIS instance.

### First-time setup
```bash
cd om-app
npm install
```

### Run the dev server
```bash
npm run dev
```

### Build for production
```bash
npm run build
```

---

## Key design decisions

- **Database-first.** The SDE schema and triggers own the rules. The app respects them; it does not work around them.
- **District-aware by default.** Every view, action, and permission is scoped to a district. Cross-district work is explicit, not accidental.
- **Auditable, not editable.** Notes are append-only in the UI. Edit history lives in SDE archive history if it's ever needed.
- **Omniscient ≠ Omnipotent.** Admins can see everything across districts. Only developers can change everything.
- **No direct SQL inserts on SDE-managed editable tables.** All edits go through ArcGIS-managed paths.

---

## Role Model

### Internal (DDG)

| # | Role | Scope | Can do |
|---|---|---|---|
| 1 | **Super Admin** | all districts | Everything below + schema/SDE/system config |
| 2 | **Program Admin** | all districts | Everything below + full record & assignment control |
| 3 | **Tier 2 Triager** | single / multi / all | Everything below + assign to MI/CP, flag Design required, escalate urgency to Emergency/Immediate, **cancel** a request (with reason), **close** a request by moving to a different program (with reason) |
| 4 | **Tier 1 Triager** | single / multi / all | Verify intake data, set Standard urgency, create requests, advance status (Triaged → In Design / Ready for Work Order). **Cannot cancel or close.** |
| 5 | **Field Inspector (CE&I)** | single / multi / all | Create inspection records tied to WOs (accept/reject work). **Read-only on requests and WOs.** Cannot create follow-up requests *(deferred)*. |

**Cumulative permissions:** Program Admin ⊇ Tier 2 ⊇ Tier 1. Super Admin ⊇ everything.

**Scope attribute:** every internal role carries `districts[]` — one, many, or `*` for all. Triagers default to `*` (program-wide), but the model supports scoping them later without a schema change.

### External — credentialed

| # | Role | Scope | Can do |
|---|---|---|---|
| 6 | **Designer (Consultant)** | TBD | *Lifecycle undefined — placeholder in `roles.ts`, no permissions wired yet* |
| 7 | **Contractor** | their contracted districts only | See WOs assigned to them + the requests attached to those WOs (read-only on requests). Update a contractor-progress portion of the WO to signal status back to DDG. **Cannot see** unassigned requests or other contractors' WOs/requests. |
| 8 | **Field Reporter** | n/a (submit only) | Submit requests with extended fields (severity, route ID, richer photos) |

### External — anonymous

| # | Role | Scope | Can do |
|---|---|---|---|
| 9 | **General Public** | n/a | Create-only via public intake form. No read access. |

### Edge cases parked

- **WO reassignment between contractors** — edge case, default is "doesn't happen." Retention rules to be specced if/when it comes up.
- **Designer consultant lifecycle** — placeholder only. Will revisit when the Design phase workflow is defined.
- **Field Inspector creating follow-up requests** — explicitly out of scope for v1.

---

## Project docs

- [`ROADMAP.md`](./ROADMAP.md) — where this is headed and why
- [`SPRINT_BACKLOG.md`](./SPRINT_BACKLOG.md) — what's being worked on next

---

## Owner

**John McEwen** — GIS Manager, Duplantis Design Group
