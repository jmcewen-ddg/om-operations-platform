# OM Operations Platform — Roadmap

> A high-level view of where the OM Operations Platform is headed.
> For the working task list, see [`SPRINT_BACKLOG.md`](./SPRINT_BACKLOG.md).

---

## Vision

A single, district-aware platform that streamlines the full lifecycle of operations & maintenance work — from the moment a request is reported, through assignment to a work order, contractor execution, field inspection, and closeout. Built on the existing ArcGIS Enterprise + SDE foundation, with role-based access for internal staff, contractors, and the general public.

---

## Guiding Principles

- **Database-first.** The SDE geodatabase is the source of truth. Business rules live as close to the data as practical (domains, relationship classes, triggers, archiving).
- **District-aware by default.** Every view, action, and permission respects district boundaries. Cross-district work is the exception, not the rule.
- **Auditable, not editable.** Notes and status changes are preserved in archive history rather than overwritten in place.
- **Omniscient ≠ Omnipotent.** Admins can see everything; only developers can change everything.
- **Progressive disclosure of complexity.** Internal users first, contractors next, public last — each layer adds security and architectural rigor.

---

## Current State (as of June 2026)

The platform has a working foundation:

- ArcGIS OAuth authentication against Portal for ArcGIS
- Unassigned requests load from a REST feature service
- Users can select one or more requests and create a work order
- Work order district and priority auto-derive from the source request(s)
- SDE schema in place for requests, work orders, request notes, and work order notes — with relationship classes wired up
- OM brand palette applied to the UI

In short: the **happy path from request → work order creation** is live. Everything else on this roadmap builds outward from that core.

---

## Phase 1 — MVP: Internal Lifecycle (current focus)

Goal: an internal DDG user can manage the full request → work order → submitted-to-contractor lifecycle for their district, with notes and status history.

- Complete work order CRUD (delete, edit, cancel)
- Full request ↔ work order assignment flows (add, remove, reassign, move to Maintenance Initiative / Capital Project, cancel)
- Notes on requests and work orders (add + read; no in-app edit)
- District-based tabs with strict cross-district guardrails
- "All Districts" read-only view for admins
- Status workflow with a "Submit to Contractor" action
- Power Automate notification when a work order is submitted

**Outcome:** internal staff stop relying on side channels (email, spreadsheets) for tracking and handoff.

---

## Phase 2 — V1.1: Visibility & Reporting

Goal: leadership and dispatchers can see the state of the program at a glance, and contractors get a clean printable packet.

- Dashboard view with counts of requests and work orders by status, per district
- Aging indicators and SLA highlighting for Immediate / Emergency / Standard tiers
- "No contractor response yet" highlight
- PDF export of a work order (contractor packet)

**Outcome:** the program becomes legible to people who don't live inside the app every day.

---

## Phase 3 — V1.2: Production Polish

Goal: the app feels like a finished product, not a prototype.

- Map view of requests and work orders
- Filter, sort, and search across requests and work orders
- Consistent brand styling, loading states, and error handling
- Multi-district work order handling (now that tabs exist)
- Hardened SQL triggers, views, and Power Automate flows for aging alerts and inspection follow-ups

**Outcome:** day-to-day usage is smooth, predictable, and ready for broader adoption.

---

## Phase 4 — V2: Closing the Field Loop

Goal: extend the platform from "we dispatched the work" to "we verified the work was done right."

- Survey123 field inspection forms for requests and work orders
- Inspection relationship classes in SDE
- Inspection results (pass/fail, photos, notes) visible in the web app
- Power Automate flow for failed inspections → reassignment

**Outcome:** quality assurance is captured systematically instead of through tribal knowledge.

---

## Phase 5 — V3: External Users

Goal: open the platform — carefully — to people outside DDG.

- **Contractors:** a user store supporting multiple users per contractor, scoped strictly to their contracted districts. They can view and respond to assigned work orders without ever seeing another contractor's work.
- **General Public:** a credential-free intake path for new requests, likely via Survey123 backed by a scaled-down create-only feature service. Anti-spam and validation get serious attention here.

**Outcome:** the platform becomes the front door for the program, not just the back office.

---

## R&D Track — Drag-and-Drop Assignment

Parallel to the phases above, an ongoing experiment: can request → work order assignment be done by dragging tiles between panes? Two paths under consideration:

1. Custom React implementation inside this app
2. A custom widget in ArcGIS Experience Builder

A spike on each, then a decision.

---

## Role Model

| Role | Scope | Permissions |
|---|---|---|
| **Internal user** | Their assigned district(s) | Create, edit, assign within district |
| **Admin** | All districts | Read-only across districts (*omniscient, not omnipotent*) |
| **Dev** | Everything | Full access for development and support |
| **Contractor** *(future)* | Their contracted districts | View and respond to assigned work orders |
| **Public** *(future)* | None | Anonymous request submission only |

---

## What's Intentionally Out of Scope (for now)

- Financial / billing integration
- Asset management beyond what the request and work order schemas already capture
- Native mobile apps (Survey123 covers the field side)
- Real-time collaboration features (multi-user simultaneous editing of the same work order)

These may resurface in future planning, but they are not on the path to V3.

---

## Owner & Cadence

- **Architect / Lead Developer:** John McEwen, GIS Manager, DDG
- **Backlog of record:** [`SPRINT_BACKLOG.md`](./SPRINT_BACKLOG.md)
- **Cadence:** iterative; phase boundaries are checkpoints, not hard deadlines
