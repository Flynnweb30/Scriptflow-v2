# ScriptFlow Pro v2.8 — Activities & Calling Scripts QA Report

## Scope
Targeted audit of Calendar/List Activities, Calling Scripts, Firestore synchronization, closer propagation, and cross-user workspace consistency. Existing architecture was preserved; changes were limited to the affected components/services and type definitions.

## Repaired workflows

### Activities / List View
- Activities is treated as the shared UI hub for scheduled meetings, callbacks, and follow-ups.
- Shared filters now include activity type, owner/closer, timezone, status, tag, and search.
- List presets: To-do, Overdue, Today, Tomorrow, This week, Next week, Custom.
- Optional completed-item inclusion.
- Activity type/subtype filtering support.
- Sortable Date/Time, Business, Contact, Status, and Owner/Closer columns.
- Direct actions: Call, Open contact/record, Open meeting/record, Reschedule, Mark callback done.
- Callback reassignment updates the existing appointment rather than creating a duplicate.
- Cancelled/No Show rescheduling reactivates the same record as Rescheduled.
- Overdue calculation is based on scheduled date and open status.

### Calendar View
- List/Calendar switch preserved.
- Month, Week, Day, and existing Kanban modes preserved.
- Day mode now renders the complete 00:00–24:00 timeline.
- Ctrl/Cmd + mouse wheel adjusts timeline zoom.
- Activity blocks use semantic status colors: upcoming blue, overdue red, completed green, no-show amber, cancelled grey.
- Overlapping timed activities are assigned side-by-side lanes; completed items occupy the completed/right half of the timeline while open work occupies the left half.
- Five or more activities at the exact same start time are grouped into a single clickable block.
- Untimed follow-ups/callback markers remain compact instead of occupying a full time block.
- Clicking an activity opens the existing appointment detail drawer, preserving the application's record workflow.

### Closer synchronization
- Closer state remains user-scoped through Firestore.
- Closer additions/updates are immediately reflected through the existing live subscription.
- Renaming a closer propagates the new closer name to existing appointments in the same user workspace.
- Large closer-renaming operations are chunked below Firestore's 500-write batch limit.
- Active/default closer selection remains centralized for Quick Add, Calendar, Smart Import, Transcript Studio, Bulk Actions, and Appointment Detail.

### Calling Scripts
- Script ordering remains deterministic using `order`, with legacy `keyNumber` fallback.
- Drag-and-drop reorder persists to Firestore.
- Move Up / Move Down controls persist through the same reorder path.
- Reorder failures restore the previous cached order.
- Script delete failures restore the previous cached state.
- Script Reset now actually restores the original default template instead of only incrementing the version.
- Copy now handles restricted/unsupported Clipboard API contexts with a legacy textarea fallback and error handling.
- Favorites/edit/reset/delete continue using the existing Firestore service.

### Cross-application consistency
- Selected appointment details are reconciled against live Firestore appointment updates so stale drawers do not remain after another workflow changes the record.
- Primary status mapping was corrected so `Rescheduled` and `Overdue` remain open/pending states while `Held` is completed.
- Existing optimistic Firestore writes retain rollback behavior on failure.
- User data remains scoped by authenticated Firebase UID through existing Firestore queries/rules.

## Verification performed
- All TS/TSX source files parsed successfully with the installed TypeScript parser.
- `server.js` passed Node syntax validation.
- `package.json` and `package-lock.json` parsed successfully.
- Vite is present only in `devDependencies` (duplicate dependency warning resolved).
- ZIP integrity check passed.
- `npm ci --dry-run --offline` completed successfully, confirming the lockfile dependency graph is coherent.

## Environment limitation
A full production `npm ci` could not complete because the execution environment does not have every package tarball cached and registry access timed out. Therefore a real `vite build` was not falsely reported as completed. Render should perform the final network-backed `npm ci && npm run build` during deployment.

## Deployment target
Recommended Render service: **Node Web Service**

- Build: `npm ci && npm run build`
- Start: `npm start`
- Node: `20.11.0`
- Root Directory: blank when project files are at repository root
