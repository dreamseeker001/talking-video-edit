# 日常剪辑决策与复用

[English](../docs/en/editing.md)

先看实际内容和必要镜头，不机械套固定布局。把清理决定和演示编排合并：每段想说明什么、保留哪些讲述、由人物/产品/操作界面/关系图中哪个做主体、是否需要新素材。实拍演示的光标和生成动作取自真实录屏，不能伪造点选。开头/结果展示让主体足够大；并列前后对照和输入关系只在确实解释关系时出现。参考借鉴其解释方法，不照搬画面内容。

## 原生入口

Prepare 返回 Media、RunDir 等路径。Invoke-VideoStage 只转发原生命令并记录日志，不替 Agent 决定删什么。

首次接管已有转录时，Prepare 会核对其 meta 指向的源内容。若是 Agent 刚复用的已验证重定时字幕，尚无 meta，可明确加 `-AdoptExistingTranscript`；不能用此开关绕过不明来源缓存。

```powershell
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Transcribe -Media '<prepared Media>' -RunDir '<RunDir>'
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Prep -Media '<prepared Media>' -RunDir '<RunDir>'
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Cut -Edl '<native EDL>' -Output '<clean.mp4>' -RunDir '<clean native run>'
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Render -RunDir '<native run>' -Module '<project recipe.ts>'
& '<skill>/scripts/Invoke-VideoStage.ps1' -Stage Check -RunDir '<native run>' -Output '<final.mp4>'
```

Cut 使用原生 `apply-edl` 和 `retime-transcript`；先创建 run，再写重定时结果。EDL 使用 sources、transcripts、ranges，不引入自己的格式。默认40ms crossfade只是已测配置，可以按实际问题改；重定时丢字告警必须查看，不能重新转录剪后片掩盖它。语义不确定先保留，脚本不是改写讲话的许可。

校色只处理未烧录字幕底片。1080p交付按源画幅等比构建；如改2K/4K，从足够分辨率源重建，不能简单放大旧1080p底片冒充细节升级。HDR/广色域先识别输入色彩，不直接套 SDR eq 或 LUT。FFmpeg合成脚本保存在项目；实际帧数/音画时长由工具计算。

普通中文黑底配方复制 assets/captions-clean.ts；具体语义标签、焦点框和演示关系写本片模块。竖屏需要自己的素材构图和手机安全区，不把横屏坐标缩放过去。原生 generate-recipe 负责 lint/verify/record/probe，mux-audio 恢复并标准化旁白；不编辑其生成的文档。

## 修改与检查

- 错字：改当前逐字转录对应文本，保留时间，Prep → Render → Check，复用原片 ASR/剪切/底片。
- 包装变化：改模块，Render → Check；校色变化：重建底片，再渲染字幕。
- 剪切变化：EDL → 重定时 → 底片 → 包装；不能误用之前的 word-timings。
- 新源：唯一 run key，Prepare 核对源身份，避免同名缓存碰撞；更新依赖/模型后显式决定是否重跑。

技术检查：原生 gates、实际分辨率/帧率/时长/音轨、完整解码。视觉检查：参考方向、主体占比、字幕在黑底内居中、无毛刺/挡脸/遮关键按钮、画面与讲述一致、结尾与切换处无黑帧。上述 checks 不等于实际音频听辨。用户不承担逐帧技术质检，但审美验收仍由用户给意见。

task.md 保持简短：输入和脚本、EDL/底片/转录/模块路径、偏好快照版本、阶段状态、当前输出规格、验证范围、尚需用户的内容决定。旧失败详情留日志，不日常全读。一次失败定向修复；同因重复失败且无新证据时报告具体问题，不无限盲重试。
