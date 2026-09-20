# Installation and recovery

[中文](../../references/setup.md) · [English home](../../README.md)

Run setup during the authorized installation session. There is no verified generic post-install hook for a plain skill directory. If someone copies the folder manually, run the same initialization on first invocation; copying files alone does not install the runtime.

```powershell
& '<skill>/scripts/Install-VideoSkill.ps1' -Workspace '<workspace>' -DataRoot '<persistent data>' -AliasRoot '<ASCII workspace junction>'
```

Arguments are optional; defaults use LocalAppData. Reuse an existing verified OpenEdit, FFmpeg, rendering engine and WhisperX installation where possible. Download missing components from the pinned sources in `assets/dependency-lock.json` into the workspace. Do not install into system Python or automatically upgrade working dependencies. Preserve conflicting existing targets and report the component/path that needs recovery. PowerShell 7, Windows x64 and a desktop session are prerequisites.

Initialization records machine paths without overwriting an existing `preferences.md`. A new template has `confirmed=false`; the agent must confirm preferences with the user. Dependency downloads and the preference discussion can proceed independently. Do not mark preferences confirmed without supporting answers.

Setup runs real Chinese speech recognition, a caption rendering smoke test and full decoding. Reuse a previously successful validation when fingerprints are unchanged; `-Verify` forces a new test. The short test does not establish clean-machine installation, seven-minute performance, 4K support, complex composition or aesthetic quality. Preserve existing files on download failure; do not switch to a paid cloud service automatically.

## Compatibility

- Build the CLI from the pinned source snapshot; do not run npm 0.0.19 init. Use medium, CPU/int8 and the Python 3.12 constraints in assets.
- Use ASCII aliases for engine, media and recipe paths. Preserve originals; use unique English hard links when possible, otherwise copy.
- Keep `NODE_OPTIONS=--preserve-symlinks-main`; upstream gate entrypoints may otherwise produce empty JSON.
- Cached Hugging Face/Transformers models run offline. Download missing pinned model revisions during setup.
- Validate fonts by actual rendering, not merely by finding a font filename.
- `environment.json` contains machine-specific paths. Rerun setup after migration; back up user data separately rather than assuming cloud backup exists.

Read the relevant logs when something fails instead of loading all source code and installation history every time. Preserve original media and previous exports. Missing-dependency download branches exist, but only environments actually tested may be reported as verified.
