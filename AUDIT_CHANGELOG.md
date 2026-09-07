# ScriptFlow Pro v2.8 — Activities / Callback / Status Audit

## Targeted changes
- Added Meetings dropdown controls matching the requested Activities UI: All / Initial / Follow-up and meeting status checkboxes.
- Added interactive Callbacks and Follow-ups dropdowns that show matching activity details and open the existing appointment detail workflow.
- Added a centralized `stage` field with stage options: New, Open, Meeting set, Not interested, Do not call, Invalid, Held.
- Added stage filtering to the shared Activities filters.
- Expanded shared status options with No Show and Quarantined while retaining all existing statuses.
- Added status-tag buttons and stage selector to Appointment Detail Modal.
- Added Lead Stage to Quick Add so new records participate in the same stage/filter model.
- Added automatic callback companion activity creation when a meeting has a callback reminder.
- Callback companions use deterministic IDs (`callback_<appointmentId>`) to prevent duplicates.
- Callback companion times are calculated from the meeting's selected US timezone using DST-aware IANA timezone conversion.
- Editing a meeting updates its pending callback companion; disabling the reminder removes the companion.
- Completing a callback marks both the callback activity Completed and the parent reminder as triggered.
- Deleting a meeting also deletes its generated callback companion.
- Callback completion now works from the callback list and appointment detail workflow without changing the meeting itself to Completed.
- Existing user-scoped Firestore synchronization and optimistic rollback behavior were preserved.

## No unnecessary restructuring
The existing React/Firebase/Express architecture remains unchanged. Only the affected type, configuration, service, Activities, Quick Add, Appointment Detail, and callback completion paths were updated.
