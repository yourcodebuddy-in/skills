# Web, mobile, and desktop UI

- **States:** are loading, empty, partial, error, read-only, and success each handled where the user can see them?
- **Stale data:** can a slow older response overwrite a newer one? Can duplicated state, navigation, or remounting show the wrong truth?
- **Premature success:** does the UI close, redirect, or clear input before the operation has succeeded? Is the user's input kept on failure?
- **Repeat actions:** can a double tap or double submit run the action twice?
- **Lifecycle leaks:** are listeners, subscriptions, timers, and observers removed? Does a closure hold a screen or controller alive, such as a strong self capture in a repeating timer?
- **Threading:** is UI touched only from the UI thread, and is slow work kept off it?
- **Rendering cost:** is expensive work repeated on every render or frame? Does a lookup inside a list turn linear into quadratic at the real list size?
- **Identity:** do list keys come from stable identity, so items don't lose state on reorder?
- **Trust:** can user or server content inject markup or script? Are permission checks enforced on the server rather than only hidden in the UI? Are secrets shipped in the client?
- **Platform:** what happens across rotation, backgrounding, process death, offline use, permission denial, and older supported OS versions?
- **Accessibility:** can the changed workflow be used by keyboard and screen reader? Report this only when it blocks the workflow.
- **Sibling screens:** does similar existing UI handle something the new one misses?
