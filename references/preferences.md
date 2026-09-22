# 偏好与参考

[English](../docs/en/preferences.md)

`<dataRoot>/preferences.md` 是当前长期偏好的唯一权威。第一段 JSON 是偏好配置合同，保存 schema/revision、activeProfile、profiles、能力映射、模块版本、验证状态、输出和参考索引等机器可读字段；正文保存蒸馏证据、适用原则与冲突解释。正文不能另行定义一套会覆盖 JSON 的样式配置。每片复制一次快照；续做出现版本差异只报告，不替旧片自动换风格。

安装时分三组确认：校色与 LUT；字幕/卡片/参考借鉴范围；清晰度、画幅、帧率及声音。用户已明确回答的项不再问。参考不是自动接受其全部元素；分别记录采纳、舍弃和未确定的部分。

## 偏好生命周期

偏好不是一次性说明，而是从安装到每次反馈都可验证的长期配置：

1. **安装蒸馏**：从安装阶段的确认、已归档参考和实际短样中提炼 profile。JSON 必须保存 `revision`、`confirmed`、`profiles`、`scope`、模块及 adapter 哈希、`settings`、`output`、`policies`、参考索引和验证状态；正文保存证据、采纳范围、舍弃项与未知项。未经确认的内容写入 `candidates`，不写成默认规则。
2. **任务启动**：完整读取 JSON 和正文，按场景选择 profile。`Prepare-VideoTask.ps1` 冻结整份偏好、模块和 adapter；快照只冻结版本，不替换全局规则。style ID 是内部标识，不是用户给风格起的名字。
3. **日常实装**：本片先生成全片 `editorial-plan.json`，由 Agent 通读后统一决定 cuts、语义分段、保留/删除理由、presentation 和 policy evidence；`presentation.json`、`policy-review.json` 与原生分段转录均从 final 计划派生。预检从本片快照读取同一份 settings/policies，并检查派生文件哈希，不能按风格名猜测。
4. **反馈分类**：每条修改先按“本片一次性修正”“待验证候选”“明确长期偏好”分类。用户明确说“记住/以后都这样”时直接启动更新；反复出现且明显降低返工时主动询问是否蒸馏。用户沉默不算接受。
5. **写入后复读**：任何全局更新都要递增 `revision`，保留变更理由、证据和旧文件备份；写入后重新读取完整文件，检查同一字段及不同场景规则是否冲突。冲突必须覆盖、按场景细化或保留候选，未解决前暂停依赖冲突项的渲染。

### 可执行风格记录

偏好结构化不是把现有偏好写死，而是安装阶段的蒸馏结果。Agent 根据确认回答、参考分析和短样生成或更新 profile；日常任务只消费合同，不凭历史文件名猜风格。合同的唯一配置副本是 profile 内的 `settings`；不要同时在根级保存 captions、packaging 或另一个 styleModule。

```json
{
  "schemaVersion": 1,
  "revision": 4,
  "confirmed": true,
  "activeProfile": "profile-id",
  "profiles": {
    "profile-id": {
      "styleId": "internal-renderer-id",
      "styleRevision": 1,
      "scope": {"orientations": ["landscape", "portrait"], "content": "scoped content"},
      "module": {
        "path": "assets/renderer.ts",
        "adapter": "assets/renderer.adapter.json",
        "sha256": "<module hash>",
        "adapterSha256": "<adapter hash>"
      },
      "settings": {"captions": {}, "packaging": {}},
      "output": {"longEdge": 1920, "fpsPolicy": "preserve"},
      "policies": [{"id": "semantic-rule", "instruction": "...", "stage": "edit", "executor": "agent", "verification": "evidence-review"}],
      "validation": {"intent": "confirmed", "implementation": "pending", "evidence": []}
    }
  },
  "references": [], "knownNames": [], "conflicts": [], "candidates": []
}
```

`module` 指向实际渲染器，adapter 列出每个可配置叶字段的类型/范围，模块读取 `style.resolved.json`；因此新增字段若没有 adapter、消费者和测试会在验证时失败。`policies` 是 Agent 执行的语义、校色、声音和技术规则，每条都必须有执行阶段和证据状态。`settings` 驱动可机械验证的输出，`policies` 驱动需要素材判断的决策，`validation` 区分用户意图是否确认和实现是否已用短样/实际成片验证。

## 归档

```powershell
& '<skill>/scripts/Archive-VideoReference.ps1' -Source '<参考原片>' -ReferenceId 'ref-001' -Times 8,16,29,45,63
```

脚本独立复制原片、记录来源/大小/SHA256、探测参数、抽帧，重复执行核对原片哈希，不替换不同内容。若已存在分析/联系表，可复制归档。Agent 查看实际画面并写 analysis.md：画面组织、视觉主次、镜头变化、文字/转场/节奏依据、采纳范围和边界；相关时间段具体列出。竖屏录屏内嵌横屏内容需要裁出真正画面做代表帧。补充 keyframes 索引到 reference.json，然后将活跃 referenceId 加入总偏好。

每次发动读偏好与项目覆盖，并打开活跃参考的代表帧；存在动态判断时用 FFmpeg 提取对应短段或密集帧查看。没有视频/音频感知能力时区分静帧观察与实际听看，不能虚构对声音的判断。参考丢失时报告并修复，不声称仍已校准。

## 修改意见积累

先记录用户原话、对象、适用范围、本次落实和验证。明确“以后都如此”的规则启动更新；局部修正留在 task.md；反复出现但未确认的倾向记为候选并主动询问。更新后完整复读偏好并做冲突审计。当前任务指令优先，既有项目快照不静默改写。观察同类问题是否再出现、修改次数与耗时，不采集发布成效，不建设训练数据库。
