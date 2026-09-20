# Third-party components and test material

**English** | [简体中文](THIRD_PARTY.zh-CN.md)

This repository distributes agent instructions, helper scripts and a caption recipe. It does not bundle dependency source trees, executables, model weights or fonts. Setup downloads components from their upstream sources; pinned versions and recorded archive hashes are in `assets/dependency-lock.json`. Each third-party component retains its own terms. This repository does not relicense them and is not an official VEED or OpenAI distribution.

| Component | Upstream | Purpose |
|---|---|---|
| OpenEdit | https://github.com/veedstudio/open-edit | Native cuts, transcript mapping, recipes and checks |
| VEED / Weave rendering engine | https://github.com/veedstudio/weave-renderer-public-releases | Graphics and captions; a binary release does not imply all engine code is open source |
| FFmpeg Windows builds | https://github.com/GyanD/codexffmpeg | Media processing; consult the specific upstream build's terms |
| WhisperX | https://github.com/m-bain/whisperX | Speech recognition and word alignment |
| faster-whisper medium weights | https://huggingface.co/Systran/faster-whisper-medium | Local Chinese transcription |
| Chinese alignment model | https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-chinese-zh-cn | Chinese word alignment |
| Node.js / pnpm / uv | https://nodejs.org/ · https://pnpm.io/ · https://github.com/astral-sh/uv | Dependency installation and execution |
| Noto Sans SC | https://fonts.google.com/noto/specimen/Noto+Sans+SC | Font declared by the caption recipe and obtained by the rendering workflow |

`assets/captions-clean.ts` calls OpenEdit's template library without embedding its implementation. Upstream interface/support changes can affect installation and output; this release pins dependencies and documents its testing limits.

`assets/smoke.wav` is Chinese speech synthesized with Windows SAPI during development. Its generic text discusses talking-head editing and is used to test ASR, captions and audio. It contains no user recording, personal identity information or reference-video audio. No real project videos, customer materials or personal preference archive are included.

No repository-wide license has been selected for this release's original content. The publisher may add a LICENSE according to their distribution intent. Third-party terms apply independently.
