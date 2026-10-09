# Purple Dragon PowerTools v2.4.0 — Workspace Memory

Status: Unreleased. Native Windows/high-DPI acceptance and signed publication are pending.

- Reopen the last-used PowerTools center.
- Restore supported search/category/state filters, process sort order (default/name/CPU/memory), and app sort order (default/name/publisher).
- Restore window size, position, and maximized state within the available display work area; recover when monitors are removed or display metrics change.
- Reset workspace from Settings with confirmation, returning to Dashboard and default window/filter/sort settings while retaining pins, recents, credentials and other settings.

The additive local preference key pt.workspace.v1 stores allowlisted filter text (maximum 200 characters), options and center IDs. Search text may include identifying details you enter. It remains local and is not attached to AI context or exports. Prompts and credential fields are excluded. Existing window-state.json is validated on read; no migration is required.

Validation: syntax, workspace preference/geometry/sort tests, actual-page restart/reset DOM checks, navigation/dialog regressions, updater/transaction/publisher policy checks. DOM checks do not verify pixel layout or native monitor behavior. Before publication, test Windows monitor removal, 125%/150% scaling, maximized restoration, native reset, and Setup/Portable installation and upgrade.
