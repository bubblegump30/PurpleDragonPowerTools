# Purple Dragon PowerTools v2.5.0 — Clear Status & Notifications

Status: Unreleased. Native Windows acceptance and signed publication remain pending.

- Core center reads show Loading, Ready, Unavailable, Unsupported, Administrator required or Refresh failed, with checked and last-success times.
- Failed reads offer retries through existing refresh functions. Retrying does not approve UAC prompts, execute cleanup, publish releases or perform system changes.
- Failed process/app refreshes retain last successful data and label the snapshot as stale.
- Notifications now have a bounded session history, severity, unread count, dismissal and history clearing.
- Quiet Mode suppresses routine in-app/Windows popups while errors remain visible. A separate switch controls routine in-app popups. Automation notification suppression is recorded; desktop events reach the session center when the renderer is connected.

Notification history and read-status details remain in memory for this session and are not exported or saved. Only boolean preferences persist in pt.notifications.v1 and notification-preferences.json. Existing release notification preferences remain independent. No configuration migration is required.

Validation: syntax, status classification, failed-read preservation, overlapping-read ordering, read-only retry catalog, preference validation, navigation/workspace/dialog/updater/publisher regressions and actual-page DOM fault-injection checks. Native Windows toast behavior, UAC states, high-DPI visuals, installer/portable builds and upgrade acceptance still need verification before publication.
