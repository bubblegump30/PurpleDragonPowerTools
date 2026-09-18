# Changelog

## v2.2.0 — Update & Release Center 2.0 (In development)

- Added a dedicated Update & Release Center 2.0 above the existing GitHub publishing workspace.
- Added public, token-free checks against the official `bubblegump30/PurpleDragonPowerTools` GitHub releases feed.
- Added Stable and Preview release channels plus Manual, Startup, 6-hour, 12-hour, Daily, and Weekly check policies.
- Added persistent local update settings with atomic writes under Electron user data.
- Added release-history display and update-availability detection using semantic-version comparison.
- Added release trust-material discovery for manifests, SHA-256/checksum assets, and detached signature assets.
- Added build-origin display for packaged versus source/development builds.
- Kept automatic download and installation disabled while the verification/download/rollback pipeline is still being implemented.
- Preserved the existing GitHub repository browser, source commit workflow, release notes generator, and release publisher.



## v2.1.0 — Stable Release

### Stable promotion
- Promoted the v2.1.0 release-candidate line to the first Stable public release.
- Updated application/runtime UI from Release Candidate / Public Release Readiness to Stable Release.
- Added final Stable release notes and a dedicated Stable Git-tag signing guide.
- Added a guarded Stable publisher that requires a GitHub-recognized SSH signature on the annotated `v2.1.0` tag before publishing.
- Stable publisher removes the remote tag and aborts if GitHub does not report the tag signature as verified.
- Kept Windows Authenticode/code-signing status separate from Git tag verification; Windows binaries may remain unsigned until a certificate is available.
- Retired the completed one-shot `v2.1.0-rc.1` publisher after successful prerelease publication.
- The public `v2.1.0-rc.1` release remains available as the release-candidate record.

## v2.1.0 — Public Release Readiness + NordVPN / ExpressVPN Center

### Public release readiness
- Added a dedicated public-release branch, release gate, SECURITY.md, issue templates, pull-request template, and repository hygiene rules.
- Hardened the Electron renderer by denying renderer-created windows and navigation away from the bundled local UI.
- Added diagnostic/support-export redaction for credentials and local identifying data, and reduced detailed process/application/activity data in exported support reports.
- Added Windows CI validation, clean-run dependency lock generation, Git-history credential-pattern scanning, NSIS + portable packaging, and SHA-256 checksum generation.
- Replaced private-development/stable labels with explicit Release Candidate / Public Release Readiness labeling for v2.1.0.
- Added prerelease notes and unsigned-build/code-signing documentation.

### Added
- Added a VPN Center inside Network PowerTools for NordVPN and ExpressVPN.
- Added lazy local detection of provider Start-menu entries, installed executables, running processes, command-line controls, and active provider adapters.
- Added installed, running, CLI-ready, and connected status cards.
- Added Open App and official provider setup actions.
- Added provider-approved Quick Connect and Disconnect controls when a compatible CLI is detected.
- Added an explicit confirmation before every VPN disconnect request.
- Added ExpressVPN UAC elevation support for its administrator-required Windows CLI controls.
- Added VPN Center state to local JSON reports only after the center has been opened; executable paths, Start-menu IDs, credentials, and public IP information are excluded.
- Added VPN-aware PowerTools Assistant responses.

### Privacy, safety, and performance
- VPN credentials stay entirely inside the official NordVPN or ExpressVPN client.
- Provider and action values are enforced by a fixed main-process allowlist.
- Commands run with `execFile` or a fixed elevated `Start-Process` path; no arbitrary renderer command or argument is accepted.
- VPN inventory is lazy-loaded and cached, so v2.1.0 adds no startup-critical scan.
- Disconnect is audit-recorded but intentionally not auto-undoable because reconnect behavior and server selection belong to the provider client.

## v2.0.3 — Storage Usage Calculation Hotfix
- Fixed Drive Center cards incorrectly showing `0% used · 0 B` while free-space values were correct.
- Replaced PowerShell `Math.Max` used-byte calculation with explicit Double subtraction/clamping for large-capacity drives.
- Added a renderer-independent main-process safeguard that always derives used bytes and usage percentage from authoritative capacity and free-space values.
- Retained v2.0.2 multi-drive HDD/SSD/USB discovery, media classification, health, temperature, and lazy-loading behavior.

## v2.0.2 — Multi-Drive Storage Detection Hotfix
- Rebuilt Storage & Data Hub drive enumeration around Win32_LogicalDisk so secondary fixed drives and removable USB volumes are discovered even when the modern Storage provider exposes only the system volume.
- Added HDD / SSD / USB classification using PhysicalDisk, Disk, CIM association, bus/interface, model, and spindle hints.
- Added removable-drive and external USB awareness without treating network or optical drives as local storage.
- Drive Center now summarizes detected SSD, HDD, and USB volumes and shows transport/media details per drive.
- Kept drive inventory lazy-loaded; no new storage scan runs during PowerTools startup.

## v2.0.1 — GitHub Empty Repository Upload Hotfix

- Fixed `GitHub HTTP 409` when committing the first files to a newly created empty repository.
- GitHub Release Center now detects repositories with no branches/commits and initializes the default branch automatically.
- Empty-repository detail loading now tolerates GitHub's 409 response from the commits endpoint instead of failing the whole workspace.
- Existing repositories still use the non-force, atomic Git Data commit path.
- Improved GitHub UI messaging so an empty repository is clearly identified before the first upload.
- Added a clearer HTTP 409 diagnostic if GitHub reports a different repository conflict.

## v2.0.0 — Purple Dragon AI Command Center
- Rebuilt the AI workspace around a unified mission-oriented AI Command Deck.
- Added Direct Model, Dragon Router, and Dragon Council execution modes in one composer.
- Added mission profiles for General Assistant, PC Diagnostics, Windows Troubleshooting, Coding / Development, Security Review, and Deep Analysis.
- Added quick mission starters and Ctrl+Enter execution.
- Added live mission status for execution mode, selected target, System-Aware context mode, and cloud path.
- Added a unified mission output console and session-only mission history; prompts are not persisted by Command Center.
- Preserved independent cloud-provider and cloud-system-context controls.
- Added an explicit review-first guard: AI responses cannot directly execute Feature Lab changes, PowerShell, process actions, cleanup, GitHub writes, or other system mutations.
- Fixed Dragon Council state initialization so opening the AI workspace cannot reference undeclared Council state.
- Preserved AI Provider Hub, System-Aware AI, Dragon Router, Dragon Council, Privacy & App Trust Intelligence, Change Journal + Undo, GitHub Release Center, Feature Lab, and fast boot.

## v1.9.0 — Dragon Council
- Added Dragon Council multi-model comparison to Model Center.
- Compare 2–4 discovered local/configured cloud models with the same prompt in parallel.
- Added explicit cloud-member opt-in, separate from System-Aware AI cloud-context opt-in.
- Added side-by-side response cards with provider, scope, latency, response length, and context status.
- Added a local lexical agreement heuristic with explicit non-correctness disclaimer.
- Added recommended member selection and ability to promote a Council response into the AI Playground.
- No extra AI judge/ranking request is made by Council orchestration.
- Retains Privacy & App Trust Intelligence, Change Journal + Undo, GitHub Release Center, Feature Lab, Dragon Router, and Foundation branding.


## v1.8.0 — Privacy & App Trust Intelligence

- Added local App Trust Scanner with SHA-256 and Windows Authenticode inspection.
- Added explainable higher-confidence/review/warning heuristics; no malware claims from signature state alone.
- Added installed-app publisher coverage with individual on-demand trust inspection.
- Added read-only SmartScreen and Smart App Control status.
- Added explicit VirusTotal SHA-256 lookup shortcut without file upload.
- Kept trust scans, inventory, and Windows reputation checks lazy and off the startup path.
- Kept App Trust data out of report export and System-Aware AI context.
- Retained Change Journal + Undo, GitHub Release Center, Foundation branding, and all previous modules.

## v1.7.0 — Change Journal + Undo
- Added a dedicated local Change Journal page with search, category/state filters, and audit history.
- Added guarded one-step Undo for captured reversible Windows Feature Lab changes, performance power-profile changes, Automation rule create/edit/toggle/delete operations, and Automation Engine pause/enable state.
- Every undo requires a native confirmation and replays only a fixed allowlisted inverse operation; no arbitrary command rollback is generated.
- GitHub source commits and release publishing are recorded as audit-only entries and are never automatically reverted.
- Journal data is local-only, capped at 250 entries, and excluded from System-Aware AI and exported reports.
- Change Journal does not run scans or network requests at startup; it loads only when opened.
- Retains v1.6.6 dashboard layout fixes, Foundation branding, GitHub Release Center, Privacy Intelligence, System-Aware AI, Windows Feature Lab, Dragon Router, and fast boot.

## v1.6.6 — Dashboard Layout Hotfix
- Fixed the sidebar/footer being clipped at the bottom of shorter or maximized windows.
- Added independent bounded scrolling for the sidebar and main workspace.
- Added CSS Grid shrink constraints (`min-height: 0`) so child content cannot force the custom-framed workspace beyond the viewport.
- Added short-height responsive compaction for navigation, system status, and Foundation branding.
- Added a high-DPI/minimum-height fallback that hides only the decorative mini health ring before clipping can occur.
- Added stable scrollbar gutters and extra bottom content clearance.
- Retained v1.6.5 Settings typography, v1.6.4 Foundation branding, GitHub Release Center, Privacy Intelligence, System-Aware AI, Feature Lab, Dragon Router, and all existing guarded behavior.

## v1.6.5 — Settings Typography Hotfix
- Increased Settings card titles and body/helper text for easier reading.
- Improved line height, spacing, wrapping, and contrast in Command Center Settings.
- Increased Reliability Center and Stable Release metric/check text sizes.
- Replaced the dense About release-note sentence with a readable summary and bullet list.
- Scoped readability changes to Settings; no system, network, AI, GitHub, Privacy, or automation behavior changed.
- Retained the v1.6.4 Foundation website banner and all existing modules.

## v1.6.4 — Foundation Banner Refresh
- Replaced the previous Settings promotional artwork with the new supplied **2048 × 682** Purple Dragon Foundation Ltd website banner.
- Banner now fills the brand card at its native wide composition with no cropping.
- Removed the now-redundant brand caption below the image so the website artwork stands on its own.
- Retained lazy loading for the large banner, the standalone About logo, the compact titlebar mark, and the Windows application icon.
- Retained GitHub Release Center and all v1.6.3 functionality.

## v1.6.3 — Foundation Banner Layout Hotfix
- Fixed the Settings brand showcase cropping the official Purple Dragon Foundation Ltd banner.
- The complete 16:9 banner is now shown with its original composition preserved instead of `object-fit: cover`.
- Removed the duplicate text overlay that obscured the artwork and replaced it with a clean caption below the image.
- Added responsive brand-card spacing for wide, tablet, and compact layouts.

# Changelog

## v1.6.3 — Purple Dragon Foundation Brand Refresh

- Establishes **Purple Dragon Foundation Ltd** as the official creator/publisher identity across PowerTools.
- Replaces `Created by KyleAustin85` with `Created by Purple Dragon Foundation Ltd`.
- Integrates the supplied Purple Dragon Foundation Ltd logo and promotional banner into the application UI.
- Updates the titlebar brand subtitle and Settings/About branding while preserving the existing private local Admin profile.
- Keeps the historical Electron app ID unchanged so installed-build upgrade identity remains compatible.
- Retains GitHub Release Center, Privacy Intelligence, System-Aware AI, Windows Feature Lab, Dragon Router, and all existing guarded tools.

# Purple Dragon PowerTools v1.6.1 — Privacy Layout Hotfix

- Fixed the Privacy Intelligence bottom layout on wide displays.
- Privacy Checklist now spans the full content width instead of leaving a large unused area to its right.
- Converted checklist rows into compact responsive cards: five across on wide displays, two across on medium displays, and one column on narrow displays.
- No Privacy Intelligence scanning, storage, or network behavior changed.
- GitHub Release Center and all v1.6.0 functionality remain intact.

# Purple Dragon PowerTools v1.6.0 — GitHub Release Center

- Added GitHub Release Center under Integrations.
- Added encrypted fine-grained PAT storage using Electron safeStorage.
- Added GitHub account validation and lazy repository discovery.
- Added repository browser, branches, recent commits, recent releases, private/public/archived state, and access summary.
- Added selected-file and selected-folder source upload with one atomic Git Data API commit and native confirmation.
- Added explicit source size/file-count limits and default exclusions for dependency/build folders.
- Added GitHub Release publishing with tags, notes, draft/pre-release flags, selected assets, optional existing-release updates, and explicit same-name asset replacement.
- Added GitHub-generated release notes support.
- Added fixed GitHub host allowlisting and no-background-write guarantees.
- Retained v1.5.3 Privacy Intelligence, v1.5.2 IP Geolocation, v1.5.1 kbps display, System-Aware AI, Dragon Router, Windows Feature Lab, Security Center, Automation Engine, and fast boot.

# Purple Dragon PowerTools v1.5.3 — Privacy Intelligence

- Added a dedicated Privacy Intelligence page for self-auditing owned/authorized public identifiers and local files.
- Added manual username profile shortcuts for GitHub, Reddit, YouTube, TikTok, and Instagram; no scraping or automatic account aggregation.
- Added on-demand domain DNS inspection for A, AAAA, MX, NS, and TXT records via the system resolver.
- Added a local metadata inspector that flags common GPS, EXIF, XMP, author, comment, and copyright signals without returning the full file path to the renderer.
- Added manual email-exposure workflow that validates locally and opens Have I Been Pwned without inserting the email into the external URL.
- Added a session-only privacy risk heuristic based on metadata findings.
- Added explicit self-audit boundaries: no home-address, phone, family, password, precise private-location, or hidden-record discovery.
- Privacy identifiers, DNS query values, file names/paths, and metadata findings are excluded from PowerTools reports and AI system context.
- Retains v1.5.2 IP Geolocation and kbps display changes plus System-Aware AI, Feature Lab, Dragon Router, and fast boot.

---

# Purple Dragon PowerTools v1.5.2 — IP Geolocation

- Added optional Geo IPify Country + City lookup to Network PowerTools.
- Locate a supplied public IPv4/IPv6 address, or leave the field blank to locate the current public connection IP.
- Added city/region/country, timezone, ISP, ASN, route, and approximate coordinates.
- Geo IPify is contacted only after an explicit Locate IP action; there are no background geolocation requests.
- Geo IPify API keys are encrypted with Electron safeStorage / Windows DPAPI and are never exposed back to the renderer.
- Public IP and geolocation results are intentionally excluded from exported reports and System-Aware AI context.
- Added fixed Geo IPify website launcher and explicit credential removal.
- Retains the v1.5.1 kbps network display hotfix and all v1.5.0 System-Aware AI features.

# Purple Dragon PowerTools v1.5.1 — Network Rate Display Hotfix

- Network download/upload throughput now displays in **kbps** (kilobits per second) instead of byte-oriented `B/s`, `KB/s`, or `MB/s`.
- Network session peaks, live traffic footer, chart scale, Performance network rates, and network-aware Assistant text use the same kbps formatter.
- Disk and process I/O rates remain byte-oriented because those are storage throughput metrics.
- No changes to network sampling, adapter discovery, or fast-boot behavior.

---

# Purple Dragon PowerTools v1.5.0 — System-Aware AI

## Added
- Added **System-Aware AI** to Model Center and the PowerTools Assistant.
- Added Smart Context, which selects only PC facts relevant to the current question.
- Added Full Loaded Context for broader troubleshooting using already-loaded PowerTools modules.
- Added a redacted System Context Preview so users can inspect exactly what PowerTools may attach to an AI request.
- Added current CPU/RAM/GPU/thermal/disk/network metrics, Windows/build/boot state, hardware identity, and optional loaded Security, Storage, Process, Network, Reliability, Feature Lab, Automation, and Startup summaries.
- Added context metadata to model responses so the UI can show whether context was actually attached.

## Privacy
- Local AI can receive redacted system context when System-Aware AI is enabled.
- Cloud system context is **off by default** and requires a separate explicit opt-in.
- Hostname, Windows username, IP/MAC addresses, file paths, API keys, and automation rule names/commands are omitted from automatic AI context.
- Cloud privacy policy is enforced again in the Electron main process; renderer settings alone cannot silently attach context.

## Performance
- System-Aware AI adds no work to application startup.
- Optional heavy providers are cache-only for AI context: Security, Storage, Process, Network, Feature Lab, and Startup are not scanned solely to answer an AI question.
- Core live/static context is generated only when a context preview or AI request explicitly needs it.

## Retained
- Dragon Router, AI Provider Hub, Windows Feature Lab, Security Center, Automation Engine, Reliability Center, fast boot, and guarded system actions remain included.

---

# Purple Dragon PowerTools v1.4.0 — Windows Feature Lab

- Added a new **Windows Feature Lab** navigation page and guarded capability scanner.
- Added standard and administrator scans for optional Windows features/capabilities.
- Added Windows edition + CPU virtualization compatibility reasoning.
- Added Windows Sandbox, WSL, Virtual Machine Platform, Windows Hypervisor Platform, Hyper-V, OpenSSH Client/Server, Developer Mode, HAGS, Core Isolation/Memory Integrity, Win32 Long Paths, Clipboard History, and Ultimate Performance visibility.
- Added hard-coded allowlisted changes for Windows optional features, OpenSSH capabilities, Win32 Long Paths, and Ultimate Performance activation.
- Added main-process confirmations, UAC elevation, restart warnings, risk labels, and reversibility metadata.
- Feature Lab is lazy-loaded and does not affect startup.
- System reports include Feature Lab state only when the lab has already been scanned; exporting a report never triggers a new Feature Lab scan.
- Retains Dragon Router and all v1.3.0 AI routing functionality.

# Purple Dragon PowerTools v1.3.0 — Dragon Router

## Added
- Dragon Router automatic model-selection engine.
- Automatic, Best Quality, Fastest, Cheapest, Local Only, and Privacy First routing profiles.
- Local prompt classification for coding, Windows/PC diagnostics, security, deep analysis, and general tasks.
- Explainable route decisions with confidence, provider/model selection, reasons, and three backup candidates.
- Route Prompt and Route & Send actions in Model Center.
- Optional Dragon Router integration with the PowerTools Assistant.
- Cloud-provider permission toggle for routing.
- Manual model selection remains fully supported.

## Privacy / cost behavior
- Routing does not call an AI model; it uses local heuristics over discovered provider/model metadata.
- Local Only never selects cloud models.
- Privacy First selects local models whenever available.
- Cheapest is a relative heuristic and does not claim live provider prices.
- Cloud requests still occur only when the user explicitly sends a prompt or uses an enabled Assistant model route.

## Performance
- Dragon Router is lazy and adds no provider queries to startup.
- Existing v1.2.0 Provider Hub, v1.1.x Model Center/About, Security Center, Automation Engine, and fast-boot architecture are retained.

---

# Purple Dragon PowerTools v1.2.0 — AI Provider Hub

## Added
- OpenAI / ChatGPT provider support using the Responses API.
- Dedicated Codex model classification using the same encrypted OpenAI credential.
- Claude provider support using the Anthropic Messages API.
- Gemini provider support using the Gemini Interactions API.
- Encrypted API-key vault using Electron safeStorage / Windows DPAPI.
- Per-provider configure/remove controls.
- Unified local + cloud model library and chat playground.
- Dynamic Local / Mixed privacy indicator.
- Cloud-request warning before prompts are sent.
- Cloud API keys are excluded from renderer state, reports, diagnostics, and activity history.

## Retained
- Ollama, LM Studio, custom loopback endpoints.
- Admin dropdown and About dialog.
- Fast boot and lazy module loading.
- Security Center, Automation Engine, Reliability Center, Storage, Process/App, Network, and hardware tooling.

## Privacy
- Cloud provider discovery occurs only after the user saves a credential and opens/refreshed Model Center.
- Cloud requests are made only after explicit user action.
- PowerTools Assistant does not attach live telemetry to cloud AI in v1.2.0.
