# QA Test Report

## Static/source validation
- `package.json` parsed successfully.
- `package-lock.json` is present and unchanged by this pass.
- TypeScript parser validation was executed with the globally available `tsc`.
- No syntax/parser errors were reported in the modified source. Full type checking could not resolve external modules because npm dependency installation is unavailable in the execution environment.
- `server.js` syntax remains valid.

## Feature assertions
- Meetings button exposes Initial / Follow-up and meeting status filtering.
- Callbacks button exposes matching callback records and opens the existing detail modal.
- Follow-ups button exposes matching follow-up records and opens the existing detail modal.
- Shared All Statuses filter remains available.
- Stage filter is centralized and uses the same appointment dataset.
- Appointment Detail and Quick Add use the same stage/status options.
- Meeting + callback reminder creates one deterministic callback companion.
- Editing the meeting resynchronizes the pending callback companion.
- Completing the callback updates the callback to Completed and the parent reminder to triggered.
- Completed callbacks are excluded by the existing List View completed-item logic unless Include completed is enabled.
- Deleting a meeting removes its generated callback companion.
- Callback completion no longer changes the parent meeting status.

## Timezone sanity test
For `2026-09-07T06:33:00Z`, DST-aware US zones resolve to:
- EDT: 2:33 AM
- CDT: 1:33 AM
- MDT: 12:33 AM
- PDT: 11:33 PM (previous calendar date)

This confirms the application must use IANA zones rather than fixed offsets.

## Deployment note
A full `npm ci` / production build could not be completed because the npm registry was not reachable from this environment. Render should run `npm ci && npm run build` in its network-enabled build environment.
