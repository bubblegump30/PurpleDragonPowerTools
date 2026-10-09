# Purple Dragon PowerTools v2.5.1 — Status Refresh Hotfix

- Stops telemetry and process status banners flashing Loading / Ready on every sample.
- Keeps the previous visible status during routine polling and refreshes unchanged timestamps at most every 30 seconds.
- Failures, changed status details, and recovery appear immediately. Live measurements keep their configured sampling frequency.

Validation: status regression tests, actual-page DOM fault-injection checks, syntax checks and release publisher policy tests. Native Windows visual acceptance remains unverified. Windows executables remain unsigned; release integrity uses SHA-256 and the signed release manifest.
