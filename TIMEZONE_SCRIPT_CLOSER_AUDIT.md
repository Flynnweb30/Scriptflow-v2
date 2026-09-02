# ScriptFlow Pro v2.8 — Timezone / Script / Closer Audit

## Scope
Targeted audit of the latest audited deployment package. Existing architecture was preserved; only the necessary UI/service/utilities were changed.

## Timezone verification
- Four US workspace booking zones are available: Eastern (EDT), Central (CDT), Mountain (MDT), Pacific (PDT).
- Appointment times are interpreted as wall-clock time in the selected US IANA zone, so daylight/standard transitions are date-aware.
- Legacy EST/CST/MST/PST/ET/CT/MT/PT values are normalized to their corresponding US region for consistent UI behavior.
- The selected workspace timezone is stored per authenticated user and is used as the default for Quick Add, Smart Import, Transcript Studio, and CSV imports when no timezone is supplied.
- Appointment editing includes a timezone selector and persists the selected timezone.
- Calendar timezone filtering normalizes legacy values so old records remain discoverable.

### Verified examples
| Local appointment | Zone | UTC result |
|---|---|---|
| 2026-09-02 10:00 AM | Eastern (EDT) | 2026-09-02 14:00 UTC |
| 2026-09-02 10:00 AM | Central (CDT) | 2026-09-02 15:00 UTC |
| 2026-09-02 10:00 AM | Mountain (MDT) | 2026-09-02 16:00 UTC |
| 2026-09-02 10:00 AM | Pacific (PDT) | 2026-09-02 17:00 UTC |
| 2026-01-15 10:00 AM | Eastern region | 2026-01-15 15:00 UTC |
| 2026-01-15 10:00 AM | Central region | 2026-01-15 16:00 UTC |

## Calling Scripts verification
- Script order remains persisted through Firestore `order`.
- Reordering also rewrites `keyNumber` for positions 1–9, so the visible shortcut number follows the script's new position.
- Sidebar numbering is derived from the persisted sorted position rather than stale script metadata.
- Drag/drop and explicit up/down controls use the same reorder operation.
- Reorder failure restores the previous local cache.

## Closer verification
- Closer defaults are centralized in Firestore.
- Only one active closer can be the default in the local state produced by the subscription.
- Setting a different closer as default clears the previous default in the same batch.
- Deactivating the default closer promotes another active closer when available.
- Deleting the default closer promotes another active closer when available.
- Renaming a closer updates appointments referencing the old closer name in the same Firestore batch.
- Quick Add derives its default closer from the live closer collection and refreshes when the default closer changes.

## Hero navigation
- Activities hero navigation is sticky while the Activities content scrolls.
- The workspace timezone selector is placed inside the hero navigation and uses the same shared timezone values.
- Responsive rules prevent the selector from colliding with controls on narrow screens.

## Verification status
- TypeScript/TSX syntax parse: PASS.
- Timezone conversion checks: PASS.
- Targeted source assertions: PASS.
- Full `npm ci`: BLOCKED in this sandbox because npm registry access is unavailable; an offline install reported a missing cached tarball (`yargs-parser`).
- Production `vite build`: therefore not executable in this sandbox. Render should perform the final network-backed `npm ci && npm run build`.
