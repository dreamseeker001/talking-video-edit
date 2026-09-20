# Talking-video editing: agent workflow

[中文执行入口](../../SKILL.md) · [English home](../../README.md)

English translation of the executable skill instructions. The installed entrypoint is the root `SKILL.md`; read one language version, not both, unless comparing translations. This workflow targets Windows x64 and existing tools/OpenEdit projects, not a new editor or general orchestration platform.

## Three entrypoints

- Installation, first use or broken dependencies: read [setup](setup.md) and run `scripts/Install-VideoSkill.ps1`. Perform preparation during the installation task rather than only copying files. If preferences are unconfirmed, read [preferences](preferences.md), reuse known answers and ask only for missing choices.
- New video or resume: run `scripts/Prepare-VideoTask.ps1 -Media <source> -RunKey <unique-English-key>`; an existing native project can also use `-RunDir`. Read the reported preferences, snapshot and `task.md`, and actually inspect active reference frames. Do not load installation history on healthy runs.
- Style changes, reference archiving or feedback memory: read [preferences](preferences.md) as needed. Current instructions take precedence; new global settings do not silently change old snapshots.

`scripts/local-settings.json` points to external persistent data. Preferences, environment records and references live outside the skill. Do not reuse old machine paths after copying the skill to another machine.

## Five daily stages

1. Restore preferences, references, project state and media information. Reuse valid ASR. Scripts clarify intent; captions follow actual speech. Confirm newly identified personal names separately.
2. Decide speech retention and visual narrative together. Read [editing](editing.md) for first edits or a new creative plan. Change the subject, real demonstration and relationship graphics with meaning instead of swapping images inside one fixed card layout.
3. Native cuts and caption retiming → source grading and demonstration composition → one caption/graphics render. Use the Transcribe, Prep, Cut and Render stages of Invoke-VideoStage; use FFmpeg directly for special composition and retain its script in the project.
4. Run Check and native rendering gates, then inspect real caption alignment, occlusion, skin tones and key demonstration actions. Fix specific defects. Without actual audio perception, do not claim to have listened or verified cut smoothness by ear.
5. Deliver one playable export and update `task.md` with paths, output specifications, preference version and remaining items. Apply feedback to the project first and generalize only within its stated scope. Silence is not acceptance.

## Essential boundaries

- Preserve originals, native EDLs, timed transcripts, recipe copies and the latest acceptable export. Do not edit upstream recipes or generated `.wv` files. Copy `assets/captions-clean.ts` into the project before customization.
- The current engine may turn 59.94fps into 59fps. Check actual output; explicitly normalize to 60fps and record it when necessary. Preferences determine orientation, resolution and audio defaults.
- Exposure and white balance are shot-dependent. Use LUTs only with appropriate inputs; do not grade captions/cards along with footage. Handle demonstration audio separately from narration.
- `-webkit-text-stroke` is unsupported by this engine. Do not construct thick Chinese outlines with eight hard offset shadows. Visually inspect dark-plate caption centering.
- Render ordinary captions and explanation graphics locally. For complex new shots, provide prompts for the user's external generation platform. Do not automatically buy subscriptions, invoke paid services or fabricate product interfaces.
- Do not repeat installations, tool research, full historical reads or whole-reference analysis on every job. Revisit the relevant original segment for motion/pacing questions, conflicting evidence or changed references.
