# 安装与恢复

[English](../docs/en/setup.md)

在用户授权安装的会话里立即执行安装脚本。普通 skill 没有已验证的通用 post-install 钩子；手工复制目录后，在首次发动时执行同一初始化。不要声称复制文件就已安装全部环境。

```powershell
& '<skill>/scripts/Install-VideoSkill.ps1' -Workspace '<工作区>' -DataRoot '<长期资料目录>' -AliasRoot '<ASCII 工作区 junction>'
```

参数可省略，默认在 LocalAppData 下创建独立工作区/资料目录。优先接管本机已验证的 OpenEdit、FFmpeg、引擎与 WhisperX；缺少时按 assets/dependency-lock.json 固定来源下载到工作区，不安装到系统 Python，不自动升级可用依赖。既有目标不匹配时保留，报告定向恢复位置。PowerShell 7、Windows x64、真实桌面会话是运行前提。

初始化建立环境记录与机器指针，已有 preferences.md 不覆盖。新偏好模板的 confirmed=false 需要 Agent 完成确认；环境下载和偏好讨论可并行。设置确认标记必须有用户回答依据。

安装阶段还必须完成一次偏好蒸馏：读取已确认回答和活跃参考分析，生成配置合同中的 profile、scope、settings、policies、模块/adapter 版本和验证状态，并用短样验证字幕、关键词、卡片和安全区。安装结束前完整复读偏好文件，检查冲突、缺失适用范围和引用的模块/参考是否存在；短样只证明链路可运行，不把一次短样审美默认为长期规则。用户不需要输入命令，直接在对话中确认即可；Agent 负责生成候选并通过更新脚本提交带证据的 revision。

安装先运行真实中文 ASR、通用字幕配方短样及解码检查。环境烟雾测试独立于未确认的个人风格合同；风格合同另用短样和预检验证。文件指纹不变且上一轮通过时跳过验证；`-Verify` 强制重测。烟雾测试只证明短片链路，不证明冷机器、7 分钟、4K、复杂编排或审美质量。下载失败留存已有文件，不自动降级到付费云。

## 兼容要点

- 固定源码快照构建 CLI；不执行 npm 0.0.19 init。模型 medium、CPU/int8，Python 3.12 依赖约束见 assets。
- 引擎、素材、配方路径使用 ASCII alias；源文件保留原路径，可创建唯一英文硬链接，同卷失败再独立复制。
- `NODE_OPTIONS=--preserve-symlinks-main` 保留，否则上游 gate 入口可能输出空 JSON。
- 模型已缓存时 Hugging Face/Transformers 离线；缺模型只在安装阶段联机补齐固定 revision。
- 字体由实际渲染准备。不要只检查一个字体文件名就宣称整条字体链路正常。
- `environment.json` 是机器路径记录，迁移机器重新运行安装器；资料本身可备份，不能假设有云备份。

出错时读对应 logs，不每次把完整源码/安装历史加载到对话。保留源文件和旧成片。当前脚本覆盖缺依赖下载分支，但只有真实跑过的环境才可报告已验证。
