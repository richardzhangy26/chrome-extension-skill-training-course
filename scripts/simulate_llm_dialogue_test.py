import argparse
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import requests
from dotenv import load_dotenv


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

DEFAULT_PROFILES = {
    "medium": {
        "label": "需要引导的学生",
        "description": "基本理解问题但不够全面，回答中会暴露疑惑或请求提示。",
        "style": "语气略显犹豫，能覆盖核心内容，但会提出 1-2 个不确定点或寻求老师建议。",
    },
    "good": {
        "label": "优秀学生",
        "description": "理解透彻、表达清晰，回答结构化、条理分明，并主动总结要点。",
        "style": "语气自信、语言规范，必要时引用题目或材料中的关键信息。",
    },
    "bad": {
        "label": "答非所问的学生",
        "description": "理解偏差，常常跑题或只复述与问题弱相关的信息。",
        "style": "语气随意，容易偏离重点或答非所问。",
    },
}


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="复现前端自动回复给大模型的组包方式，并直接调用接口测试。")
    parser.add_argument("--log-file", required=True, help="对话日志文件路径")
    parser.add_argument("--target-step", default="题目选择", help="目标步骤名称")
    parser.add_argument(
        "--target-assistant-index",
        type=int,
        default=2,
        help="目标步骤内第几个 assistant 消息，1 表示第一条",
    )
    parser.add_argument(
        "--student-profile",
        choices=sorted(DEFAULT_PROFILES.keys()),
        default="medium",
        help="学生档位，默认 medium",
    )
    parser.add_argument(
        "--max-history-rounds",
        type=int,
        default=5,
        help="复现前端 maxHistoryRounds，默认 5",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=1200,
        help="调用模型时的 max_tokens，默认 1200",
    )
    parser.add_argument(
        "--message-mode",
        choices=["frontend", "normal-role"],
        default="frontend",
        help="frontend 为当前前端组包；normal-role 为完整 assistant/user 链 + 最后一条 user 指令",
    )
    parser.add_argument("--system-prompt-file", help="自定义 system prompt 文件路径")
    parser.add_argument("--dialogue-samples-file", help="示例对话文件路径")
    parser.add_argument("--knowledge-base-file", help="知识库文件路径")
    parser.add_argument("--dry-run", action="store_true", help="只打印组包结果，不实际调用模型")
    return parser.parse_args()


def parse_dialogue_log(log_path: Path) -> List[DialogueBlock]:
    content = log_path.read_text(encoding="utf-8")
    blocks = [block.strip() for block in content.split("-" * 40) if block.strip()]
    parsed_blocks: List[DialogueBlock] = []

    for block in blocks:
        lines = [line.rstrip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue

        header_index = next((index for index, line in enumerate(lines) if line.startswith("Step: ")), -1)
        if header_index < 0:
            continue

        header = lines[header_index]
        step_name = ""
        step_id = ""
        source = "chat"
        round_num: Optional[int] = None

        header_parts = [part.strip() for part in header.split("|")]
        if header_parts:
            step_part = header_parts[0]
            if step_part.startswith("Step: "):
                step_name = step_part[len("Step: ") :].strip()

        for part in header_parts[1:]:
            if part.startswith("step_id:"):
                step_id = part[len("step_id:") :].strip()
            elif part.startswith("第 ") and part.endswith(" 轮"):
                round_str = part[len("第 ") : -len(" 轮")].strip()
                try:
                    round_num = int(round_str)
                except ValueError:
                    round_num = None
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

        user_text = "\n".join(part for part in user_lines if part).strip() or None
        ai_text = "\n".join(part for part in ai_lines if part).strip() or None

        parsed_blocks.append(
            DialogueBlock(
                step_name=step_name,
                step_id=step_id,
                source=source,
                round_num=round_num,
                user_text=user_text,
                ai_text=ai_text,
            )
        )

    return parsed_blocks


def build_timeline(blocks: List[DialogueBlock]) -> List[TimelineMessage]:
    timeline: List[TimelineMessage] = []

    for block in blocks:
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

    return timeline


def select_target_assistant(
    timeline: List[TimelineMessage],
    step_name: str,
    target_assistant_index: int,
) -> int:
    matched_indexes = [
        index
        for index, message in enumerate(timeline)
        if message.role == "assistant" and message.step_name == step_name
    ]

    if not matched_indexes:
        raise ValueError(f"没有在步骤 {step_name} 中找到 assistant 消息")

    if target_assistant_index < 1 or target_assistant_index > len(matched_indexes):
        raise ValueError(
            f"步骤 {step_name} 共有 {len(matched_indexes)} 条 assistant 消息，"
            f"但你传入的是 {target_assistant_index}"
        )

    return matched_indexes[target_assistant_index - 1]


def load_optional_text(file_path: Optional[str]) -> str:
    if not file_path:
        return ""
    return Path(file_path).read_text(encoding="utf-8").strip()


def normalize_dialogue_samples(content: str) -> str:
    normalized_lines: List[str] = []

    for raw_line in content.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("AI:") or line.startswith("AI："):
            normalized_lines.append(f"AI: {line[3:].strip()}")
        elif line.startswith("用户:") or line.startswith("用户："):
            normalized_lines.append(f"用户: {line[3:].strip()}")

    return "\n".join(normalized_lines)


def build_user_message(
    ai_question: str,
    student_profile: dict,
    dialogue_samples: str,
    knowledge_base: str,
) -> str:
    sections = [
        "## 角色设定",
        f"学生档位: {student_profile['label']}",
        f"角色特征: {student_profile['description']}",
        f"表达风格: {student_profile['style']}",
        "",
    ]

    normalized_samples = normalize_dialogue_samples(dialogue_samples)
    if normalized_samples:
        sections.extend(
            [
                "## 档位示例对话 (如有匹配请优先引用或改写，优先级最高)",
                normalized_samples,
                "",
            ]
        )

    if knowledge_base.strip():
        sections.extend(["## 参考知识库 (可结合使用)", knowledge_base.strip(), ""])

    sections.extend(["## 当前问题", ai_question, ""])
    return "\n".join(sections)


def build_frontend_messages(
    timeline: List[TimelineMessage],
    target_index: int,
    student_profile_key: str,
    max_history_rounds: int,
    system_prompt: str,
    dialogue_samples: str,
    knowledge_base: str,
) -> List[dict]:
    if target_index < 0 or target_index >= len(timeline):
        raise IndexError("target_index 超出范围")

    visible_messages = timeline[: target_index + 1]
    target_assistant = visible_messages[target_index]

    conversation_history = []
    for index in range(len(visible_messages) - 1):
        current_message = visible_messages[index]
        next_message = visible_messages[index + 1]
        if current_message.role == "assistant" and next_message.role == "user":
            conversation_history.append(
                {
                    "ai": current_message.content,
                    "student": next_message.content,
                }
            )

    history_messages = []
    for turn in conversation_history[-max_history_rounds:]:
        history_messages.append({"role": "assistant", "content": turn["ai"]})
        history_messages.append({"role": "user", "content": turn["student"]})

    user_message = build_user_message(
        ai_question=target_assistant.content,
        student_profile=DEFAULT_PROFILES[student_profile_key],
        dialogue_samples=dialogue_samples,
        knowledge_base=knowledge_base,
    )

    return [{"role": "system", "content": system_prompt}, *history_messages, {"role": "user", "content": user_message}]


def build_role_system_prompt(
    base_system_prompt: str,
    student_profile: dict,
    dialogue_samples: str,
    knowledge_base: str,
) -> str:
    sections = [
        base_system_prompt.strip(),
        "",
        "## 当前扮演设定",
        f"学生档位: {student_profile['label']}",
        f"角色特征: {student_profile['description']}",
        f"表达风格: {student_profile['style']}",
    ]

    normalized_samples = normalize_dialogue_samples(dialogue_samples)
    if normalized_samples:
        sections.extend(
            [
                "",
                "## 档位示例对话 (如有匹配请优先引用或改写)",
                normalized_samples,
            ]
        )

    if knowledge_base.strip():
        sections.extend(["", "## 参考知识库 (可结合使用)", knowledge_base.strip()])

    return "\n".join(sections).strip()


def build_normal_role_messages(
    timeline: List[TimelineMessage],
    target_index: int,
    student_profile_key: str,
    max_history_rounds: int,
    system_prompt: str,
    dialogue_samples: str,
    knowledge_base: str,
) -> List[dict]:
    if target_index < 0 or target_index >= len(timeline):
        raise IndexError("target_index 超出范围")

    visible_messages = timeline[: target_index + 1]
    last_messages = visible_messages[-(max_history_rounds * 2 + 1) :]
    profile = DEFAULT_PROFILES[student_profile_key]

    role_messages = [{"role": message.role, "content": message.content} for message in last_messages]
    role_messages.append(
        {
            "role": "user",
            "content": "\n".join(
                [
                    "请继续扮演上面设定的学生，直接回复上一条 assistant 的话。",
                    "如果上一条 assistant 是让你做选择或确认，请直接给出选择或确认。",
                    "仅输出学生回答内容，不要解释，不要添加角色标签。",
                ]
            ),
        }
    )

    return [
        {
            "role": "system",
            "content": build_role_system_prompt(system_prompt, profile, dialogue_samples, knowledge_base),
        },
        *role_messages,
    ]


def call_llm(messages: List[dict], max_tokens: int) -> dict:
    api_url = os.getenv("LLM_API_URL", "").strip()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "").strip()
    service_code = os.getenv("LLM_SERVICE_CODE", "").strip()

    if not api_url or not model:
        raise RuntimeError("缺少 LLM_API_URL 或 LLM_MODEL 环境变量")

    headers = {
        "Content-Type": "application/json",
    }
    if api_key:
        headers["api-key"] = api_key
    if service_code:
        headers["service-code"] = service_code

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": max_tokens,
        "top_k": 50,
    }

    response = requests.post(api_url, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    content = data["choices"][0]["message"]["content"].strip()
    return {
        "payload": payload,
        "response": data,
        "content": content,
    }


def print_context_summary(timeline: List[TimelineMessage], target_index: int) -> None:
    start_index = max(0, target_index - 6)
    print("\n[上下文时间线]")
    for index in range(start_index, target_index + 1):
        message = timeline[index]
        print(
            f"{index:02d}. {message.role:<9} | step={message.step_name} | "
            f"source={message.source} | text={message.content}"
        )


def main() -> None:
    load_dotenv()
    args = parse_args()

    log_path = Path(args.log_file).expanduser().resolve()
    if not log_path.exists():
        raise FileNotFoundError(f"日志文件不存在: {log_path}")

    blocks = parse_dialogue_log(log_path)
    timeline = build_timeline(blocks)
    target_index = select_target_assistant(timeline, args.target_step, args.target_assistant_index)
    target_message = timeline[target_index]

    system_prompt = load_optional_text(args.system_prompt_file) or DEFAULT_SYSTEM_PROMPT
    dialogue_samples = load_optional_text(args.dialogue_samples_file)
    knowledge_base = load_optional_text(args.knowledge_base_file)

    if args.message_mode == "frontend":
        messages = build_frontend_messages(
            timeline=timeline,
            target_index=target_index,
            student_profile_key=args.student_profile,
            max_history_rounds=args.max_history_rounds,
            system_prompt=system_prompt,
            dialogue_samples=dialogue_samples,
            knowledge_base=knowledge_base,
        )
    else:
        messages = build_normal_role_messages(
            timeline=timeline,
            target_index=target_index,
            student_profile_key=args.student_profile,
            max_history_rounds=args.max_history_rounds,
            system_prompt=system_prompt,
            dialogue_samples=dialogue_samples,
            knowledge_base=knowledge_base,
        )

    print(f"日志文件: {log_path}")
    print(f"目标步骤: {args.target_step}")
    print(f"目标 assistant 序号: {args.target_assistant_index}")
    print(f"组包模式: {args.message_mode}")
    print(f"目标 assistant 文本: {target_message.content}")
    print_context_summary(timeline, target_index)

    print("\n[发给模型的 messages]")
    print(json.dumps(messages, ensure_ascii=False, indent=2))

    if args.dry_run:
        print("\n[dry-run] 未实际调用模型。")
        return

    result = call_llm(messages, args.max_tokens)
    print("\n[模型回复]")
    print(result["content"])


if __name__ == "__main__":
    main()
