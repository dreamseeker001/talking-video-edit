# 第三方组件与测试素材

[English](THIRD_PARTY.md) | **简体中文**

本仓库分发 Agent 指令、辅助脚本和通用配方，不打包下列依赖的源码树、可执行文件、模型权重或字体。安装器从相应上游下载，版本与已记录归档哈希见 `assets/dependency-lock.json`。第三方组件适用各自的授权条款，本仓库不重新授权它们，也不是 VEED 或 OpenAI 官方发行物。

| 组件 | 上游来源 | 用途 |
|---|---|---|
| OpenEdit | https://github.com/veedstudio/open-edit | 原生剪切、转录映射、配方与检查命令 |
| VEED / Weave 渲染引擎 | https://github.com/veedstudio/weave-renderer-public-releases | 动画与字幕渲染；二进制发布不等于其全部代码开源 |
| FFmpeg Windows 构建 | https://github.com/GyanD/codexffmpeg | 媒体处理，具体构建条件以上游为准 |
| WhisperX | https://github.com/m-bain/whisperX | 语音识别与逐字对齐 |
| faster-whisper medium 权重 | https://huggingface.co/Systran/faster-whisper-medium | 本地中文识别 |
| 中文对齐模型 | https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-chinese-zh-cn | 中文逐字对齐 |
| Node.js / pnpm / uv | https://nodejs.org/ · https://pnpm.io/ · https://github.com/astral-sh/uv | 安装与运行依赖 |
| Noto Sans SC | https://fonts.google.com/noto/specimen/Noto+Sans+SC | 字幕配方所声明的字体，由渲染链路获取 |

`assets/captions-clean.ts` 调用 OpenEdit 的模板库，不内嵌该库代码。上游支持与接口变化可能影响安装或输出，因此本版固定版本并保留实测边界。

`assets/smoke.wav` 是开发阶段通过 Windows SAPI 生成的中文合成语音，用于 ASR、字幕与音轨验证；内容是关于口播剪辑的通用测试句。它不包含用户录音、身份信息或参考片声音。本仓库没有真实项目视频、客户素材或个人偏好档案。

本版没有为仓库自有内容选择统一许可证；发布者可按自己的分发意图另行添加 LICENSE。第三方条款独立适用。
