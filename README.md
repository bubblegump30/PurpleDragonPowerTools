# Purple Dragon PowerTools v2.0.1 — Purple Dragon AI Command Center

Purple Dragon PowerTools is a private Windows Electron command center by **Purple Dragon Foundation Ltd**. v2.0.1 unifies the project's AI capabilities into one review-first AI Command Center while preserving the existing system, hardware, privacy, security, automation, release, and diagnostics modules.

## v2.0.1 — AI Command Center

The **AI Command Deck** lets you compose one mission and choose how it should run:

- **Direct Model** — send to the currently selected local or configured cloud model.
- **Dragon Router** — use transparent local heuristics to choose an eligible model, then send the mission.
- **Dragon Council** — run the same mission across 2–4 selected models in parallel and compare their independent responses.

Mission profiles provide tailored system instructions for PC diagnostics, Windows troubleshooting, coding/development, defensive security review, and deep analysis. System-Aware AI can attach a redacted snapshot built from live telemetry plus already-loaded modules; cloud system context remains separately opt-in.

Command Center is **review-first**: AI can analyze and recommend, but AI responses do not directly execute Windows changes, process actions, cleanup, PowerShell, GitHub writes, or Feature Lab mutations.

## Privacy and startup behavior

- API credentials use Electron `safeStorage`; no plaintext credential fallback.
- Local custom AI endpoints remain loopback-only.
- Cloud providers are contacted only when explicitly configured and used.
- System-Aware context removes hostname, Windows username, IP/MAC addresses, file paths, API keys, and other sensitive fields defined by the context builder.
- Command Center mission history exists only in renderer memory for the current session; mission prompts are not persisted by the Command Deck.
- AI provider discovery remains lazy and does not run on the startup-critical path.

## Retained centers

Performance & Hardware, System PowerTools, Windows Feature Lab, Storage & Data Hub, Process & Apps, Network PowerTools, Privacy & App Trust Intelligence, Automation Engine, Change Journal + Undo, GitHub Release Center, Security Center, Reliability/Stable Release controls, AI Provider Hub, Dragon Router, Dragon Council, and System-Aware AI.

## Run from source

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\run.ps1
```

The launcher keeps the normal runtime minimal and pins Electron separately from packaging dependencies.
