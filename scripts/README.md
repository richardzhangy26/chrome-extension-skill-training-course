# 对话链路模拟脚本

## 脚本文件

- `replay_chain.py` - 按 system → assistant → user 时序重放对话日志
- `simulate_llm_dialogue_test.py` - 基于对话日志调用 LLM 测试接口（前置参考）

---

## replay_chain.py 使用说明

### 功能

1. 解析对话日志文件（格式如 `test.txt`）
2. 构建完整的 system → assistant → user 交互链路
3. 按指定轮数重复模拟，每次间隔 1 秒
4. 控制台打印每一步的 role、timestamp、message 预览
5. 输出 JSON Lines 格式 log 文件
6. 自动断言验证：
   - 总行数与预期一致
   - 角色顺序严格匹配 system→assistant→user 循环

### 依赖安装

**无需安装任何第三方库**，仅使用 Python 标准库。

### 启动命令

```bash
# 默认运行（1 轮，输出到 replay_output.log）
python scripts/replay_chain.py

# 指定轮数（如 3 轮）
python scripts/replay_chain.py --round 3

# 指定日志文件和输出文件
python scripts/replay_chain.py --log-file test.txt --output-log my_run.log

# 静默模式（只写文件，不打印控制台）
python scripts/replay_chain.py --round 5 --quiet

# 使用自定义 system prompt
python scripts/replay_chain.py --system-prompt-file ./my_prompt.txt --round 2
```

### 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--log-file` | `test.txt` | 对话日志文件路径 |
| `--round` | `1` | 重复模拟次数，每次间隔 1 秒 |
| `--output-log` | `replay_output.log` | 输出 log 文件路径 |
| `--system-prompt-file` | `None` | 自定义 system prompt 文件路径 |
| `--quiet` | `False` | 抑制控制台逐条输出 |

### 输出格式

**控制台输出示例：**

```
📂 对话文件   : /path/to/test.txt
🔗 链路长度   : 4 条  角色序列: ['system', 'assistant', 'user', 'assistant']
🔁 模拟轮数   : 3
💾 输出文件   : replay_output.log
================================================================================
  timestamp                           role         message preview
--------------------------------------------------------------------------------

── Round 1/3 ──────────────────────────────────────────────────────────────────
  2026-03-20T04:17:31.744+00:00  [system   ]  你是一名能力训练助手...
  2026-03-20T04:17:31.767+00:00  [assistant]  各位同学好～ 我是苏晴...
  ...
```

**Log 文件格式（JSON Lines）：**

```json
{"round": 1, "role": "system", "timestamp": "2026-03-20T04:17:31.744+00:00", "message": "你是一名能力训练助手...", "step_name": "", "step_id": "", "source": "init", "round_num": null}
{"round": 1, "role": "assistant", "timestamp": "2026-03-20T04:17:31.767+00:00", "message": "各位同学好～ 我是苏晴...", "step_name": "知识点梳理与讲解框架搭建", "step_id": "VL-jml5A4CZzapkjRQW5o", "source": "runCard", "round_num": null}
```

### 验证步骤

脚本末尾自动执行断言：

```
✅ 断言通过：共 12 行，角色顺序严格匹配 ['system', 'assistant', 'user', 'assistant']（循环 3 次）。
```

若验证失败，脚本将输出具体错误并返回非 0 退出码：

```
❌ 断言失败：
   总行数不符：期望 12，实际 8
   第 3 行角色不符：期望 'user'，实际 'assistant'
```

### 人工验证

查看生成的 log 文件：

```bash
# 查看总行数
wc -l replay_output.log

# 查看所有 system 消息
cat replay_output.log | jq 'select(.role == "system") | .role'

# 验证角色顺序
cat replay_output.log | jq '.role' | head -20
```

### 退出码说明

| 退出码 | 含义 |
|--------|------|
| 0 | 成功，所有断言通过 |
| 1 | 失败，日志文件不存在、解析错误或断言失败 |

---

## 测试日志格式要求

输入日志文件需符合以下格式：

```
对话记录
日志创建时间: 2026/03/18 17:43:00
任务名称: xxx
task_id: xxx
...
============================================================
Step: 步骤名称 | step_id: xxx | 来源: runCard
AI: AI 消息内容
----------------------------------------
Step: 步骤名称 | step_id: xxx | 第 2 轮 | 来源: chat
用户: 用户消息内容
----------------------------------------
```

---

## 与 simulate_llm_dialogue_test.py 的关系

- `simulate_llm_dialogue_test.py`: 完整复现前端的 LLM 组包逻辑，**实际调用 LLM API**
- `replay_chain.py`: 仅重放 system→assistant→user 链路，**不调用 LLM**，用于验证时序和日志结构
