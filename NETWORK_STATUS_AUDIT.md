# ScriptFlow Pro — Network Status Audit

## Changes
- Added a centralized `NetworkMonitor` singleton used by the sidebar network status UI.
- Added live signal bars with online/offline state.
- Hover/focus/click details show round-trip latency, browser-reported bandwidth estimate, live connectivity loss estimate, jitter, reconnect count, and sample count.
- Reconnects are tracked only after the monitor observes a connection loss and then recovers.
- Heartbeats use the existing same-origin `/favicon.svg` asset with cache-busting and `cache: no-store`; no new backend endpoint or dependency is required.
- Renamed the application's global stylesheet from `src/index.css` to `src/style.min.css` and updated `src/main.tsx` accordingly. No separate `style.css` existed in the audited source.
- No package dependencies were added.

## Measurement notes
- Round-trip latency is measured from the browser to the deployed application's same-origin static asset.
- Bandwidth uses the browser's Network Information API `downlink` estimate when available. Browsers that do not expose it show `—` rather than a fabricated value.
- Live internet loss is an application-level heartbeat failure rate over the most recent 20 samples; it is not raw ISP/router packet capture.
- Jitter is the average absolute change between consecutive successful round-trip samples over the recent sample window.
- Reconnects are counted after an observed outage recovers, including browser online/offline transitions.

## Validation
- TypeScript/TSX transpile syntax checks passed for all modified TS/TSX files.
- `server.js` syntax check passed.
- Stylesheet import and rename checks passed.
- No npm dependency changes were introduced.
- A complete production build could not be executed because the local dependency installation is incomplete and npm registry access timed out in this environment. Render should perform the final `npm ci && npm run build`.
