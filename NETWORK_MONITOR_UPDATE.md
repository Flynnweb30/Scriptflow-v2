# ScriptFlow Pro — Connection Monitor + Speed Test Update

## Implemented
- One centralized `networkMonitor` source of truth.
- 5-second lightweight heartbeat monitoring.
- Jitter-first signal scoring: 4/3/2/1/0 bars.
- Raw measured jitter is displayed unchanged; an internal EWMA is used only to stabilize the signal decision.
- Rolling packet-loss and stability calculations.
- Confirmed-loss handling: browser offline is immediate; online probe failures require 3 consecutive failed probes before forcing 0 bars.
- Reconnect counter counts confirmed loss -> recovery events only.
- Bandwidth testing is separate from heartbeat monitoring and runs no more often than once per 60 seconds.
- Download/upload throughput is calculated from bytes transferred divided by measured duration and shown in Mbps.
- Bandwidth tests are skipped/aborted during an active live-call state and while the document is hidden.
- Visibility/page lifecycle cleanup aborts requests and clears timers.
- Optional live-call integration hook: dispatch `scriptflow:live-call-state` with `{ detail: { active: true } }` or set `window.__SCRIPTFLOW_LIVE_CALL_ACTIVE__` before the monitor starts.
- `ConnectionIndicator` and `NetworkStatus` now point to the same `ConnectionStatus` implementation to prevent duplicate monitoring UIs.
- Speed Test is lazy-mounted only when opened and provides a Fast.com iframe with an external fallback.
- Server CSP allows Fast.com framing.

## Accuracy notes
The browser cannot reduce the physical network jitter of an ISP/Wi-Fi path. The implementation therefore does not falsify or alter the reported jitter. It only smooths the quality decision and defers bandwidth tests during live-call activity so monitoring itself has less impact on calls.

ScriptFlow does not currently own a WebRTC media session, so true RTP audio-loss statistics are not available. The UI explicitly shows Audio loss as N/A and uses measured packet loss + stability instead.

## Validation
- `node --check server.js`: PASS.
- `tsc` parse/type check of `src/services/NetworkMonitor.ts` with isolated DOM/ES libs: PASS.
- Component source parsing was checked with TypeScript; dependency-resolution errors are expected because npm packages were not available in the sandbox.
- npm install/build could not be completed because the npm registry request timed out in the execution environment.
- Verified no active duplicate `ConnectionIndicator` implementation remains; it re-exports `ConnectionStatus`.
- Verified Fast.com is included in the server `frame-src` CSP.
- Verified Speed Test is lazy-mounted from the `speedtest` tab.
