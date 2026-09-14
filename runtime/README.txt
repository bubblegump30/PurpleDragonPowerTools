Purple Dragon PowerTools source runtime

Normal source launch installs only the Electron npm wrapper declared in this
folder. Electron 44+ then downloads its native Windows binary on demand.
`scripts\run.ps1` performs both steps and validates Electron's generated
path.txt / executable before launching PowerTools.

Electron is pinned to 44.2.0 for this release.
Packaging dependencies are intentionally excluded from this runtime.
Use scripts\repair-runtime.ps1 to remove and rebuild only this generated runtime.

PowerTools app release: v1.5.3 Privacy Intelligence Edition.
