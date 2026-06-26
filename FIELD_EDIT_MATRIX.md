# Request Field Edit Matrix

Spec for `sde.om_request`: who can edit which fields, when, and under what conditions.

Companion to the [Role Model](# the #status-lifecycle.

---

## Legend

| Symbol | Meaning |
|---|---|
| `T1+` | Tier 1 Triager and above (Tier 2, Program Admin, Super Admin) |
| `T2+` | Tier 2 Triager and above (Program Admin, Super Admin) |
| `PA+` | Program Admin and above |
| `auto` | System-stamped on insert or status transition. Not editable in app by anyone (DB admin only, out-of-band) |
| `R` | Read-only in this status, for all roles that can see the field |
| `—` | Field hidden in app UI for this status |
| `(create)` | Editable only at intake/create, never after |

**Implied rules:**
- **Super Admin** has all `T2+` / `PA+` rights via the app; schema/SDE changes are out-of-band.
- **Contractor** sees attached requests as **R** only, and only when the request is in `Assigned to Work Order` and on a WO assigned to their org.
- **Field Inspector (CE&I)** is **R** on every field, every status.
- **General Public** and **Field Reporter** only act at create; never edit after submission.
- Fields not listed here are either system-managed (GlobalID, OBJECTID, editor tracking) or hidden/deprecated (see [Hidden Fields](#hidden--deprecated-fields)).

---

## Status Lifecycle

Status is **never directly editable** in the app. It is derived from workflow actions.

| Trigger event | Resulting `request_status` | Who triggers |
|---|---|---|
| Anonymous insert | `New` | Public form |
| Signed-in user insert | `Draft` | Field Reporter, T1+ |
| "Complete Triage" action | `Triaged` → *immediately client-side derived to next state* | T1+ |
| `requires_design = Yes` AND `design_status != Complete` | `In Design` | client derivation |
| `requires_design = Yes` AND `design_status = Complete` | `Ready for Work Order` | client derivation |
| `requires_design = No` | `Ready for Work Order` | client derivation |
| Request attached to WO | `Assigned to Work Order` | T1+ (via WO workflow) |
| Cancel action (requires reason) | `Canceled` (terminal) | T2+ |
| Move to MI / CP (requires reason) | `Closed` (terminal) | T2+ |

> **Note:** `Needs Correction` is in the domain but unused. Domain cleanup TBD.

> Status derivation logic lives client-side in `src/lib/requestStatus.ts` (TBD). The SQL trigger only stamps transition dates (`triaged_date`, `assigned_date`, `canceled_date`, `closed_date`) when it sees `request_status` change.

---

## Field Edit Matrix

### Classification

| Field | New / Draft | Triaged | In Design | Ready for WO | Assigned to WO | Closed / Canceled |
|---|---|---|---|---|---|---|
| `request_category` | T1+ RW | T1+ RW | T1+ RW | T1+ RW | T2+ RW | R |
| `request_subcategory` | T1+ RW | T1+ RW | T1+ RW | T1+ RW | T2+ RW | R |
| `request_title` | T1+ RW *(also set by submitter at create)* | T1+ RW | T1+ RW | T1+ RW | T2+ RW | R |
| `request_description` | T1+ RW *(also set by submitter at create)* | T1+ RW | T1+ RW | T1+ RW | T2+ RW | R |

> Public/anonymous submitter sets `request_title` and `request_description` at create only; triagers refine.

### Urgency

| Field | New (anonymous) | Draft (signed-in) | Triaged → onward | Closed / Canceled |
|---|---|---|---|---|
| `urgency` | T1+ RW (any value) | T2+ RW (modify signed-in submitter's choice); T1+ R | T2+ RW; T1+ R | R |

**Rules:**
- Anonymous submitter cannot set urgency at all. Default is `Requires Triage`.
- Signed-in submitter (Field Reporter, T1+) **can** set urgency at create. T1 cannot modify a signed-in user's choice — that requires T2+.
- After triage, only T2+ can escalate or de-escalate.

### Requestor info

| Field | At create | After create |
|---|---|---|
| `requestor_name` | Auto-populated for signed-in users (from Portal identity); submitter-entered for anonymous | R (locked, all roles) |
| `requestor_email` | Same as above | R (locked) |
| `requestor_phone` | Same as above | R (locked) |
| `requestor_organization` | Same as above | R (locked) |

> **Backdated intake exception:** T1+ creating a request inside the app on behalf of a phone/email caller needs to enter requestor info. This is the *only* editable path; once saved, locked.

> Anonymous form must include PII handling disclosure + email verification (see Backlog item TBD).

### Location

| Field | New / Draft | Triaged → onward | Closed / Canceled |
|---|---|---|---|
| `Shape` (geometry) | T1+ RW (via ArcGIS Maps SDK in-app) | T2+ RW | R |
| `original_latitude` | auto (from intake `Shape`) | auto | R |
| `original_longitude` | auto | auto | R |
| `corrected_latitude` | auto (derived from edited `Shape`) | auto | R |
| `corrected_longitude` | auto | auto | R |
| `location_corrected` | auto (`Yes` when corrected coords differ from original) | auto | R |
| `location_description` | T1+ RW *(submitter at create)* | T1+ RW | R |
| `route_name` | T1+ RW | T1+ RW | R |
| `route_id` | T1+ RW | T1+ RW | R |
| `milepost` | T1+ RW | T1+ RW | R |
| `parish` | T1+ RW | T1+ RW | R |
| `municipality` | T1+ RW | T1+ RW | R |

> Geometry editing happens directly via Maps SDK; `corrected_latitude/longitude` are derived from `Shape` after edit. Original lat/lon are stamped on insert and never change.

### Design

| Field | New / Draft | Triaged | In Design | Ready for WO | Assigned to WO | Closed / Canceled |
|---|---|---|---|---|---|---|
| `requires_design` | — | T2+ RW *(set at triage completion)* | R (locked once Triaged) | R | R | R |
| `design_status` | — | — | T2+ RW *(Designer Consultant role eventually)* | R | R | R |

**Domain for `design_status`:** `Not Started` / `In Progress` / `Complete`.
Default `Not Started` when `requires_design = Yes` is set.

### Program move (terminal close path)

| Field | Pre-close | At move action | Closed |
|---|---|---|---|
| `maintenance_initiative_globalid` | — | T2+ RW (selects from MI lookup) | R |
| `capital_project_globalid` | — | T2+ RW (selects from CP lookup) | R |
| `closed_reason` | — | T2+ RW (required) | R |

### Cancellation (terminal cancel path)

| Field | Pre-cancel | At cancel action | Canceled |
|---|---|---|---|
| `cancellation_reason` | — | T2+ RW (required) | R |

### Assignment (WO attach)

| Field | Pre-assignment | At WO attach | Assigned to WO | After unassign / WO delete |
|---|---|---|---|---|
| `request_assignment` | auto (`Unassigned` default) | auto (`Assigned to Work Order`) | R | auto (`Unassigned`) |
| `assigned_work_order_id` | auto (null) | auto (stamped) | R | auto (null) |
| `assigned_work_order_globalid` | auto (null) | auto (stamped) | R | auto (null) |
| `assignment_notes` | — | T1+ RW (optional at attach) | T1+ RW | T1+ RW |

> Reassigning between WOs follows the same rules: workflow action stamps the new WO IDs; `assignment_notes` remains editable for audit context.

### Notes

| Field | New / Draft | Triaged → Assigned to WO | Closed / Canceled |
|---|---|---|---|
| `public_notes` | submitter (create only) + T1+ RW | T1+ RW | T2+ RW (rare — for corrections) |
| `internal_notes` | T1+ RW | T1+ RW | T2+ RW |

**Visibility:**
- `public_notes`: visible to anonymous submitter (status-check page, TBD) and to Contractor when request is on their WO.
- `internal_notes`: hidden from Contractor and Public, always.

### Lifecycle dates (all auto-stamped)

| Field | Stamped when | Editable |
|---|---|---|
| `triaged_date` | `request_status` → `Triaged` | auto |
| `assigned_date` | `request_status` → `Assigned to Work Order` | auto |
| `canceled_date` | `request_status` → `Canceled` | auto |
| `closed_date` | `request_status` → `Closed` | auto |

> Stamped server-side via SQL trigger on `request_status` change.

### Identity / sequence (all auto-stamped on insert)

| Field | Stamped when | Editable |
|---|---|---|
| `request_id` | Insert (format: `DISTRICT-YYYY-R#####`) | auto |
| `request_sequence_year` | Insert | auto |
| `request_sequence_number` | Insert | auto |

> Request ID does **not** change when location is corrected or request is moved between programs. *(Future refinement: placeholder `PUBLICREQ-YYYY-R#####` scheme for anonymous intake before district is confirmed — parked.)*

### Source / submission metadata

| Field | At create | After create |
|---|---|---|
| `source` | Stamped by entry mode (Survey123 / Phone / Email / Internal / Other) | R (DB admin only, out-of-band) |
| `submission_type` | Stamped by entry mode (General Public / Field Crew / Desktop) | R (DB admin only, out-of-band) |

### Soft delete

| Field | Editable by | When |
|---|---|---|
| `deleted` | PA+ only (via admin action) | Any status |
| `deleted_date` | auto (stamped by soft-delete action) | — |
| `deleted_by` | auto (stamped by soft-delete action) | — |

> Soft-deleted records (`deleted = Yes`) are hidden from non-admin users via filter. No hard deletes anywhere in the system.

---

## Hidden / Deprecated Fields

These remain in the feature service but are **hidden from all app UI**. Do not surface in forms, detail panels, or list views.

| Field | Reason |
|---|---|
| `district` | Deprecating — derived from location, not a stored attribute |
| `priority_score` | Reserved for future automation; no current use |
| `assigned_to_email` | Assignment is via WO, not to individuals |
| `assigned_to_name` | Same |
| `assigned_team` | Same |
| `due_date` | Requests don't carry due dates; SLAs derived from urgency |
| `submitted_date` | Redundant with `created_date` |
| `intake_type` | Cancellation flow handled outside this attribute |

---

## System-Managed Fields (no UI surface needed)

| Field | Managed by |
|---|---|
| `GlobalID` | Service |
| `OBJECTID` | Service |
| `created_user` | ArcGIS editor tracking |
| `created_date` | ArcGIS editor tracking |
| `last_edited_user` | ArcGIS editor tracking |
| `last_edited_date` | ArcGIS editor tracking |

---

## Open items captured during this spec

- [ ] Public form: PII handling disclosure + email verification
- [ ] Public form: ability to email anonymous submitter with status updates / phone-call expectations
- [ ] In-app geometry editing via ArcGIS Maps SDK (spike)
- [ ] `PUBLICREQ-YYYY-R#####` placeholder ID scheme for pre-district-confirmed anonymous intake (refinement)
- [ ] Drop `Needs Correction` from `om_request_status` domain
- [ ] Add `dom_om_design_status` domain (`Not Started` / `In Progress` / `Complete`)
- [ ] Implement `src/lib/requestStatus.ts` for client-side status derivation
- [ ] Cancellation intake flow (the `intake_type = Cancellation` path) — design TBD
