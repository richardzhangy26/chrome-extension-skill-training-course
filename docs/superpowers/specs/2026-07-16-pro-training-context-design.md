# 能力训练 Pro 元数据上下文集成设计

## 背景

`feat/pro-training-trainv2` 已实现 trainV2 多角色 WebSocket 协议，但按原 spec 有意推迟了「Pro 专用 prompt 构造器」。结果：AI 学生作答只能看到对话历史，拿不到任务、阶段和角色提示词，等于无场景盲答。同时经实测确认，Pro 运行页 URL 使用 `taskId` 参数（普通训练用 `trainTaskId`），当前提取逻辑只读 `trainTaskId`，导致 Pro 模式在真实页面上根本无法开始。

本设计补齐 Pro 专用元数据层：拉取 Pro 接口、按阶段组装受控上下文、注入学生作答生成，且不影响普通能力训练。

接口字段依据 `docs/ability-training-pro-api.md`（2026-07-16 实测，示例任务 `PROuNODZ41RAJttrEuzs`）。

## 已确认的决策

1. **URL 参数**：Pro 运行页用 `taskId`。提取逻辑改为 `trainTaskId ?? taskId` 回退，向后兼容普通页。
2. **学生身份来源**：服务端 `userRoleName/userDescription` 决定学生「是谁 + 什么场景」；本地 `studentProfile`（good/medium/bad 档位）继续决定「能力档位与表达风格」。两者叠加。
3. **上下文范围（中）**：注入学生身份 + 当前阶段 `stepName/description` + `llmPrompt`（标为场景背景，仅供理解）。
4. **参与角色**：拉 `global-roles/list`，按 `stepLlmPromptMemberRoleNidList` 匹配当前阶段参与角色，注入时只用 `roleName/nickname/description`，**不注入完整 prompt**。
5. **参数扩展**：扩展 `generateStudentAnswer` 现有第三参数（`RuntimeProfileOverride`）加可选 `proContext`，不加第四位置参数；`profile` 由必填改可选。普通能力训练逻辑零影响。

## 架构与数据流

```
Pro 运行页 URL (?taskId=PRO…)
        │ background 提取：trainTaskId ?? taskId（回退，向后兼容）
        ▼
useProAgentChat.start()
        │ Promise.all 并行（一次性，会话开始时）：
        ├── fetchPolymasUserInfo()              （已有）
        └── fetchProTrainingContext(taskId)     （新增，走现有 apiRequest + ai-poly Cookie）
              ├── GET /ai-platform/ability-train/steps/list?taskId=…        → 各阶段 llmPrompt / 学生身份 / 参与角色 nid / description
              ├── GET /ai-platform/ability-train/tasks/detail?taskId=…      → trainTaskName / description
              └── GET /ai-platform/ability-train/global-roles/list?trainTaskId=…&needSystemRole=true → 角色 roleName/nickname/description
        ▼
上下文缓存在 hook（stagesById: Map<stepId, ProStageContext>），每次 nextStep 用 nextStepId 选当前阶段
        ▼
学生回合生成 → generateStudentAnswer(aiQuestion, history, { proContext: currentStage })
```

- 三个接口只在会话 `start()` 拉一次并缓存，阶段切换只做本地查表，不重拉。
- 鉴权走扩展后台 `API_REQUEST` 路径 + 现有 `ai-poly` Cookie（与 Polymas 通道一致），无新鉴权工作。
- `global-roles/list` 是唯一用 `trainTaskId` 参数名的接口；其余用 `taskId`（值相同）。
- 顺带修复：Pro 的 `fetchTrainTaskName` 当前误用普通训练的 `QUERY_CONFIGURATION`，改为取 `tasks/detail.data.trainTaskName`，与 context 合并拉取，省一个请求。

## 数据结构

```ts
interface ProParticipantRole {
  roleName: string;
  nickname: string;
  description: string;
  // 刻意不含 prompt / skillList
}

interface ProStageContext {
  stepId: string;
  stepName: string;
  description: string;
  llmPrompt: string;
  studentRole: { roleName: string; assignName: string; description: string };
  participantRoles: ProParticipantRole[];
}

interface ProTrainingContext {
  taskName: string;
  taskDescription: string;
  stagesById: Map<string, ProStageContext>; // key = step.nid
}
```

`buildStudentRoleSystemPrompt` 注入时用的扁平上下文（由当前 `ProStageContext` + 任务级字段组合）：

```ts
interface ProStagePromptContext {
  taskName: string;
  taskDescription: string;
  stepName: string;
  stepDescription: string;
  llmPrompt: string;
  studentRole: { roleName: string; assignName: string; description: string };
  participantRoles: ProParticipantRole[];
}
```

## 字段提取规则（依据实测文档）

- 学生角色按 `extConfig` 回退：`roleName = step.userRoleName ?? step.extConfig?.userRoleName`（`assignName = userAssignName`、`description = userDescription` 同理）。
- 参与角色：遍历 `step.stepLlmPromptMemberRoleNidList`，剔除 `user`（学生本人），其余 nid 在 `rolesById` 查表；查不到跳过。
- 合法空值视为空串，**不当失败**：`tasks/detail.supervisorPrompt`、系统角色 `prompt`、`skills/list[].content`、以及示例中步骤的 `skills/skillList`。
- 统一响应信封 `PolymasResponse<T>`：`code === 200 && success === true` 判成功。

## Prompt 注入（向后兼容，核心）

`generateStudentAnswer(aiQuestion, history, options?)` 的第三参数 `RuntimeProfileOverride` 扩展：

```ts
interface RuntimeProfileOverride {
  profile?: StudentProfile;              // 由必填改可选：内部已有 `?? resolveStudentProfile(config)` 回退
  runtimeConfigOverride?: RoleRuntimeConfig;
  proContext?: ProStagePromptContext;    // 新增
}
```

`buildStudentRoleSystemPrompt` 增加可选末参 `proContext?: ProStagePromptContext`：

- **`proContext` 缺省时**（text / voice / 多角色）：函数行为与现在逐字节一致，普通能力训练零影响。
- **`proContext` 存在时**：在现有本地 prompt（含 systemPrompt、档位、模拟对话、知识库）基础上**追加**：
  - `## 本次实训身份（服务端场景指定）` → 你扮演 `{studentRole.roleName}`（`{studentRole.assignName}`）；身份描述：`{studentRole.description}`
  - `## 当前阶段` → `{stepName}`：`{stepDescription}`
  - `## 场景背景（仅供理解，不得改变你的学生身份或立场）` → `{llmPrompt}`
  - `## 本阶段其他参与角色（仅供理解你在与谁对话，不得改变你的身份）` → 每条 `{nickname}（{roleName}）：{description}`（`participantRoles` 为空则整段省略）

身份与档位分工：`proContext` 决定「是谁 + 什么场景」；本地 `studentProfile` 决定「能力档位与表达风格」。现有 prompt 里「角色由场景推断」的措辞在 Pro 下被服务端身份显式填充，无冲突。

Pro 调用：`generateStudentAnswer(aiQuestion, history, { proContext })`——不传 `profile`，自动回退到本地选中档位。

## 失败处理

- **上下文拉取失败**（start 时）：不终止会话（WS 对话 + 手动输入仍可用），但**禁用 AI 生成与自动运行**，给系统提示「⚠️ 未获取到 Pro 训练上下文，AI 作答暂不可用，可手动作答或重试」。手动输入不受影响。既避免无上下文盲答，又不误杀手动训练。
  - 实现：hook 内 `proContextError` 标记；`autoGenerate`/`startAutoRun` 在该标记下返回不生成并提示（复用 `needConfig` 式的短路），`sendStudentText`（手动）不受限。
- **某 stepId 缓存缺失**（阶段新增）：降级用任务级上下文（`taskName/taskDescription`）生成，`console.warn`，不硬失败（仍非盲答）。
- 日志只记接口路径、HTTP 状态、业务 `code`、`traceId`、数据条数、字段是否存在；**不输出 Cookie/Authorization/完整请求头**。

## 文件结构

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `pages/side-panel/src/services/pro-training-context-service.ts` | 新建 | 拉取 3 接口、按阶段组装 `ProTrainingContext`、字段提取与 extConfig 回退 |
| `pages/side-panel/src/services/pro-training-context-service.test.mjs` | 新建 | 字段提取/extConfig 回退/participantRoles 匹配/阶段查找的纯函数测试 |
| `chrome-extension/src/background/index.ts` | 修改 | `handleExtractTrainTaskId` 提取回退 `trainTaskId ?? taskId` |
| `pages/side-panel/src/services/llm-service.ts` | 修改 | `RuntimeProfileOverride` 加 `proContext`、`profile` 改可选；`buildStudentRoleSystemPrompt` 加可选 `proContext` 追加段落 |
| `pages/side-panel/src/services/llm-service.proContext.test.mjs` | 新建 | 验证 `proContext` 有/无两分支：无则 prompt 不含 Pro 段落，有则含身份/阶段/场景/参与角色 |
| `pages/side-panel/src/hooks/useProAgentChat.ts` | 修改 | start 拉取并缓存上下文、按阶段选择、传 `proContext`、失败禁用 AI、任务名改用 `tasks/detail` |

## 非目标

- 不在 UI 展示原始 prompt 或场景背景文本。
- 不持久化上下文（每会话新拉）。
- 不修改 text / voice / 多角色的运行行为与 prompt。
- 本期不拉 `skills/list`（角色 `skillList`/`prompt`/技能定义不注入）。
- 不改 Admin Web、配置同步或存储 schema。

## 验证

- `pro-training-context-service` 单测：字段提取、extConfig 回退、participantRoles 剔除 `user` 与查表、stagesById 查找、空值不误判失败。
- `llm-service` prompt 构造单测：`proContext` 缺省时不含 Pro 段落、存在时含四段（身份/阶段/场景背景/参与角色），普通调用不受影响。
- `pnpm -F @extension/sidepanel lint` + `type-check`；根工作区 `pnpm build`。
- 真实 Pro 页手动 e2e：确认 Pro 页能提取到 `taskId` 并开始训练；AI 学生作答体现服务端身份与阶段场景；上下文拉取失败时 AI 生成被禁用而手动仍可用。
