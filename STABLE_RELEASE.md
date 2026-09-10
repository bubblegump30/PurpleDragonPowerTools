# Purple Dragon PowerTools v2.0.1 — Purple Dragon AI Command Center

v2.0.1 is the major AI-workspace milestone. The new AI Command Deck composes Direct Model, Dragon Router, Dragon Council, and System-Aware AI without adding an autonomous system-action path. Existing Windows mutation paths remain guarded and user-initiated. Provider discovery remains lazy.

## Release invariants

- Package/runtime version must report 2.0.1.
- Electron remains pinned at 44.2.0.
- Command Center does not contact AI providers during application startup.
- Command Center prompts are not persisted to disk by the mission history.
- Cloud system context remains separately opt-in.
- AI responses cannot directly invoke Windows/PowerTools mutation IPCs.
- Existing Change Journal, GitHub, Feature Lab, Privacy & App Trust, Security, Network, Storage, Process, and Reliability safeguards remain intact.
