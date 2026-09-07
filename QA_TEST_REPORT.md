# ScriptFlow Pro v2.8 — Closer + US Timezone Audit

## Scope
Targeted repair and full source-level audit of Closer Management, Calling Scripts, Activities/Calendar/List integration, user-specific Firestore synchronization, and global US timezone presentation.

## Repairs
- Added a fixed, transparent, responsive top-center US timezone hero bar with live second-by-second clocks for EDT/CDT/MDT/PDT and an exact local clock.
- Reserved vertical workspace space so the fixed timezone bar does not cover the TopBar or content.
- Preserved dark/light theme compatibility for the timezone bar.
- Closer default selection now performs a fresh user-owned Firestore read before writes, reducing stale-cache/default races.
- Enforced exactly one active default closer when a default is selected, deactivated, or removed.
- Prevented inactive closers from being offered as Make Default actions.
- Editing an inactive closer cannot accidentally retain a default flag.
- Closer rename continues to synchronize appointment closer names using the existing batch workflow.
- Calling Script reorder persists both `order` and `keyNumber`, so visible shortcut numbers follow the new position.
- Existing per-user Firestore listeners and optimistic rollback behavior were preserved.

## Validation
- `node --check server.js`: PASS
- package.json JSON parse: PASS
- package-lock.json JSON parse: PASS
- Top-level Vite dependency duplication: PASS (Vite only in devDependencies)
- User-scoped Firestore query/write assertions: PASS
- Closer fresh-read/default logic assertions: PASS
- Calling Script order/number assertions: PASS
- Global timezone bar assertions: PASS
- US clock conversion sanity check for 2026-09-02T06:11:00Z:
  - EDT: 2:11:00 AM EDT
  - CDT: 1:11:00 AM CDT
  - MDT: 12:11:00 AM MDT
  - PDT: 11:11:00 PM PDT
- ZIP integrity: PASS

## Production build limitation
A full network-backed `npm ci` could not complete in the execution environment because the npm registry operation timed out. The package lock and source-level checks passed, but the final production build must be executed by the deployment environment (Render) with registry access.
