# Targeted Audit Change Log

Modified only the components/services required to satisfy the requested Calendar/List, Calling Scripts, callback, closer synchronization, and status consistency workflows.

Files changed:
- `src/App.tsx`
- `src/components/AppointmentDetailModal.tsx`
- `src/components/CalendarView.tsx`
- `src/components/CloserManagement.tsx`
- `src/components/QuickAddModal.tsx`
- `src/components/ScriptPanel.tsx`
- `src/components/Sidebar.tsx`
- `src/services/FirestoreService.ts`
- `src/types.ts`
- `src/types/types.ts`
- `src/utils/helpers.ts`
- `src/utils/timezone-utils.ts`

No legacy feature directories were deleted and no broad application rewrite was performed.

## 2026-09-02 — Timezone / Script Numbering / Closer Reliability Pass
- Added centralized US workspace timezone options for Eastern (EDT), Central (CDT), Mountain (MDT), and Pacific (PDT).
- Replaced fixed-offset appointment parsing with DST-aware IANA timezone conversion.
- Added per-user workspace timezone preference and placed its selector in the sticky Activities hero navigation.
- Added timezone editing to Appointment Detail and normalized legacy US timezone values.
- Made Quick Add, Smart Import, Transcript Studio, and CSV import use the workspace timezone when no timezone is supplied.
- Calling Script reorder now updates visible shortcut/key numbers to match the new position.
- Strengthened closer default/deactivation/deletion workflows so an active default is maintained and default changes synchronize reliably.
