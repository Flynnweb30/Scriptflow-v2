# ScriptFlow Pro v2.8 — Final Timezone / Calling Scripts / Closer Audit

## Scope
Final targeted audit of the latest ScriptFlow Pro deployment source. The original application structure was preserved; only the necessary components, service logic, and timezone utilities were changed.

## US timezone behavior
- Added a fixed, centered, transparent global timezone bar showing **EDT, CDT, MDT, and PDT**.
- The bar is available throughout the application, including the loading state, and is layered below modal dialogs so it does not obstruct dialogs/popovers.
- The selected workspace timezone is stored per authenticated user and is propagated through a small application event so open views can refresh immediately.
- Booking dates default to the selected US workspace date instead of the browser/Philippines date.
- Appointment wall-clock times are converted using the corresponding IANA zones:
  - EDT/EST -> America/New_York
  - CDT/CST -> America/Chicago
  - MDT/MST -> America/Denver
  - PDT/PST -> America/Los_Angeles
- DST is date-aware; the IANA zone determines whether the selected date is currently standard or daylight time.
- Legacy ET/CT/MT/PT and EST/CST/MST/PST values are normalized to the correct US region.
- Quick Add, Smart Import, Transcript Studio, CSV import, appointment editing, callbacks, and calendar filtering continue to use the shared timezone utilities.

## Calling Scripts
- Drag/drop and Up/Down controls still use the existing persistent Firestore `order` field.
- Visible shortcut numbers are derived from the complete persisted order, not the current search subset.
- Reordering positions 1–9 rewrites `keyNumber`.
- Moving a script beyond position 9 removes its old `keyNumber` field, preventing stale shortcut numbers from returning after refresh.
- UI reorder operations are serialized to prevent rapid-click race conditions.
- Failed writes restore the previous local cache.
- Keyboard 1–9 follows the same deterministic order.

## Closer management
- Added a dedicated `setDefaultCloser` service operation using a Firestore transaction so changing the default is atomic across the user's closer records.
- Only an active closer can become default.
- The previous default is cleared when another closer is selected.
- Deactivating or deleting the default promotes another active closer when one exists.
- Closer subscription normalization is also written back into the per-user cache, preventing an old default from briefly reappearing after reload.
- Closer rename synchronization continues updating appointments that reference the previous closer name.
- Quick Add, Appointment Detail, Bulk Actions, Smart Import, Calendar, Analytics, and Transcript Studio consume the same live closer state/default-selection helper.
- Closer action buttons are guarded against duplicate concurrent writes.

## Application consistency
- Activities remains the central Meetings / Callbacks / Follow-ups workspace.
- List and Calendar continue sharing the same appointments, filters, owners, statuses, timezone normalization, and real-time Firestore subscription.
- Firebase data remains user-scoped by authenticated UID.
- Existing Render Node Web Service architecture remains unchanged.

## Validation
- 60 TS/TSX files parsed successfully with the TypeScript parser.
- `server.js` syntax check passed.
- Local relative import resolution passed.
- Duplicate Vite dependency check passed: Vite exists only in `devDependencies`.
- Targeted feature assertions passed.
- DST/timezone conversion tests passed for Eastern, Central, Mountain, and Pacific regions, including winter standard-time behavior and daylight-transition dates.
- Full network-backed `npm ci` could not complete in this sandbox because registry access timed out. The existing local dependency tree is incomplete, so a production Vite build could not be honestly claimed here.

## Deployment
Render should use the existing Node Web Service configuration:

- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Node: `20.11.0`

No unnecessary architecture rewrite was performed.
