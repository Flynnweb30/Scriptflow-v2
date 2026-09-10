# ScriptFlow Pro — Network Connection Indicator Audit

## Changes
- Added a centralized `NetworkMonitor` singleton with one subscriber-based monitoring loop.
- Added `ConnectionIndicator` to the top of Tools & Settings in the existing Sidebar.
- Added actual same-origin ping, download, and upload endpoints to `server.js`.
- Signal bars start at 4 only while the browser is online and metrics are being established; subsequent levels are derived from measured RTT, jitter, packet loss, and measured throughput.
- Offline events immediately show 0 red bars.
- Reconnects are tracked from page-open time from offline recovery and failed-probe recovery.
- Bandwidth tests are lightweight: 256 KB download every 60 seconds and 128 KB upload every 120 seconds, with one delayed initial measurement for each direction.
- No browser connection type or estimated downlink is used for throughput values.
- Hover/focus panel reports RTT, download, upload, stability, jitter, packet loss, live-call network audio-loss proxy, reconnects, and bandwidth-test state.

## Affected files
- `src/components/Sidebar.tsx`
- `src/components/ConnectionIndicator.tsx`
- `src/services/NetworkMonitor.ts`
- `src/index.css`
- `server.js`

## Validation
- Node server syntax: PASS
- TypeScript/TSX transpile syntax for all affected files: PASS
- Static source assertions for all three network endpoints and measured throughput: PASS
- No new npm dependencies
- Existing application structure preserved

## Important runtime note
The download/upload throughput figures are measured application-level HTTP throughput between the browser and the deployed ScriptFlow server. Packet loss and jitter are application-level probe metrics. If a live calling provider exposes separate WebRTC media statistics, those provider-specific audio stats should be integrated there rather than inferred from browser network state. The current app has no RTCPeerConnection/WebRTC media session to read, so the displayed live-call audio-loss value uses the measured packet-loss network metric and is labeled as such in the implementation.

A full production `npm ci && npm run build` could not be executed in this sandbox because the project's local npm dependencies are not installed and registry access is unavailable. Render should run the final network-backed build during deployment.
