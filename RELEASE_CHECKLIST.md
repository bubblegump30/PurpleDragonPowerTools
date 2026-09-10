# Purple Dragon PowerTools v2.0.1 — AI Command Center Release Checklist

- [x] application package/UI version aligned to 2.0.1; minimal Electron runtime remains independently pinned
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
- [x] ZIP integrity validated

Windows provider connectivity, local-model runtime behavior, and live hardware/System-Aware context still require the normal Windows smoke test.
