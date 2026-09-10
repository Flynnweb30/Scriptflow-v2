# ScriptFlow Pro — Network Indicator + Speed Test Update

Complete affected-file replacements:
- src/services/NetworkMonitor.ts
- src/components/ConnectionStatus.tsx
- src/components/NetworkStatus.tsx
- src/components/SpeedTest.tsx
- src/components/Sidebar.tsx
- src/App.tsx
- src/index.css

The monitor is centralized and starts at 4 bars when the browser is online, then refines after the first valid measurement. It measures lightweight RTT/packet loss every ~5 seconds while visible and actual download/upload throughput about every 60 seconds. Throughput tests are paused while hidden and aborted on lifecycle changes. Browser online/offline events immediately drive 0-bar/lost or recovery states. Bandwidth failures report Unavailable and never force a connection-lost state.

The sidebar now contains the connection indicator and a Speed Test tab under Tools & Settings. Fast.com is lazy-loaded only when the Speed Test tab is opened, with an external fallback.

Validation: TypeScript/TSX parser validation passed for all affected files; static feature assertions passed. A full npm production build was not claimed because registry/package installation is environment-dependent.
