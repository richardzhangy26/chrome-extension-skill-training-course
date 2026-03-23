# 多角色并行运行 P0 实施方案（确认版）

## 分期策略

| 阶段 | 范围 | 状态 |
|------|------|------|
| **P0（本期）** | 多角色选择 + 共享全局知识库/对话剧本，仅 `profile` 区分角色 | 进行中 |
| **P1（后期）** | 每角色独立知识库 / 对话剧本临时配置 | 待定 |

## Summary

- 保留现有"单角色运行"主链路完全不动，新增一条"多人运行"增量链路。
- 多人运行入口放在知识库区域下方，支持从 `llmConfig.studentProfiles` 多选角色。
- **P0 阶段所有角色共享当前全局知识库/对话剧本配置**，角色之间的核心差异仅为 `studentProfile`（好/中/差学生）。
- 多人运行采用**轮询串行推进**（round-robin），角色间最小间隔 500ms，避免 API rate limit。
- 手动输入仅发给当前选中角色。
- 历史记录按每个角色独立会话保存，复用现有 `agentLogStorage` + `HistoryModal`，零 schema 改动。

## Key Changes

### 1. LLM 接口最小扩展（llm-service.ts）

```typescript
// P0: runtimeOverride 仅覆盖 profile
generateStudentAnswer(aiQuestion, history, runtimeOverride?)

interface RuntimeOverride {
  profile: StudentProfile;  // P0 唯一差异点
  // P1 扩展预留（本期不实现）：
  // dialogueSimulationEnabled?: boolean;
  // dialogueSimulationContent?: string;
  // knowledgeBaseEnabled?: boolean;
  // knowledgeBaseContent?: string;
}
```

- 当传入 `runtimeOverride.profile` 时，覆盖 `resolveStudentProfile()` 的结果
- `apiKey/apiUrl/model/temperature` 等 LLM 连接参数始终走全局配置，不可 override
- 不传 `runtimeOverride` 时行为与现有完全一致

### 2. 新增多人运行类型（multi-role-types.ts）

```typescript
// 角色选择草稿
interface RoleRunDraft {
  profileId: string;
  profileLabel: string;
}

// 单角色运行时状态
interface RoleRunState {
  profileId: string;
  profileLabel: string;
  sessionId: string | null;       // 初始 null，首轮 runCard 回填，绝不复用
  currentStepId: string | null;
  messages: ChatMessage[];
  workflowState: WorkflowState;
  dialogueRound: number;
  logSessionId: string | null;
}

// 多人运行批次
interface MultiRoleRunBatch {
  batchId: string;
  trainTaskId: string;
  roles: RoleRunState[];
  activeRoleIndex: number;        // 当前展开/选中的角色索引
  batchState: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'ERROR';
}
```

**关键约束**：每个 `RoleRunState.sessionId` 必须独立，初始为 `null`，首次 `runCard` 返回后写入，严禁跨角色复用。

### 3. 新增多人运行调度 Hook（useMultiRoleRun.ts）

- 新建文件，**不侵入** `useAgentChat.ts`
- 共享一次 `trainTaskId` 与 `queryScriptStepList` 获取
- 为每个角色创建独立 `runCard/chat` 会话与 `agentLogStorage` session
- 自动运行时按角色轮询推进（round-robin），角色间间隔 ≥ 500ms
- 某角色失败不影响其他角色继续

### 4. UI 改造

#### 入口（SimulationConfigModal.tsx 知识库区下方）
- 新增"多人运行"按钮，点击打开角色选择弹窗

#### 角色选择弹窗（MultiRolePickerModal.tsx）
- 多选角色（checkbox），来源为 `llmConfig.studentProfiles`
- 显示角色名 + 简要描述
- 确认后触发多人运行

#### 多人对话视图（SidePanel.tsx 新增渲染分支）
- 单窗口折叠分组卡片：
  - **折叠态**：角色名 + 状态图标 + 进度（n/N 步）
  - **展开态**：最近 3 条消息摘要 + "查看完整对话"（跳转历史弹窗）
  - **同一时间只允许一个角色全展开**
- 保持现有渐变/间距设计体系

### 5. 历史记录（零改动策略）

- 继续用现有 `agentLogStorage.createSession()`，每个角色建独立 session
- 会话命名格式：`{taskName}-{profileLabel}-{batchId前4位}`
- `HistoryModal.tsx` 无需改动，已有能力展示独立会话

## Public API / Type Changes

| 变更点 | 类型 | 描述 |
|--------|------|------|
| `generateStudentAnswer` | 签名扩展 | 新增第三个可选参数 `runtimeOverride?: { profile: StudentProfile }` |
| `RoleRunDraft` | 新增类型 | 多人选角草稿 |
| `RoleRunState` | 新增类型 | 单角色运行时状态 |
| `MultiRoleRunBatch` | 新增类型 | 多人运行批次容器 |
| `llm-config-storage` | **不变** | 避免迁移风险，多人配置仅运行期内存态 |

## 实施顺序（按依赖层级）

```
Step 1: llm-service.ts — 加 runtimeOverride.profile（纯函数改动，可独立验证）
Step 2: 新增 multi-role-types.ts（RoleRunDraft / RoleRunState / MultiRoleRunBatch）
Step 3: 新建 useMultiRoleRun.ts 调度 hook（先纯逻辑，不连 UI）
Step 4: 新建 MultiRolePickerModal.tsx（角色选择弹窗）
Step 5: SidePanel.tsx 加多人折叠视图渲染分支
Step 6: SimulationConfigModal.tsx 知识库区下加"多人运行"入口按钮
```

## Test Plan

- **回归**：单角色模式全链路不回归（启动 / 手动 / AI自动 / 全自动 / 历史下载）
- **多角色**：
  - 多选角色启动，每个角色独立 sessionId
  - 轮询串行推进，间隔 ≥ 500ms
  - 某角色失败不阻塞其他角色
  - 手动输入仅发给当前选中角色
- **历史记录**：每个角色独立会话，命名含角色标识
- **视觉验收**：折叠卡片在窄侧栏（~360px）不溢出，保持渐变/间距体系

## Assumptions & Defaults

- 角色来源：`llmConfig.studentProfiles` 全量可选（默认三档：好/中/差学生）
- 知识库/对话剧本：P0 共享全局配置，P1 再做角色级独立配置
- 默认值：`runtimeOverride` 不传时完全走全局配置，零行为变化
- 并行策略：轮询串行（非并发），角色间 ≥ 500ms 间隔
- 手动输入：仅作用于当前选中角色
- sessionId 生命周期：每角色独立，初始 null → 首轮 runCard 回填 → 绝不复用
