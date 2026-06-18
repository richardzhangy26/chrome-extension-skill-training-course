# 在调试模式中增加“指定 StepId 的语音 WebSocket 测试”

## 摘要
在 [auto_audio_train.py](/Users/zhangyichi/github/chrome-extension-skill-training-course/auto_audio_train.py) 中新增一个独立的“语音调试模式”，让用户先选择一个 `stepId` 作为切入点，再通过文本输入驱动 TTS 和音频 WebSocket 链路进行真实测试。进入该步骤后，后续流程继续按服务端返回的 `nextStep` 正常推进，目标是验证“语音模式下从指定步骤跳转并继续 runCard / step 流转”是否正确。

## 关键改动
### 1. CLI 与调试入口
- 在现有模式菜单上新增 `3. 语音调试模式`。
- 进入该模式后，先调用与现有仓库一致的步骤列表接口：
  - `POST /teacher-course/abilityTrain/queryScriptStepList`
  - 读取 `stepId / stepName / stepOrder / nodeType`
- 过滤掉 `SCRIPT_START` 和 `SCRIPT_END`，提供一个命令行选择器：
  - 支持按关键字筛选 `stepName / stepId`
  - 支持输入列表序号或直接输入完整 `stepId`
- 选定后将该 `stepId` 记为“调试切入步骤”，并在终端打印当前调试目标。

### 2. WebSocket 启动与流程推进
- `TrainingClient` 增加调试配置字段，至少包含：
  - `debug_start_step_id`
  - `debug_start_step_name`
  - `dynamic_tts_enabled`
  - `debug_mode_enabled`
- 将 `start_script()` 改为支持 `step_id_override`，在收到 `connected` 事件后，如果处于调试模式，就用用户选定的 `stepId` 发 `startScript`，而不是服务端默认返回的起始步骤。
- 保留当前 `stepEnd -> nextStep -> botAnswer` 的既有状态机，不做“单步锁定”。
- 调试模式只负责“跳入指定步骤”，跳入之后继续按真实流程往后走，直到用户退出或任务结束。
- 日志中补充调试上下文：
  - 本次是否为 debug 模式
  - 初始跳转的 `stepId / stepName`
  - 每轮实际使用的 TTS 语言

### 3. 调试模式输入与动态 TTS
- 新增独立的 `debug_interactive_mode()`，只保留“纯手动文本输入”：
  - 普通文本：发送到当前语音链路
  - `quit`：退出调试模式并断开连接
  - `Ctrl+C`：与现有行为一致，安全退出
- 调试模式下不使用现有“回车自动生成回答 / 学生档位 / 知识库 / 参考对话”逻辑；这些能力继续保留在原半交互模式，不混入 debug 模式。
- TTS 选择从“会话级固定语言”改为“消息级动态判定”：
  - 新增 `detect_text_language(text)` 纯函数
  - 规则固定为：只要文本中包含中文字符就走中文 TTS，否则走英文 TTS
- 为避免重复初始化，缓存两个 `TTSEngine` 实例：
  - `zh -> zh-CN-XiaoxiaoNeural`
  - `en -> en-US-GuyNeural`
- `speak()` 改为按当前文本动态取对应引擎；原普通模式仍可继续使用当前选定语言，不改变现有用户路径。

## 接口/行为变更
- 菜单层新增 `语音调试模式` 入口，属于脚本的可见行为变更。
- `TrainingClient.run(mode=...)` 新增 `debug` 分支。
- `TrainingClient.start_script()` 增加可选的 `step_id_override` 参数。
- 新增内部辅助接口：
  - `query_script_steps(task_id) -> list[dict]`
  - `prompt_debug_step_selection(steps) -> tuple[step_id, step_name]`
  - `detect_text_language(text) -> "zh" | "en"`
  - `get_tts_engine_for_text(text) -> TTSEngine`

## 测试与验收
- 静态检查：
  - `python -m py_compile /Users/zhangyichi/github/chrome-extension-skill-training-course/auto_audio_train.py`
- 手工验收场景：
  1. 进入调试模式，能拉到步骤列表并成功选中一个非首步骤。
  2. 连接成功后，`startScript` 实际发送的 `stepId` 是所选调试步骤。
  3. 输入纯英文文本时，日志显示使用英文 voice，服务端能收到音频并返回识别/回复。
  4. 输入纯中文文本时，日志显示使用中文 voice，链路正常。
  5. 从指定步骤进入后，收到 `stepEnd / nextStepId` 时，客户端继续按真实流程推进，不会被锁死在首个调试步。
  6. 输入 `quit` 或 `Ctrl+C` 时，能安全断开 websocket 并退出，不残留挂起任务。
  7. 普通半交互模式和手动模式行为不回归。

## 假设与默认值
- 本次只改 [auto_audio_train.py](/Users/zhangyichi/github/chrome-extension-skill-training-course/auto_audio_train.py)，不顺带抽公共 Python 基础库。
- 不新增 Python 测试框架；本次以纯函数可读性、`py_compile` 和手工链路验证为准。
- 调试模式的目标是“指定步骤切入并继续真实语音流程”，不是“卡在单步反复压测”。
- 退出调试模式等同于结束本次脚本运行；如果要换另一个 `stepId`，重新进入脚本即可。
