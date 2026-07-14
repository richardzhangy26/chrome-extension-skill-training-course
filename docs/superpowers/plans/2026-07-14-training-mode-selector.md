# 训练模式下拉框实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将侧边栏 Header 的文字/口语二态按钮改为包含“能力训练、口语训练、能力训练 Pro”的三态下拉框，并让 Pro 暂时复用文字训练。

**Architecture:** 保留 `ModeToggle.tsx` 作为纯展示和交互组件，由 `SidePanel.tsx` 继续持有模式状态与训练会话清理逻辑。`TrainingMode` 扩展为 `text | voice | pro`，只有 `voice` 进入语音分支，其余模式共用文字分支。

**Tech Stack:** TypeScript、React、Tailwind CSS、Vite、Chrome Extension MV3。

## Global Constraints

- 遵循 DRY、SOLID、KISS，并优先沿用现有组件和 workspace 约定。
- 不修改文字、语音、多角色训练 hook，不新增后端、权限、依赖或存储 schema。
- 不实现能力训练 Pro 的独立业务逻辑，也不持久化 Pro 为默认启动模式。
- 训练进行中必须继续禁用模式切换；切换模式必须清理现有文字、多角色和语音会话。
- 现有 `llmConfigStorage.voiceModeEnabled` 只在 `voice` 模式下写入 `true`。

---

## 文件结构

- 修改 `pages/side-panel/src/components/ModeToggle.tsx`：定义三态模式元数据并实现受控下拉框、关闭逻辑与可访问性。
- 修改 `pages/side-panel/src/SidePanel.tsx`：显示三态标题、让 Pro 复用文字训练、调整忙碌判断及默认口语存储写入。

### Task 1: 实现三态模式选择器

**Files:**
- Modify: `pages/side-panel/src/components/ModeToggle.tsx`

**Interfaces:**
- Consumes: `mode: TrainingMode`、`onChange(mode: TrainingMode): void`、`disabled?: boolean`。
- Produces: `type TrainingMode = 'text' | 'voice' | 'pro'`；保持 `ModeToggle` 和 `TrainingMode` 的现有导出名不变。

- [ ] **Step 1: 记录现有类型检查基线**

Run: `pnpm -F @extension/sidepanel type-check`

Expected: PASS；若失败，只记录与本功能无关的既有错误，不修改无关模块。

- [ ] **Step 2: 扩展模式类型与单一元数据源**

将模式类型与展示信息改为：

```tsx
type TrainingMode = 'text' | 'voice' | 'pro';

interface ModeOption {
  value: TrainingMode;
  label: string;
  icon: 'text' | 'voice' | 'pro';
}

const MODE_OPTIONS: ModeOption[] = [
  { value: 'text', label: '能力训练', icon: 'text' },
  { value: 'voice', label: '口语训练', icon: 'voice' },
  { value: 'pro', label: '能力训练 Pro', icon: 'pro' },
];
```

使用 `MODE_OPTIONS` 同时驱动触发器当前文案和菜单选项，避免重复维护名称。

- [ ] **Step 3: 实现下拉交互**

使用 `useEffect`、`useRef`、`useState` 管理菜单：

```tsx
const [isOpen, setIsOpen] = useState(false);
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!isOpen) return;

  const handlePointerDown = (event: MouseEvent) => {
    if (!containerRef.current?.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  document.addEventListener('mousedown', handlePointerDown);
  document.addEventListener('keydown', handleKeyDown);
  return () => {
    document.removeEventListener('mousedown', handlePointerDown);
    document.removeEventListener('keydown', handleKeyDown);
  };
}, [isOpen]);
```

触发器使用 `aria-haspopup="listbox"`、`aria-expanded` 和明确的 `aria-label`。选项使用原生 `button`，菜单容器使用 `role="listbox"`，选项使用 `role="option"` 和 `aria-selected`。点击当前选项只关闭菜单；点击其他选项先调用 `onChange(option.value)` 再关闭菜单。

- [ ] **Step 4: 对齐 Header 样式**

触发器保留 `bg-white/15`、`backdrop-blur-sm`、圆角、白色文字以及 disabled 样式；菜单定位在触发器下方，使用白色面板、阴影、边框和高对比文字。当前项增加浅蓝底色与勾选图标，Pro 项使用简洁的闪光图标，不增加外部图标依赖。

- [ ] **Step 5: 运行组件静态检查**

Run: `pnpm -F @extension/sidepanel lint`

Expected: PASS，无可访问性、Hooks 或导出顺序错误。

### Task 2: 接入 Pro 模式并复用文字训练

**Files:**
- Modify: `pages/side-panel/src/SidePanel.tsx`

**Interfaces:**
- Consumes: Task 1 输出的 `TrainingMode = 'text' | 'voice' | 'pro'`。
- Produces: 三态 Header 标题与模式路由；现有 `handleChangeMode(nextMode: TrainingMode): void` 签名保持不变。

- [ ] **Step 1: 增加 Header 标题映射**

在 Header 附近增加单一映射：

```tsx
const TRAINING_MODE_TITLES: Record<TrainingMode, string> = {
  text: '能力训练助手',
  voice: '口语训练助手',
  pro: '能力训练助手 Pro',
};
```

将标题表达式替换为：

```tsx
<h1 className="text-lg font-semibold tracking-tight text-white">{TRAINING_MODE_TITLES[mode]}</h1>
```

- [ ] **Step 2: 保持 Pro 使用文字分支**

所有现有 `mode === 'voice'` 条件保持语义不变：只有 `voice` 渲染语音 Header 数据、语音主体和语音任务信息，因此 `text` 与 `pro` 自动落入文字训练分支。不要增加重复的 Pro 内容组件。

- [ ] **Step 3: 修正模式存储与忙碌判断**

保持切换前的会话重置，并将存储写入保留为：

```tsx
void llmConfigStorage.setConfig({ voiceModeEnabled: nextMode === 'voice' });
```

将禁用判断改为按语音与非语音划分：

```tsx
const modeToggleDisabled = mode === 'voice' ? voiceBusy : textBusy;
```

这保证 Pro 复用文字训练时也遵守文字状态机的忙碌约束。

- [ ] **Step 4: 运行类型检查和 lint**

Run: `pnpm -F @extension/sidepanel type-check`

Expected: PASS，所有 `TrainingMode` 分支类型完整。

Run: `pnpm -F @extension/sidepanel lint`

Expected: PASS，无新增 ESLint 错误。

### Task 3: 集成验证与提交

**Files:**
- Verify: `pages/side-panel/src/components/ModeToggle.tsx`
- Verify: `pages/side-panel/src/SidePanel.tsx`

**Interfaces:**
- Consumes: Task 1 的三态下拉框与 Task 2 的模式路由。
- Produces: 可构建的侧边栏三态模式选择功能。

- [ ] **Step 1: 运行侧边栏生产构建**

Run: `pnpm -F @extension/sidepanel build`

Expected: PASS，Vite 生成侧边栏产物且无 TypeScript/Vite 错误。

- [ ] **Step 2: 运行仓库生产构建**

Run: `pnpm build`

Expected: PASS，扩展所有 workspace 成功打包到 `dist/`。

- [ ] **Step 3: 检查差异和格式**

Run: `git diff --check`

Expected: PASS，无尾随空格或冲突标记。

Run: `git diff -- pages/side-panel/src/components/ModeToggle.tsx pages/side-panel/src/SidePanel.tsx`

Expected: 仅包含三态选择器、标题映射、模式路由和忙碌判断相关改动。

- [ ] **Step 4: 手动验收**

在加载 `dist/` 的侧边栏中确认：

1. 默认显示“能力训练”，菜单包含三个约定选项。
2. 选择“口语训练”后标题和主体切到口语训练。
3. 选择“能力训练 Pro”后标题显示“能力训练助手 Pro”，主体仍为文字训练。
4. 点击组件外部或按 `Escape` 能关闭菜单。
5. 文字、Pro 或口语训练忙碌时，选择器禁用且不能打开。

- [ ] **Step 5: 提交实现**

```bash
git add pages/side-panel/src/components/ModeToggle.tsx pages/side-panel/src/SidePanel.tsx
git commit -m "feat(side-panel): add training mode selector"
```
