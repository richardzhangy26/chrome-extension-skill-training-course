#!/usr/bin/env python3
"""
replay_chain.py
按 system → assistant → user 时序完整重放对话日志链路。

用法:
  python scripts/replay_chain.py --log-file test.txt --round 3
  python scripts/replay_chain.py --log-file test.txt --round 1 --output-log ./out.log --quiet

依赖: 仅标准库，无需额外安装。
"""

import argparse
import json
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

# ── 数据类（与 simulate_llm_dialogue_test.py 一致）─────────────────────────


@dataclass
class DialogueBlock:
    step_name: str
    step_id: str
    source: str
    round_num: Optional[int]
    user_text: Optional[str]
    ai_text: Optional[str]


@dataclass
class TimelineMessage:
    role: str
    content: str
    step_name: str
    step_id: str
    source: str
    round_num: Optional[int]


# ── 默认 System Prompt（与前端 llm-service.ts 一致）────────────────────────

DEFAULT_SYSTEM_PROMPT = "\n".join(
    [
        "你是一名能力训练助手，需要严格按照给定的学生档位扮演角色。",
        "",
        "## 问题类型识别（优先级最高）",
        "如果当前问题属于以下类型，请优先直接回答，不需要强制体现性格特点：",
        "1. **确认式问题**: 如'你准备好了吗？请回复是或否'、'确认的话请回复是'",
        "   → 直接回答'是'、'好的'、'确认'等",
        "2. **选择式问题**: 如'你选择A还是B？'、'请选择1/2/3'",
        "   → 直接说出选项，如'我选择A'、'选1'",
        "3. **角色确认问题**: 如'你是学生还是老师？'",
        "   → 直接回答角色，如'学生'",
        "",
        "**判断标准**: 如果问题中包含'请回复'、'请选择'、'是或否'、'A/B/C'等明确指示，则为封闭式问题。",
        "",
        "## 输出要求（按优先级执行）",
        "**优先级1**: 如果是封闭式问题（确认式/选择式/角色确认），直接简短回答",
        "**优先级2**: 如果示例对话中有高度相关的回答，请优先引用或改写",
        "**优先级3**: 如果是开放式问题，再适度融入学生档位特点",
        "**格式要求**: 仅返回学生回答内容，不要额外解释，控制在50字以内。",
    ]
)

# ── 解析日志（复用 simulate_llm_dialogue_test.py 逻辑）─────────────────────


def parse_dialogue_log(log_path: Path) -> List[DialogueBlock]:
    content = log_path.read_text(encoding="utf-8")
    raw_blocks = [b.strip() for b in content.split("-" * 40) if b.strip()]
    parsed: List[DialogueBlock] = []

    for block in raw_blocks:
        lines = [line.rstrip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue

        header_index = next(
            (i for i, line in enumerate(lines) if line.startswith("Step: ")), -1
        )
        if header_index < 0:
            continue

        header = lines[header_index]
        step_name = ""
        step_id = ""
        source = "chat"
        round_num: Optional[int] = None

        for part in [p.strip() for p in header.split("|")]:
            if part.startswith("Step: "):
                step_name = part[len("Step: ") :].strip()
            elif part.startswith("step_id:"):
                step_id = part[len("step_id:") :].strip()
            elif part.startswith("第 ") and part.endswith(" 轮"):
                try:
                    round_num = int(part[len("第 ") : -len(" 轮")].strip())
                except ValueError:
                    pass
            elif part.startswith("来源:"):
                source = part[len("来源:") :].strip()

        user_lines: List[str] = []
        ai_lines: List[str] = []
        current_role: Optional[str] = None

        for line in lines[header_index + 1 :]:
            if line.startswith("用户:"):
                current_role = "user"
                user_lines.append(line[len("用户:") :].strip())
            elif line.startswith("AI:"):
                current_role = "assistant"
                ai_lines.append(line[len("AI:") :].strip())
            elif current_role == "user":
                user_lines.append(line.strip())
            elif current_role == "assistant":
                ai_lines.append(line.strip())

        parsed.append(
            DialogueBlock(
                step_name=step_name,
                step_id=step_id,
                source=source,
                round_num=round_num,
                user_text="\n".join(p for p in user_lines if p).strip() or None,
                ai_text="\n".join(p for p in ai_lines if p).strip() or None,
            )
        )

    return parsed


def build_timeline(blocks: List[DialogueBlock]) -> List[TimelineMessage]:
    """按原始日志顺序展开为 assistant / user 消息列表。"""
    timeline: List[TimelineMessage] = []
    for block in blocks:
        # AI 先于同 block 内的 user（runCard 消息只含 AI，chat 消息只含 user）
        if block.ai_text:
            timeline.append(
                TimelineMessage(
                    role="assistant",
                    content=block.ai_text,
                    step_name=block.step_name,
                    step_id=block.step_id,
                    source=block.source,
                    round_num=block.round_num,
                )
            )
        if block.user_text:
            timeline.append(
                TimelineMessage(
                    role="user",
                    content=block.user_text,
                    step_name=block.step_name,
                    step_id=block.step_id,
                    source=block.source,
                    round_num=block.round_num,
                )
            )
    return timeline


# ── 链路构建 ───────────────────────────────────────────────────────────────


def build_chain(
    timeline: List[TimelineMessage], system_prompt: str
) -> List[Tuple[str, str, dict]]:
    """
    返回 [(role, content, meta), ...] 列表。
    首条固定为 system，后跟 assistant/user 时序消息。
    """
    chain: List[Tuple[str, str, dict]] = [
        ("system", system_prompt, {"step_name": "", "step_id": "", "source": "init", "round_num": None})
    ]
    for msg in timeline:
        chain.append(
            (
                msg.role,
                msg.content,
                {
                    "step_name": msg.step_name,
                    "step_id": msg.step_id,
                    "source": msg.source,
                    "round_num": msg.round_num,
                },
            )
        )
    return chain


# ── 终端着色 ───────────────────────────────────────────────────────────────
_COLORS = {
    "system":    "\033[33m",   # 黄
    "assistant": "\033[36m",   # 青
    "user":      "\033[32m",   # 绿
}
_RESET = "\033[0m"


def _colorize(role: str, text: str) -> str:
    return f"{_COLORS.get(role, '')}{text}{_RESET}"


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


# ── 单轮回放 ───────────────────────────────────────────────────────────────


def replay_round(
    chain: List[Tuple[str, str, dict]],
    sim_round: int,
    log_lines: List[str],
    verbose: bool,
) -> None:
    for role, content, meta in chain:
        ts = _ts()
        entry = {
            "round": sim_round,
            "role": role,
            "timestamp": ts,
            "message": content,
            **meta,
        }
        log_lines.append(json.dumps(entry, ensure_ascii=False))

        if verbose:
            preview = (content[:110] + "…") if len(content) > 110 else content
            label = _colorize(role, f"[{role:9s}]")
            print(f"  {ts}  {label}  {preview}")

        time.sleep(0.02)  # 同一轮内时间戳保持唯一


# ── 断言 ───────────────────────────────────────────────────────────────────


def assert_log(
    log_lines: List[str],
    expected_total: int,
    chain_roles: List[str],
) -> None:
    """
    校验两条规则：
    1. 总行数 == expected_total（原始对话条数 × 轮数）
    2. 每行 role 与 chain_roles 严格循环匹配（system→assistant→user→…）
    """
    errors: List[str] = []
    cycle_len = len(chain_roles)

    if len(log_lines) != expected_total:
        errors.append(
            f"总行数不符：期望 {expected_total}，实际 {len(log_lines)}"
        )

    for idx, raw in enumerate(log_lines):
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            errors.append(f"第 {idx + 1} 行 JSON 解析失败: {raw!r}")
            continue

        expected_role = chain_roles[idx % cycle_len]
        actual_role = entry.get("role", "<missing>")
        if actual_role != expected_role:
            errors.append(
                f"第 {idx + 1} 行角色不符：期望 '{expected_role}'，实际 '{actual_role}'"
            )

    if errors:
        print("\n❌ 断言失败：", file=sys.stderr)
        for e in errors:
            print(f"   {e}", file=sys.stderr)
        sys.exit(1)

    print(
        f"\n✅ 断言通过：共 {len(log_lines)} 行，"
        f"角色顺序严格匹配 {chain_roles}（循环 {len(log_lines) // cycle_len} 次）。"
    )


# ── CLI ────────────────────────────────────────────────────────────────────


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="按 system→assistant→user 时序重放对话日志，输出到控制台与本地 log 文件"
    )
    parser.add_argument(
        "--log-file",
        default="test.txt",
        help="对话日志文件路径（默认 test.txt）",
    )
    parser.add_argument(
        "--round",
        type=int,
        default=1,
        metavar="N",
        help="重复模拟次数，每次间隔 1 秒（默认 1）",
    )
    parser.add_argument(
        "--output-log",
        default="replay_output.log",
        help="输出 log 文件路径（默认 replay_output.log）",
    )
    parser.add_argument(
        "--system-prompt-file",
        help="自定义 system prompt 文件（未指定则使用内置默认 prompt）",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="抑制控制台逐条输出（仍写入 log 文件）",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    log_path = Path(args.log_file).expanduser().resolve()
    if not log_path.exists():
        print(f"❌ 日志文件不存在: {log_path}", file=sys.stderr)
        sys.exit(1)

    if args.round < 1:
        print("❌ --round 必须 >= 1", file=sys.stderr)
        sys.exit(1)

    # system prompt
    system_prompt = DEFAULT_SYSTEM_PROMPT
    if args.system_prompt_file:
        sp_path = Path(args.system_prompt_file).expanduser().resolve()
        system_prompt = sp_path.read_text(encoding="utf-8").strip()

    # 解析 & 构建
    blocks = parse_dialogue_log(log_path)
    timeline = build_timeline(blocks)

    if not timeline:
        print("❌ 日志中未解析到任何对话消息", file=sys.stderr)
        sys.exit(1)

    chain = build_chain(timeline, system_prompt)
    chain_roles = [role for role, _, _ in chain]

    print(f"📂 对话文件   : {log_path}")
    print(f"🔗 链路长度   : {len(chain)} 条  角色序列: {chain_roles}")
    print(f"🔁 模拟轮数   : {args.round}")
    print(f"💾 输出文件   : {args.output_log}")
    print("=" * 72)
    print(f"  {'timestamp':34s}  {'role':11s}  message preview")
    print("-" * 72)

    all_log_lines: List[str] = []

    for sim_round in range(1, args.round + 1):
        print(
            f"\n── Round {sim_round}/{args.round} "
            + "─" * (60 - len(str(sim_round)) - len(str(args.round)))
        )
        replay_round(chain, sim_round, all_log_lines, verbose=not args.quiet)
        if sim_round < args.round:
            time.sleep(1)

    # 写入 log 文件
    output_path = Path(args.output_log).resolve()
    output_path.write_text("\n".join(all_log_lines) + "\n", encoding="utf-8")
    print(f"\n📝 已写入 log：{output_path}  ({len(all_log_lines)} 行)")

    # 断言
    expected_total = len(chain) * args.round
    assert_log(all_log_lines, expected_total, chain_roles)


if __name__ == "__main__":
    main()
