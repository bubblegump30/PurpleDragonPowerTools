# Purple Dragon PowerTools v2.1.0 — VPN Center Release Checklist

- [x] application package/UI version aligned to 2.1.0; minimal Electron runtime remains independently pinned
- [x] NordVPN and ExpressVPN provider IDs/actions enforced by a main-process allowlist
- [x] provider app, process, CLI, and active-adapter detection remains lazy
- [x] executable paths and Start-menu IDs excluded from renderer state and reports
- [x] provider credentials and account details are not read or stored
- [x] Quick Connect uses provider-approved installed command-line controls
- [x] Disconnect requires explicit user confirmation
- [x] ExpressVPN control uses a Windows UAC prompt as required by its CLI
- [x] official setup links available when a supported client is missing
- [x] AI Command Deck present with Direct, Router, and Council execution modes
- [x] six mission profiles present
- [x] Command Center session history is memory-only
- [x] Dragon Council state variables initialized before first render
- [x] System-Aware context controls inherited without bypassing cloud-context opt-in
- [x] review-first AI guard documented in UI
- [x] no AI provider discovery added to startup-critical path
- [x] JavaScript syntax validation passed
- [x] unique HTML IDs validated
- [x] preload invoke/main IPC handler sets validated
- [x] multi-drive used-byte/percentage derivation validated
- [x] ZIP integrity validated

NordVPN/ExpressVPN live detection and CLI behavior, Windows UAC, local-model runtime behavior, and live hardware/System-Aware context still require the normal Windows smoke test.
