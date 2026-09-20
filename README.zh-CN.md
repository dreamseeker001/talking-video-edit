# talking-video-edit · 口播剪辑 Skill

[English](README.md) | **简体中文**

让 Codex 调用本地 OpenEdit、FFmpeg 和 WhisperX，完成中文口播清理、校色、演示素材编排、字幕与成片，并在后续任务中复用已确认的风格偏好。

这是给 Agent 使用的工作流与工具入口。语义取舍、画面编排和审美判断仍由 Agent 结合素材执行；脚本负责环境准备、原生命令调用与技术检查。无需专门的剪辑界面。

## 能做什么

- 清理口误、废弃重录、无意义重复和多余停顿，保留自然气口；字幕按实际口播，脚本辅助理解。
- 在未烧录字幕的画面上调整曝光、白平衡、对比度和饱和度；LUT 按用户选择及素材适配使用。
- 编排真实录屏、图片和 B-roll，生成字幕、步骤标签、关系图与普通文字动画。
- 保存原生 EDL、转录、配方和工程，按修改范围复用已有结果。
- 归档用户提供的参考原片，蒸馏风格与剪辑要点，每次开始时读取偏好并查看代表画面。

默认走本地转录与渲染，不要求 VEED 账户或付费生成 API。Codex 本身的使用成本由使用者已有方案承担；复杂新镜头可由用户自己的 AIGC 平台生成后返回。这个 skill 不附带文生视频模型，也不代表全链路离线。

## 三部分结构

| 部分 | 职责 | 入口 |
|---|---|---|
| 安装准备 | 复用或部署固定依赖，缓存模型，运行真实短片检查 | `scripts/Install-VideoSkill.ps1` |
| 日常剪辑 | 恢复本片 → 联合语义/画面决策 → 清理、校色合成、包装 → 检查交付 | `SKILL.md`、Prepare / Invoke 脚本 |
| 偏好与参考 | 初始化问答、参考独立归档、项目快照、按反馈范围更新记忆 | `references/preferences.md` |

工具与规则在安装阶段固定。日常只加载入口、当前偏好、本片状态和必要视觉证据；安装历史、工具源码和全部参考分析按需读取。

## 运行条件

- Windows 10/11 x64、PowerShell 7、`tar.exe`，以及可运行渲染引擎的桌面会话。
- Codex 能执行本地命令、读写文件并查看图像。
- 首次安装能访问 GitHub、Node.js、Python 包索引和 Hugging Face。依赖及模型需要下载数 GB，仓库不附带这些大文件。
- CPU 转录配置为 WhisperX medium / int8；本版不自动配置 CUDA。

已固定的依赖见 [dependency-lock.json](assets/dependency-lock.json) 和 [whisperx-constraints.txt](assets/whisperx-constraints.txt)。当前基线为 OpenEdit 源码快照、渲染引擎 0.10.2、FFmpeg 9.0.1、WhisperX 3.4.3 / Python 3.12。

## 安装

1. 下载或克隆本仓库，将目录命名为 `talking-video-edit`。
2. 放到 `%USERPROFILE%\.codex\skills\talking-video-edit`。若设置了 `CODEX_HOME`，则放到该目录的 `skills\talking-video-edit` 下。已有同名 skill 时先保留本机配置，不覆盖自己的 `scripts/local-settings.json`。
3. 在 Codex 中发送：

   > 使用 $talking-video-edit，完成首次安装、环境验证和偏好初始化。请先读取 SKILL.md，并按安装入口执行。

Agent 会运行安装准备，并确认校色/LUT、字幕与包装、清晰度/画幅/声音和参考借鉴范围。已有明确回答会复用。没有参考视频也可以使用；参考索引可以为空。

手动执行环境准备时，在 skill 目录中运行：

```powershell
pwsh -NoProfile -File ./scripts/Install-VideoSkill.ps1
```

默认工作区在 `%LOCALAPPDATA%\codex-video-workspace`，长期资料在 `%LOCALAPPDATA%\codex-video-data`。需要自定义路径时：

```powershell
pwsh -NoProfile -File ./scripts/Install-VideoSkill.ps1 `
  -Workspace 'D:/video-workspace' `
  -DataRoot 'D:/video-data' `
  -AliasRoot 'D:/video-workspace'
```

`AliasRoot` 必须是纯 ASCII 路径；若用户目录含中文，使用上面的自定义方式。原工作区可以是中文路径，安装器会在指定 ASCII 位置建立 junction。

仅把 skill 文件复制进目录不会自动执行脚本；安装会话或首次发动负责初始化。手动脚本完成的是环境部分，偏好仍需由 Agent 按用户回答填写。重复安装保留已有偏好；依赖指纹未变且上次通过时复用验证，`-Verify` 可强制重测。

## 日常使用

新片：

> 使用 $talking-video-edit 剪辑这条口播。原片和脚本在附件中，按我的已有偏好完成一个可修改的成片。

同片修改：

> 使用 $talking-video-edit 继续这个工程，把字幕中的这处错字改掉，其他按本片快照处理。

增加参考：

> 使用 $talking-video-edit，归档这条参考视频，并提炼适合我的构图与剪辑要点。此次只借鉴信息递进方式。

普通字幕和文字动画优先本地完成；需要用户提供新素材时，Agent 给出具体画面意图和生成提示词。技术问题由 Agent 检查处理，用户主要负责审美反馈和内容选择。

## 数据与记忆

```text
talking-video-edit/              本仓库，可安装为 skill
  SKILL.md
  agents/openai.yaml
  scripts/                      环境/准备/执行/归档入口
  references/                   按需加载的流程说明
  assets/                       通用字幕配方、依赖锁、空偏好模板、合成测试音频

<dataRoot>/                     安装后在仓库外生成
  environment.json              本机环境路径与验证记录
  preferences.md                当前长期偏好
  references/<id>/              参考原片、哈希、关键帧与分析

<workspace>/.open-edit/runtime/runs/<key>/
  task.md                       当前任务状态
  preferences.snapshot.md       本片偏好快照
  transcript.json               原生转录
  logs/、final/                 检查记录与成片
```

`scripts/local-settings.json` 由安装器生成，仅指向本机资料目录，已加入 `.gitignore`。更新 skill 时保留它和外部资料；迁移电脑时备份偏好/参考，并在新机器重新登记环境。

长期规则只从明确反馈中积累，局部修改先限于本片。新全局偏好不会静默改写旧工程快照。本仓库包含空偏好模板，不包含作者的个人风格记录、姓名、真实素材或参考视频。唯一内置音频 `assets/smoke.wav` 是合成测试语音。

## 验证范围与已知限制

已在一台 Windows x64 电脑上验证：已有环境接管、重复安装、中文 ASR、原生剪切和字幕重定时、竖屏技术短样、横屏完整教程、字幕局部修正、参考归档、渲染与解码检查。字幕修正可复用上游转录和底片。

干净电脑全量安装、接近 7 分钟素材、2K/4K、HDR/LUT 和真实竖屏教程编排尚未完成实测。脚本包含缺组件下载分支，不将其等同于跨机器安装保证。

- 当前引擎可能将 59.94fps 输出为 59fps；流程会核对实际帧率，必要时显式转换并记录。
- 当前字幕引擎不支持 `-webkit-text-stroke`；通用配方使用黑底居中文字，避免硬阴影拼接描边的毛刺。
- 技术检查通过不代表字幕语义、审美和听感都正确；没有实际音频感知工具时，Agent 必须说明未做听辨。
- 参考或新片内容不同仍需要创意判断，不能保证所有成片零修改。

详细机制见 [SKILL.md](SKILL.md)、[安装与恢复](references/setup.md)、[偏好与参考](references/preferences.md)、[日常剪辑](references/editing.md)。第三方来源及素材说明见 [THIRD_PARTY.zh-CN.md](THIRD_PARTY.zh-CN.md)。英文指南在 [README 文档索引](README.md#documentation--文档)。Agent 默认只加载一套执行说明，不重复加载双语全文。
