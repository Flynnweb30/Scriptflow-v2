# ScriptFlow Pro — Activities / Callback / Status Audit

## Scope
Targeted audit of Activities List/Calendar, Meeting/Callback/Follow-up filters, callback reminder workflow, status/tag synchronization, Appointment Detail Modal, and shared Firestore appointment persistence.

## Implemented
- Meeting dropdown with All / Initial / Follow-up and status checkboxes.
- Held and Completed are treated as one completed status group for filtering/counting.
- All Statuses control is synchronized with the same status filter state used by List and Calendar.
- All configured appointment tags are available to the shared tag filter.
- Appointment Detail Modal now supports all configured status tags.
- Meeting reminders create a deterministic linked callback record (`<meetingId>__callback`) in the same user workspace.
- Callback records remain visible until marked Completed; completed callbacks are excluded from the default List To-do view and render green in Calendar.
- Parent meeting edits synchronize callback contact, closer, owner, timezone, and due instant.
- Removing a meeting reminder removes its linked callback; deleting a meeting removes its linked callback.
- User ownership is preserved on both parent and callback records.

## Verification
- Static source assertions: PASS
- Server JavaScript syntax: PASS
- US timezone Intl sanity test: PASS
- No duplicate Firebase initialization detected: PASS
- Appointment callback link fields present in both type definitions: PASS
- Held/Completed grouped filtering: PASS
- Generic tag filtering: PASS
- Callback atomic batch persistence path: PASS

## Environment limitation
A full network-backed `npm ci` / production Vite build could not be completed in this sandbox because package installation timed out. Render should run the final `npm ci && npm run build` using its network-enabled build environment.
