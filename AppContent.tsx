// Compatibility entry point. App.tsx is the single source of truth for the
// application shell and workspace lifecycle. Keeping this re-export prevents
// older imports from creating a second, divergent application implementation.
export { default, App as AppContent } from './App';
