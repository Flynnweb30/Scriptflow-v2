# ScriptFlow Pro v2.8 — Activities & Calling Scripts QA Report

## Scope
Targeted audit of the existing React/Firebase application with emphasis on Activities (List/Calendar), Calling Scripts, per-user synchronization, persistence, responsive behavior, and deployment integrity. Existing architecture was preserved.

## Repairs implemented

### Calling Scripts
- Fixed the scripts data-shape mismatch between the Firestore array cache and the React keyed-record state. Optimistic save/reorder/delete operations now use the same normalization path as remote snapshots.
- Drag-and-drop reordering remains available in the sidebar and is persisted to Firestore through `order`.
- Move Up / Move Down controls remain available as a reliable responsive alternative to drag-and-drop.
- Reordering now updates shortcut key numbers 1–9 to match the displayed order, keeping mouse/touch/keyboard navigation aligned.
- Reorder controls are guarded against concurrent writes so rapid clicks do not race stale order snapshots.
- Script deletion now rolls back the local cache when the Firestore delete fails.
- New/edited scripts retain deterministic ordering.
- Reset now actually restores the original default template for built-in scripts instead of merely saving the current content.
- Copy now uses the Clipboard API with a browser fallback and reports failures.

### Activities / List View
- Activities is treated as the single UI hub for the existing appointment/activity records.
- Shared filters now include activity type, status, owner/closer, timezone, tag, and search.
- List presets: To-do, Overdue, Today, Tomorrow, This week, Next week, Custom.
- Optional Include Completed filter.
- Activity type filtering: Meetings, Callbacks, Follow-ups.
- Callback kind and follow-up type narrowing when applicable.
- Sortable list columns: Date/Time, Business, Contact, Type, Status, Owner/Closer.
- Direct action controls: call, open meeting/contact record, and callback reschedule/reassign management via the existing appointment detail workflow.
- Overdue records are visibly marked red and excluded from completed activity counts.
- List header now reports activities rather than leads.

### Activities / Calendar View
- Existing Month, Week, and Kanban views were preserved.
- Added a functional Day timeline view covering 00:00–24:00.
- Day timeline supports Ctrl/Cmd + wheel zoom plus explicit zoom controls.
- Timed overlapping activities are laid out in lanes instead of stacking.
- Five or more activities at the same exact time are grouped into a compact activity block.
- Follow-ups render as compact single-line markers.
- Meeting blocks use duration plus configurable grace-period fields when available, with a 30-minute default duration and 15-minute default grace period.
- Calendar status colors are normalized to the requested semantics: upcoming blue, overdue red, completed green, no-show amber, cancelled grey.
- Calendar activity popover includes start time, business/contact, type/status, and meeting closer/booker/quality/confirmation/website fields when those fields exist in the record.
- Popover Open action routes through the existing appointment detail workflow.
- Week view now starts Monday for consistency with List week presets.

### Per-user synchronization
- Activities and scripts continue to use the authenticated user's Firestore query boundary.
- Live closer subscriptions are still passed into Activities/Calendar.
- The existing closer rename synchronization remains atomic for related appointments.
- Sidebar Activities shows an overdue count and its count is clickable to open the List view filtered to overdue activities.
- Normal Activities navigation returns to the normal Calendar workspace rather than forcing the overdue filter.

### Deployment integrity
- Vite is present only in `devDependencies`.
- `render.yaml` remains a Node Web Service configuration and uses `npm ci && npm run build` followed by `npm start`.
- `DISABLE_HMR` and Firebase messaging sender ID values are quoted as strings for Render YAML consistency.

## Verification performed

- 57 TypeScript/TSX source files parsed successfully with the TypeScript transpiler; no TS/TSX syntax diagnostics.
- `server.js` passes Node syntax validation.
- `package.json` validates and contains no duplicate root Vite dependency.
- `package-lock.json` is lockfile v3 and has Vite only in the root devDependencies section.
- `render.yaml` parses successfully as YAML.
- ZIP integrity checks pass.

## Environment limitation

A full `npm ci` / production Vite build could not be completed in this sandbox because the npm registry dependency `yargs-parser@21.1.1` was not available in the local npm cache and the network install timed out. This is an environment/package-fetch limitation, not a source syntax failure. Render should perform the final network-backed `npm ci && npm run build` during deployment.

## Deployment recommendation

Use Render **Web Service / Node** with:

- Branch: `main`
- Root Directory: blank when `package.json` is at repository root
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Node Version: `20.11.0`
- Auto Deploy: Yes

Do not configure this version as a Render Static Site unless `server.js` is intentionally removed and the application architecture is changed.
