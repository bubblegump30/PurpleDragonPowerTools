# Purple Dragon PowerTools v2.1.0 — VPN Center

Purple Dragon PowerTools is a private Windows Electron command center by **Purple Dragon Foundation Ltd**. v2.1.0 adds a guarded VPN Center for NordVPN and ExpressVPN while preserving the AI Command Center, accurate multi-drive storage accounting, system, hardware, privacy, security, automation, release, and diagnostics modules.

## v2.1.0 — NordVPN + ExpressVPN Center

- Detects installed NordVPN and ExpressVPN Windows clients only when Network PowerTools opens.
- Shows installed, running, provider CLI, and active VPN-adapter state.
- Opens an installed provider client or the provider's official setup page.
- Offers Quick Connect through the provider's own supported CLI when detected.
- Confirms every Disconnect request and warns that the public route or kill switch may change.
- Requests Windows administrator approval for ExpressVPN command-line connection control, as required by the provider.
- Stores no VPN username, password, activation code, server list, or provider token.
- Keeps discovered executable paths and Start-menu IDs inside Electron's main process.

Connection state is derived from local Windows process and adapter inventory. If a provider changes its adapter naming or does not expose its CLI, open the official client for the authoritative connection state and controls.

## Retained — AI Command Center

The **AI Command Deck** lets you compose one mission and choose how it should run:

- **Direct Model** — send to the currently selected local or configured cloud model.
- **Dragon Router** — use transparent local heuristics to choose an eligible model, then send the mission.
- **Dragon Council** — run the same mission across 2–4 selected models in parallel and compare their independent responses.

Mission profiles provide tailored system instructions for PC diagnostics, Windows troubleshooting, coding/development, defensive security review, and deep analysis. System-Aware AI can attach a redacted snapshot built from live telemetry plus already-loaded modules; cloud system context remains separately opt-in.

Command Center is **review-first**: AI can analyze and recommend, but AI responses do not directly execute Windows changes, process actions, cleanup, PowerShell, GitHub writes, or Feature Lab mutations.

## v2.0.3 — Multi-Drive Storage Usage Hotfix
Storage & Data Hub retains the v2.0.2 multi-drive enumerator and now derives used bytes and usage percentage from authoritative capacity/free-space values. This fixes drives incorrectly appearing as `0% used · 0 B` while free space was correct, including multi-terabyte HDD/SSD/USB volumes. Network shares and optical drives remain excluded from local capacity totals.

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
