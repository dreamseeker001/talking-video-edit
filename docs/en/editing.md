# Daily editing decisions and reuse

[中文](../../references/editing.md) · [English home](../../README.md)

Examine the actual content and relevant shots before choosing a layout. Combine speech cleanup and visual planning: what each section explains, which narration to retain, whether the speaker/product/interface/relationship diagram should dominate, and whether new material is needed. Use real recorded cursor and generation actions; do not fabricate clicks. Give opening/result shots enough visual space. Use side-by-side comparisons and input relationships when they explain something. Borrow the reference's explanatory method, not its subject matter.

## Native entrypoints

Prepare returns Media and RunDir paths. Invoke-VideoStage forwards native commands and records logs; it does not decide what to delete.

Follow [agent-recovery](agent-recovery.md) for phased execution and recovery reporting. After Cut the agent prepares the base and actual caption chunks before Prep and annotation derivation. An internal handoff does not require user approval or end the task.

When adopting an existing transcript, Prepare checks the source referenced by its metadata. For an explicitly verified retimed/imported transcript without metadata, use `-AdoptExistingTranscript`. Do not use that switch to bypass unknown cache provenance.

```powershell
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Transcribe -Media '<prepared Media>' -RunDir '<RunDir>'
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Prep -Media '<prepared Media>' -RunDir '<RunDir>'
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Cut -Edl '<native EDL>' -Output '<clean.mp4>' -RunDir '<clean native run>'
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Render -RunDir '<native run>' -Module '<project recipe.ts>'
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Check -RunDir '<native run>' -Output '<final.mp4>'
```

Cut uses native `apply-edl` and `retime-transcript`, creating the run directory before writing the retimed transcript. Use native sources/transcripts/ranges, not a custom EDL format. The default 40 ms crossfade is a tested configuration, not a universal rule. Inspect dropped-word warnings rather than hiding them by retranscribing the edited video. Preserve semantically uncertain material; a supplied script is not permission to rewrite what was said.

Grade only footage without burned-in captions. Build 1080p output proportionally to the source orientation. If 2K/4K is requested, rebuild from sufficiently detailed sources rather than claiming that an upscale of a 1080p intermediate adds detail. Identify HDR/wide-gamut inputs before applying SDR filters or LUTs. Keep project-specific FFmpeg composition scripts in the project, and let tools calculate frame counts and media duration.

Use `assets/captions-clean.ts` only as an environment baseline. Formal tasks freeze the module and adapter selected by the current profile. Initialize one full-film `editorial-plan.json`; the agent reads the whole context and decides cuts, semantic boundaries, keep/delete reasons, captions, cards and policy evidence before any cut. Derive native segmentation, `presentation.json` and `policy-review.json` from the final plan. Draft plans are deliberately blocked by preflight and cannot invent meaning. Keep content out of hard-coded topic dictionaries. Portrait compositions need their own framing and mobile safe areas, not scaled landscape coordinates. Native generate-recipe handles lint/verify/record/probe, and mux-audio restores and normalizes narration. Do not edit generated documents.

## Revisions and checks

- Caption typo: change the relevant transcript text while preserving timing, then Prep → Render → Check. Reuse source ASR, cuts and the base video.
- Graphics change: update the module, then Render → Check. Color change: rebuild the base video before rendering captions.
- Cut change: EDL → retiming → base video → graphics. Do not reuse stale word timings.
- New source: use a unique run key and verify source identity. Explicitly decide whether dependency/model changes require reruns.

Technical checks cover native gates, actual resolution/frame rate/duration/audio streams and full decoding. Visual checks cover the reference direction, subject prominence, caption centering, jagged edges, covered faces/buttons, semantic correspondence and black frames near cuts/endings. `presentation.json` must cover every native beat and `policy-review.json` must provide evidence for every contract policy; neither replaces the native timeline. These checks do not establish audio listening quality. The agent handles technical inspection; the user still provides aesthetic feedback.

Keep `task.md` concise: inputs and script, EDL/base/transcript/module paths, preference snapshot revision, stage, output specification, verification scope and remaining content decisions. Keep old failures in logs. Fix a specific failure; if the same cause repeats without new evidence, report it instead of retrying blindly forever.
