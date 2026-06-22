# OM Operations Platform — Sprint Backlog

> Living document. Check items off as they're completed. Organized by Epic → Story/Task.
> Phasing guidance at the bottom.

---

## ✅ Already Done
- [x] ArcGIS OAuth/token handling
- [x] Load unassigned requests from REST service
- [x] Multi-select requests (checkboxes)
- [x] Create empty work order
- [x] Create work order from selected request(s)
- [x] Auto-populate district from request location
- [x] Auto-drive priority from highest urgency (Immediate > Emergency > Standard)
- [x] Refresh requests / work orders buttons
- [x] Apply OM brand color palette
- [x] Database: `om_request_notes` + `om_work_order_notes` SDE tables w/ relationship classes
- [x] Client-side enforcement: Draft → Open on first assignment, Open → Draft on last unassign, lock-on-Closed/Canceled
- [x] Request notes — read/add/soft-delete in collapsible panel section
- [x] Work order notes — read/add/soft-delete in detail panel
- [x] Auto-populate note author from logged-in ArcGIS user
- [x] Hoist feature service URLs to `arcgisConfig` (single source of truth)
- [x] Client-side WO lifecycle rules: Draft↔Open promote/revert, lock-on-Closed/Canceled
- [x] Move request → Maintenance Initiative / Capital Project (with auto-stamped dates + auto Triage note)

---

## 🎯 Epic 1: Work Order Lifecycle (CRUD)
- [ ] Delete a work order
  - [ ] Confirm dialog
  - [ ] Reassign attached requests → `Unassigned`
  - [ ] Soft-delete (`DELETED = TRUE`) vs hard delete decision
- [ ] Edit a work order (title, description, priority override, status)
- [ ] View work order detail panel
- [ ] Cancel a work order (status change, record retained)
- [ ] "Submit to Contractor" action (status flip → triggers Power Automate notification)

## 🎯 Epic 2: Request ↔ Work Order Assignment
- [ ] Add request(s) to existing work order
- [ ] Remove a request from a work order (→ `Unassigned`)
- [ ] Reassign a request between work orders
- [ ] Cancel a request (with reason/notes)
- [ ] Move requests
    - [X] Move request → Maintenance Initiative
    - [X] Move request → Capital Project
    ## Follow-ups from Move-to-Program work
    - [ ] Add relationship classes: om_request ↔ om_maintenance_initiative, om_request ↔ om_capital_project
    - [ ] Add proper `id` fields on MI / CP tables (currently using GlobalID as workaround)
    - [ ] Replace MoveToInitiativeModal free-text input with a dropdown sourced from MI/CP services
    - [ ] Admin view for closed/moved requests (so users can find Moved-to-MI/CP records)
    - [ ] Move-from-WO-direct-to-Program (auto-unassigns from WO, applies WO draft-revert rule)
    - [ ] Return-to-Triage flow (undo accidental move) — currently admins must edit in ArcGIS Pro / SQL
- [ ] Enforce district match — a request cannot be assigned to a WO in a different district

## 🎯 Epic 3: Notes
> Design decision: **notes are not editable in the app.** Archiving is enabled on the SDE notes tables, so the historical record is preserved by the database itself. If editing is ever introduced later, it will be governed by archive history, not in-app edit logic.

- [ ] Add note to a request
- [ ] Add note to a work order
- [ ] Note type selection (domain-driven)
- [ ] Auto-timestamp + author capture on create (editor tracking)
- [ ] Display notes list (chronological, by type) on detail panels
- [ ] Read-only display — no in-app edit UI
- [ ] (Deferred) If edit ever needed: rely on SDE archive history for audit

## 🎯 Epic 4: District-Based UX
- [ ] Tabs per district in the main UI
- [ ] Each tab shows only requests for that district
- [ ] Each tab shows only work orders for that district
- [ ] Cross-district assignment blocked at UI **and** service layer
- [ ] **"All Districts" admin view** — omniscient (read all) but not omnipotent
  - [ ] Role check: only admin role sees this tab
  - [ ] Read-only across districts unless user also has edit rights for that district
- [ ] Persist last-viewed tab per user (localStorage)

## 🎯 Epic 5: Status & Workflow
- [ ] Status change UI for requests
- [ ] Status change UI for work orders (Draft → Ready → Submitted → … → Closed)
- [ ] Optional Design phase toggle
- [ ] Status history view (once SQL triggers are live)
- [ ] Power Automate flow: notify contractor when WO submitted

## 🎯 Epic 6: Dashboard & Reporting
- [ ] Dashboard view
  - [ ] Counts of requests by status, per district
  - [ ] Counts of work orders by status, per district
  - [ ] Highlight aging requests (color rules by urgency tier)
  - [ ] Immediate / Emergency / Standard SLA indicators
  - [ ] Unresponded-by-contractor highlight
  - [ ] PDF export of a work order (printable contractor packet)
  - [ ] PDF export of a request (optional)

## 🎯 Epic 7: Inspections (future)
- [ ] Survey123 field app form for inspections (request-level)
- [ ] Survey123 field app form for inspections (work-order-level)
- [ ] Relationship class for inspections → requests / work orders
- [ ] Display inspection results in web app
- [ ] Pass/fail indicators + photos

## 🎯 Epic 8: External Users & Public Intake (future)
- [ ] Contractor user store (multiple users per contractor)
- [ ] Contractor role: scoped to contracted districts only
- [ ] Contractor can view/respond to assigned WOs in their districts
- [ ] Public intake — credential-free request submission
  - [ ] Scaled-down create-only feature service
  - [ ] Survey123 public form (interim solution — already viable)
  - [ ] Anti-spam / validation considerations

## 🎯 Epic 9: UI/UX Polish
- [ ] Multi-district work order handling (after Epic 4 tabs)
- [ ] Map view of requests and work orders
- [ ] Filter/sort unassigned requests (district, urgency, date)
- [ ] Search by request ID / work order ID
- [ ] Brand colors applied consistently
- [ ] Loading states & error toasts standardized

## 🎯 Epic 10: Drag-and-Drop (Stretch / R&D)
- [ ] Spike: drag-and-drop in custom React app
- [ ] Spike: drag-and-drop via custom ArcGIS Experience Builder widget
- [ ] Decide direction and implement

## 🎯 Epic 11: Backend Dependencies (parallel track)
- [ ] SQL triggers for `om_request` status history
- [ ] SQL triggers for `om_work_order` status history
- [ ] Views for app / Power Automate consumption
- [ ] Survey123 intake form (after triggers/views)
- [ ] Power Automate notification flows
  - [ ] WO submitted → contractor email
  - [ ] Aging request → internal alert
  - [ ] Inspection failed → reassignment alert
- [ ] SQL trigger: enforce request ↔ WO lifecycle rules server-side
  - Assign request → if WO is Draft, promote to Open
  - Unassign last request → if WO is Open, revert to Draft
  - Block any request → WO assignment change when WO is Closed/Canceled
  - Once live, remove client-side enforcement in `requestService.ts`

## 🎯 Epic 12: Admin / Roles / Handoff
> Role model:
> - **Internal user** — edit within their district(s)
> - **Admin** — *omniscient, not omnipotent*: read-only visibility across all districts
> - **Dev** — *omnipotent*: full access for development/support
> - **Contractor** (future) — scoped to contracted districts
> - **Public** (future) — anonymous create-only intake

- [ ] User role awareness in app (internal / admin / dev)
- [ ] Audit trail visibility (editor tracking)
- [ ] Deployment story — where this app actually lives
- [ ] Documentation / handoff guide
- [ ] Onboarding flow for new internal users

## 🎯 Epic 13: Stakeholder Requirements (from PO intake)

### Intake / Reporting
- [ ] Photo attachments on requests — optional, encouraged; consider hotline alternative
- [ ] Severity ranking — internal-only field (not public-submitted)
- [ ] Duplicate detection — define threshold (distance + type + time window)
- [ ] Public intake — anti-bot / human verification (CAPTCHA-equivalent)

### Triage & Assignment
- [ ] Approval workflow for assignment (manager review before contractor sees it)
- [ ] One request → multiple work orders (split)
- [ ] Multiple requests → one work order (already supported by current assignment model)
- [ ] Prime contractor + sub contractor model (one prime per DSA, override available)

### Status & Workflow
- [ ] Review proposed richer status domain from PO:
  - Report: New, Under Review, Escalated to CE&I for Field Verification, Postponed,
    Invalid Complaint, Advanced to Design, Advanced to Maintenance Work Order
  - Work Order: Maintenance Work Order Issued (Standard / Emergency / Immediate),
    In Progress, On Hold, Maintenance Completed, Work Order Closed, Canceled
- [ ] Required fields on status change (e.g., photos to close, invoices, field reports)
- [ ] Backwards transitions and skip-step transitions allowed
- [ ] Stamp date on every status change (server-side via trigger)

### SLAs
- [ ] Urgency-tier SLAs: Standard 7 days, Emergency 24 hrs, Immediate 2 hrs
- [ ] SLA breach indicators on dashboards + notifications

### Work Execution & Updates
- [ ] Standard field report template (Survey123)
- [ ] Required photos: prior, 25%, 50%, completion
- [ ] Pay-item / unit-price tracking on work orders
- [ ] Monthly invoice tracking against work order budget
- [ ] Partial-completion handling
- [ ] One WO spanning multiple sites
- [ ] CE&I inspector assignment and sign-off workflow

### Roles
- [ ] Add Designer (Consultant), CE&I (Consultant), Manager (DDG) roles to user-role model
- [ ] Contractor-scoped views (see assigned WOs only)
- [ ] Audit log for who-changed-what-when (server-side)

### Notifications
- [ ] Discuss + define triggers (new report, assignment, status change, overdue work)
- [ ] Recipient routing (contractor / manager / reporter)
- [ ] Delivery channels (email / SMS / in-app)

### Reporting
- [ ] Dashboard: open vs closed, SLA compliance, by type/location
- [ ] Spending per District Service Area vs Budget
- [ ] Real-time + scheduled (daily/weekly) report cadence

### Edge Cases
- [ ] Invalid report flagging with override capability
- [ ] Contractor reassignment workflow (prime defaulted, secondary fallback)
- [ ] WO archival to asset record on completion
- [ ] Legal/compliance review once public-facing scope is locked

---

## 🗺️ Suggested Phasing

| Phase | Focus | Why |
|---|---|---|
| **MVP (now)** | Epics 1, 2, 3, 4, 5 | Internal users can fully manage the request → WO → submit lifecycle |
| **V1.1** | Epic 6 (Dashboard + PDF) | Leadership visibility + contractor packets |
| **V1.2** | Epics 9 + 11 polish | Production-grade polish |
| **V2** | Epic 7 (Inspections) | Field workflow closes the loop |
| **V3** | Epic 8 (Contractors + Public) | External users — biggest security/architecture lift |
| **R&D** | Epic 10 (Drag-and-drop) | Whenever curiosity strikes |


- [ ] Add relationship classes: om_request ↔ om_maintenance_initiative, om_request ↔ om_capital_project
- [ ] Add proper `id` fields on MI / CP tables (currently using GlobalID as workaround)
- [ ] Replace MoveToInitiativeModal free-text input with dropdown sourced from MI/CP feature services
- [ ] Admin view for closed/moved requests (so users can find Moved-to-MI/CP records)