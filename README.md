# talking-video-edit

Version: **v1.1**

This version strengthens preference contracts, whole-video editorial planning, and Agent recovery with delivery reporting. Scripts handle deterministic stages; the Agent handles semantic decisions and in-scope recovery. Existing helper tests pass; a fresh end-to-end run of the revised orchestration is still pending.

**English** | [简体中文](README.zh-CN.md)

See the [changelog](CHANGELOG.md) for release history.

A Codex skill for Chinese talking-head video editing with OpenEdit, FFmpeg, and WhisperX. Supports local speech cleanup, color correction, animated captions, B-roll sequencing, and persistent editing preferences.

The agent makes semantic and creative decisions from your footage, script and references. Scripts handle environment preparation, native tool calls and technical checks. No dedicated editing interface is required.

## Capabilities

- Remove flubs, abandoned takes, redundant speech and excessive pauses while retaining meaningful breaths. Captions follow the actual narration; the supplied script helps interpret intent.
- Correct exposure, white balance, contrast and saturation before burning in captions. Use LUTs only when requested and suitable for the footage.
- Sequence real screen recordings, stills and B-roll; render captions, step labels, relationship diagrams and ordinary text animation locally.
- Retain native EDLs, timed transcripts, recipe modules and project state so revisions reuse relevant upstream work.
- Archive reference originals independently, distill useful style principles and consult representative frames when a new task starts.

The default workflow uses local transcription and rendering without a VEED account or paid generation API. Codex usage remains subject to your own plan. Complex new shots can be generated on your external AIGC platform and returned as assets. No text-to-video model is bundled, and local editing does not mean every interaction is offline.

## Three parts

| Part | Purpose | Entrypoint |
|---|---|---|
| Setup | Reuse or install pinned dependencies, cache models and test an actual short video | `scripts/Install-VideoSkill.ps1` |
| Daily editing | Restore context → decide speech and visuals → cut, grade, compose and caption → check and deliver | `SKILL.md`, Prepare / Invoke scripts |
| Preferences and references | Initial choices, independent reference archive, project snapshots and scoped feedback | [Preference guide](docs/en/preferences.md) |

Stable tool choices are established during setup. Daily work loads the short entrypoint, current preferences, project state and necessary visual evidence. Installation history, source code and full reference analyses are loaded only when needed.

Long-term preferences are a versioned configuration contract, not loose memory text. Each profile carries scope, module/adapter hashes, executable settings, agent policies, evidence and implementation status. A task freezes one contract snapshot; preflight and rendering consume that same snapshot. Saying “remember this” starts a backed-up, optimistic-concurrency update, followed by a full reread and conflict audit.

## Requirements

- Windows 10/11 x64, PowerShell 7, `tar.exe`, and a desktop session capable of running the rendering engine.
- Codex with local command execution, file access and image inspection.
- Initial network access to GitHub, Node.js, Python package indexes and Hugging Face. Dependencies and models require several GB of downloads and are not included in this repository.
- WhisperX medium on CPU/int8. This release does not automatically configure CUDA.

Pins are recorded in [dependency-lock.json](assets/dependency-lock.json) and [whisperx-constraints.txt](assets/whisperx-constraints.txt). The current baseline uses a fixed OpenEdit source snapshot, rendering engine 0.10.2, FFmpeg 9.0.1 and WhisperX 3.4.3 on Python 3.12.

## Install

1. Clone or download this repository as a directory named `talking-video-edit`.
2. Place it at `%USERPROFILE%\.codex\skills\talking-video-edit`, or under `skills\talking-video-edit` in your custom `CODEX_HOME`. Preserve your existing `scripts/local-settings.json` when updating an installed copy.
3. Ask Codex:

   > Use $talking-video-edit to complete first-time installation, environment verification and preference initialization. Read SKILL.md and follow its setup entrypoint.

The agent prepares the environment and confirms color/LUT choices, captions and graphics, resolution/orientation/audio and how to use references. Existing explicit answers are reused. Reference videos are optional; the reference index can remain empty.

For manual environment preparation, run this from the skill directory:

```powershell
pwsh -NoProfile -File ./scripts/Install-VideoSkill.ps1
```

The default workspace is `%LOCALAPPDATA%\codex-video-workspace`; persistent user data lives at `%LOCALAPPDATA%\codex-video-data`. To customize:

```powershell
pwsh -NoProfile -File ./scripts/Install-VideoSkill.ps1 `
  -Workspace 'D:/video-workspace' `
  -DataRoot 'D:/video-data' `
  -AliasRoot 'D:/video-workspace'
```

`AliasRoot` must use ASCII characters. If your user directory contains non-ASCII characters, supply a suitable custom path. The original workspace can have a non-ASCII path; setup creates a junction at the chosen ASCII alias.

Copying skill files does not automatically execute setup. The installation session or first invocation performs initialization. Manual setup prepares the environment; the agent must still fill preferences from your answers. Repeated installation preserves existing preferences and reuses successful validation when fingerprints are unchanged. Use `-Verify` to force a new smoke test.

## Use

New video:

> Use $talking-video-edit to edit the attached talking-head footage and script. Follow my saved preferences and deliver one editable final video.

Revision:

> Use $talking-video-edit to resume this project and correct this caption typo. Keep the rest consistent with the project's preference snapshot.

Reference:

> Use $talking-video-edit to archive this reference and distill useful composition and editing principles. For this reference, borrow only the progressive explanation style.

Ordinary captions and text animation are rendered locally. When new material is necessary, the agent supplies a concrete visual brief and generation prompt. The agent handles technical inspection; you provide aesthetic feedback and content choices.

## Data and memory

```text
talking-video-edit/                 Installable skill / this repository
  SKILL.md
  agents/openai.yaml
  scripts/                         Setup, preparation, stages and archiving
  references/                      Chinese operational guides
  docs/en/                         English guide translations
  assets/                          Recipe, pins, empty preferences, synthetic test audio

<dataRoot>/                        Created outside the skill
  environment.json                 Machine paths and validation
  preferences.md                   Current long-term preferences
  references/<id>/                 Original, hash, keyframes and analysis

<workspace>/.open-edit/runtime/runs/<key>/
  task.md                          Current project state
  preferences.snapshot.md          Project-specific preference snapshot
  transcript.json                  Native transcript
  logs/ and final/                 Checks and exports
```

Setup generates `scripts/local-settings.json` as a pointer to external user data. It is ignored by Git. Preserve that file and external data when updating the skill. Back up preferences and references when migrating computers, and register the environment again on the new machine.

Only explicit feedback becomes a long-term rule. Local corrections remain local until their scope is established. Global changes do not silently rewrite existing project snapshots. The repository ships an unconfirmed empty preference template, not the author's identity, personal style records, footage or references. The only bundled audio, `assets/smoke.wav`, is synthetic test speech.

## Verification and limitations

Verified on one Windows x64 machine: adopting an existing environment, repeated setup, Chinese ASR, native cuts and caption retiming, a portrait technical smoke test, a complete landscape tutorial, caption-only revisions, reference archiving, rendering and full decoding. Caption changes reused upstream ASR and the base video.

Clean-machine installation, footage approaching seven minutes, 2K/4K, HDR/LUT workflows and real portrait tutorial composition have not been fully tested. Missing-component download branches exist; they are not a guarantee of successful deployment on every machine.

- The current engine may output 59fps from 59.94fps input. The workflow checks actual output and records any necessary explicit conversion.
- `-webkit-text-stroke` is unsupported by the current engine. The baseline recipe centers text on a dark plate and avoids jagged hard-shadow outlines.
- Passing technical checks does not establish semantic correctness, aesthetic quality or listening quality. Without actual audio perception, the agent must state that listening was not performed.
- Different footage and references still require creative judgment; zero-revision output is not guaranteed.

## Documentation / 文档

| Guide | English | 简体中文 |
|---|---|---|
| Overview and installation | [README](README.md) | [README](README.zh-CN.md) |
| Agent workflow | [Workflow](docs/en/skill.md) | [SKILL.md](SKILL.md) |
| Setup and recovery | [Setup](docs/en/setup.md) | [安装与恢复](references/setup.md) |
| Preferences and references | [Preferences](docs/en/preferences.md) | [偏好与参考](references/preferences.md) |
| Editing and revisions | [Editing](docs/en/editing.md) | [日常剪辑](references/editing.md) |
| Third-party components | [Sources](THIRD_PARTY.md) | [组件说明](THIRD_PARTY.zh-CN.md) |

The installed agent entrypoint remains `SKILL.md`; translations are available for readers without doubling the default agent context. The project is not an official OpenAI or VEED distribution. See the third-party notes for component sources and licensing boundaries.
