/**
 * 能力训练 Pro 对话映射（纯函数）
 * 把 trainV2 多角色轮次序列映射为 generateStudentAnswer 输入与 agent-log-storage 日志字段。
 */

type ProTurnRole = 'user' | 'bot' | 'coach';

interface ProTurn {
  /** user=学生本人；bot=剧本角色；coach=主理人教练点评（roleNid === 'system'） */
  role: ProTurnRole;
  /** bot 为角色昵称；user 固定「你(学生)」；coach 固定「教练点评」 */
  label: string;
  content: string;
}

/** 学生发言之前没有任何对方发言时（如阶段开场应答）的 ai 侧占位 */
const EMPTY_AI_PLACEHOLDER = '（阶段开始）';

const formatOpponentLine = (turn: ProTurn): string =>
  turn.role === 'coach' ? `[教练点评] ${turn.content}` : `${turn.label}: ${turn.content}`;

/**
 * history：每个学生发言与其之前累计的非学生发言拼接配对（对齐 generateStudentAnswer 的 {ai, student} 格式）；
 * aiQuestion：最后一个学生发言之后的非学生发言拼接（当前待回应内容）。
 */
const buildStudentAnswerInput = (
  turns: ProTurn[],
): { aiQuestion: string; history: Array<{ ai: string; student: string }> } => {
  const history: Array<{ ai: string; student: string }> = [];
  let pendingOpponentLines: string[] = [];
  for (const turn of turns) {
    if (turn.role === 'user') {
      history.push({
        ai: pendingOpponentLines.length > 0 ? pendingOpponentLines.join('\n') : EMPTY_AI_PLACEHOLDER,
        student: turn.content,
      });
      pendingOpponentLines = [];
    } else {
      pendingOpponentLines.push(formatOpponentLine(turn));
    }
  }
  return { aiQuestion: pendingOpponentLines.join('\n'), history };
};

/** 映射为 ChatLogEntry 的 userText / aiText 字段（bot 发言带角色名，教练点评带 [教练点评] 标记） */
const formatProLogEntry = (turn: ProTurn): { userText?: string; aiText?: string } =>
  turn.role === 'user' ? { userText: turn.content } : { aiText: formatOpponentLine(turn) };

export { buildStudentAnswerInput, formatProLogEntry, EMPTY_AI_PLACEHOLDER };
export type { ProTurn, ProTurnRole };
