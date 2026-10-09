# Purple Dragon PowerTools v2.3.0 — Navigation & Quick Actions

Status: Unreleased. Windows visual acceptance and signed publication remain pending.

- Search PowerTools centers and existing Windows tool launchers with Ctrl+K.
- Navigate results with arrows, Home/End, and Enter, or select with the mouse.
- Pin/unpin selected tools with Alt+P or the palette button; dashboard pins persist across restarts (maximum 12).
- Reopen the eight most recently used tools from the dashboard; clear this list from the shortcut guide.
- Open keyboard help with F1. Ctrl+Shift+H opens Dashboard and Ctrl+Shift+Comma opens Settings outside text fields.
- Invalid saved IDs are removed; failed preference writes leave this session usable.
- Includes v2.2.1 Interface Cleanup.

The quick-access preference record stores only registered tool IDs locally. It does not store AI prompts, file paths, credentials, or Windows activity. Palette Windows entries open existing tools through the established bridge; they do not execute cleanup or change settings automatically. Existing update verification, signing, and confirmation controls remain in place.

Validation: syntax, navigation model, dialog focus, update verification, rollback, publisher-policy tests, and actual-page DOM smoke checks. Pixel layout, native Windows tool launching, high-DPI display scaling, installer/portable upgrade, and manual Windows acceptance still need verification before publication.
