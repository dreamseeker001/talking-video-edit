# Preferences and references

[中文](../../references/preferences.md) · [English home](../../README.md)

`<dataRoot>/preferences.md` is the single authority for current long-term preferences. Its first JSON block contains the revision, confirmation state, style/output settings and reference index. The prose records principles, scope and evidence; do not maintain a conflicting second configuration. Copy one snapshot per project. Report version differences on resume without silently restyling an existing project.

During setup, confirm three groups: color correction and LUTs; captions, cards and the scope of reference borrowing; resolution, orientation, frame rate and audio. Reuse explicit existing answers. A reference does not imply acceptance of all its elements: record what is adopted, rejected or undecided.

## Preference lifecycle

During installation, distill confirmed answers and archived reference evidence into machine-readable `revision`, profiles, scopes, module/adapter hashes, settings, policies, output, references and validation state. Each task reads the complete JSON and prose, freezes one profile plus its module and adapter, and applies explicit project overrides. `settings` drive mechanical output; `policies` drive evidence-backed agent decisions. Classify feedback as local-only, candidate, or explicit long-term preference. An explicit “remember this” starts an update without asking again; recurring high-value changes are offered as candidates. After any write, increment `revision`, reread the complete file and audit conflicts; unresolved conflicts require a user choice or scenario split before rendering. IDs and profile names are internal, not user style names.

## Archiving

```powershell
& '<skill>/scripts/Archive-VideoReference.ps1' -Source '<reference video>' -ReferenceId 'ref-001' -Times 8,16,29,45,63
```

The script makes an independent copy, records source/size/SHA256, probes media and extracts frames. Repeated runs verify the original hash rather than replacing different content under the same ID. Existing analyses and contact sheets may be copied into the archive.

The agent examines the actual images and writes `analysis.md`: composition, visual hierarchy, shot changes, evidence for typography/transitions/pacing, adoption scope and limitations, with specific time ranges. If a portrait screen recording contains a landscape video, crop representative frames to the actual work. Add the keyframe index to `reference.json`, then add the active reference ID to preferences.

On each invocation, read preferences and project overrides and open representative frames from active references. For motion-dependent judgments, extract the relevant short segment or dense frame sequence with FFmpeg. Distinguish still-frame evidence from actual audiovisual perception; never invent listening observations. Report and repair missing references instead of claiming style calibration is intact.

## Learning from feedback

Record the user's wording, the target, scope, applied change and verification. Explicit ongoing rules update the global preferences and increment the revision. Local corrections stay in `task.md`; recurring but unconfirmed tendencies remain candidates. Current instructions take precedence, and existing snapshots are not silently rewritten. Track repeated problems, revision count and time; do not collect publication outcomes or build a training database.
