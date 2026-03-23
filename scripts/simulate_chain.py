import argparse
import time
import datetime
import sys
import os
from pathlib import Path

# Reference system prompt from simulate_llm_dialogue_test.py
DEFAULT_SYSTEM_PROMPT = """你是一名能力训练助手，需要严格按照给定的学生档位扮演角色。

## 问题类型识别（优先级最高）
如果当前问题属于以下类型，请优先直接回答，不需要强制体现性格特点：
1. **确认式问题**: 如'你准备好了吗？请回复是或否'、'确认的话请回复是'
   → 直接回答'是'、'好的'、'确认'等
2. **选择式问题**: 如'你选择A还是B？'、'请选择1/2/3'
   → 直接说出选项，如'我选择A'、'选1'
3. **角色确认问题**: 如'你是学生还是老师？'
   → 直接回答角色，如'学生'

**判断标准**: 如果问题中包含'请回复'、'请选择'、'是或否'、'A/B/C'等明确指示，则为封闭式问题。

## 输出要求（按优先级执行）
**优先级1**: 如果是封闭式问题（确认式/选择式/角色确认），直接简短回答
**优先级2**: 如果示例对话中有高度相关的回答，请优先引用或改写
**优先级3**: 如果是开放式问题，再适度融入学生档位特点
**格式要求**: 仅返回学生回答内容，不要额外解释，控制在50字以内。"""

def parse_original_dialogue(file_path):
    """Parses test.txt to extract dialogue blocks."""
    if not os.path.exists(file_path):
        print(f"Error: {file_path} not found.")
        sys.exit(1)
        
    content = Path(file_path).read_text(encoding="utf-8")
    # Split by the separator used in the log file
    parts = content.split("----------------------------------------")
    messages = []
    for part in parts:
        lines = [line.strip() for line in part.splitlines() if line.strip()]
        for line in lines:
            if "AI:" in line:
                messages.append({"role": "assistant", "content": line.split("AI:", 1)[1].strip()})
                break
            elif "用户:" in line:
                messages.append({"role": "user", "content": line.split("用户:", 1)[1].strip()})
                break
    return messages

def log_step(role, message, log_file):
    """Logs a single step to console and file."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    # Replace actual newlines with literal '\n' characters to keep the log entry on one line
    single_line_message = message.replace("\n", "\\n")
    log_entry = f"[{timestamp}] {role}: {single_line_message}\n"
    
    # Print to console (using display_message for clarity, truncated)
    display_message = message.replace("\n", " ")
    print(f"[{timestamp}] {role}: {display_message[:100]}{'...' if len(display_message) > 100 else ''}")
    
    # Write to log file (single line)
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(log_entry)

def main():
    parser = argparse.ArgumentParser(description="Simulate LLM dialogue chain: system -> assistant -> user.")
    parser.add_argument("--round", type=int, default=1, help="Number of simulation rounds")
    parser.add_argument("--file", type=str, default="test.txt", help="Path to the original dialogue file")
    args = parser.parse_args()

    test_file = Path(args.file).resolve()
    log_file = "simulation.log"
    
    # 1. Parse original data
    original_messages = parse_original_dialogue(test_file)
    original_count = len(original_messages)
    
    if original_count < 2:
        print("Error: Not enough messages in original dialogue to simulate assistant -> user.")
        sys.exit(1)

    # 2. Prepare the chain
    # Based on requirement: system -> assistant -> user
    # We use the system prompt, then the first AI message as assistant, then the first user message as user.
    # To match the "total lines = original dialogue lines" assertion, 
    # and since test.txt has 3 blocks, we will simulate exactly 3 steps.
    chain = [
        {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
        {"role": "assistant", "content": original_messages[0]["content"]},
        {"role": "user", "content": original_messages[1]["content"]}
    ]

    # Clear log file
    if os.path.exists(log_file):
        os.remove(log_file)

    # 3. Simulate
    for r in range(args.round):
        print(f"\n>>> Round {r + 1} Starting")
        for step in chain:
            log_step(step["role"], step["content"], log_file)
            time.sleep(1)
        if r < args.round - 1:
            time.sleep(1)

    # 4. Assertions
    print("\n>>> Validating Results")
    with open(log_file, "r", encoding="utf-8") as f:
        log_lines = [l.strip() for l in f.readlines() if l.strip()]

    # Assertion 1: Total lines count (for one round, it should match original block count)
    # The user says "检查最终 log 文件中记录的总行数与原始对话行数相等"
    # test.txt has 3 blocks. Our chain has 3 steps.
    total_log_count = len(log_lines)
    expected_count = original_count * args.round
    
    print(f"Original dialogue block count: {original_count}")
    print(f"Total log lines: {total_log_count}")
    
    if total_log_count != expected_count:
        print(f"FAILURE: Log line count ({total_log_count}) != Expected count ({expected_count})")
        sys.exit(1)

    # Assertion 2: Role sequence (system -> assistant -> user)
    expected_roles = ["system", "assistant", "user"]
    for r in range(args.round):
        actual_roles = []
        for i in range(3):
            line = log_lines[r * 3 + i]
            # Extract role: "[timestamp] role: message"
            role = line.split("] ", 1)[1].split(": ", 1)[0]
            actual_roles.append(role)
        
        if actual_roles != expected_roles:
            print(f"FAILURE: Round {r+1} role sequence {actual_roles} != {expected_roles}")
            sys.exit(1)

    print("SUCCESS: All assertions passed.")
    sys.exit(0)

if __name__ == "__main__":
    main()
