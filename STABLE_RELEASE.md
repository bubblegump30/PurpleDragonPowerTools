# Purple Dragon PowerTools v2.1.0 — VPN Center

v2.1.0 adds guarded NordVPN and ExpressVPN detection and client control to Network PowerTools. It preserves the v2.0.3 AI Command Center and corrected multi-drive HDD/SSD/USB usage accounting. VPN discovery remains lazy, credentials remain inside the official provider apps, and every disconnect requires explicit confirmation.

## Release invariants

- Package/runtime version must report 2.1.0.
- Electron remains pinned at 44.2.0.
- VPN detection does not run during application startup.
- The renderer can request only allowlisted provider IDs and actions.
- Executable paths and Start-menu IDs never leave the main process.
- VPN credentials, public IP information, and provider account data are never stored by VPN Center.
- Disconnect requires a confirmation explaining public-route and kill-switch effects.
- ExpressVPN CLI control requests Windows administrator approval.
- Command Center does not contact AI providers during application startup.
- Command Center prompts are not persisted to disk by the mission history.
- Cloud system context remains separately opt-in.
- AI responses cannot directly invoke Windows/PowerTools mutation IPCs.
- Existing AI Command Center, Change Journal, GitHub, Feature Lab, Privacy & App Trust, Security, Network, Storage, Process, and Reliability safeguards remain intact.
