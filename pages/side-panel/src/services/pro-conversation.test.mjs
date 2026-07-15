import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStudentAnswerInput, formatProLogEntry, EMPTY_AI_PLACEHOLDER } from './pro-conversation.ts';

test('buildStudentAnswerInput: 对方发言聚合为 aiQuestion，既往回合成对进 history', () => {
  const { aiQuestion, history } = buildStudentAnswerInput([
    { role: 'bot', label: '客户', content: '你好，我想咨询产品' },
    { role: 'user', label: '你(学生)', content: '好的，请讲' },
    { role: 'bot', label: '客户', content: '有什么推荐？' },
    { role: 'coach', label: '教练点评', content: '回应可以更主动' },
  ]);
  assert.deepEqual(history, [{ ai: '客户: 你好，我想咨询产品', student: '好的，请讲' }]);
  assert.equal(aiQuestion, '客户: 有什么推荐？\n[教练点评] 回应可以更主动');
});

test('buildStudentAnswerInput: 学生先发言（如阶段开场应答）时 ai 侧用占位符', () => {
  const { aiQuestion, history } = buildStudentAnswerInput([{ role: 'user', label: '你(学生)', content: '好的' }]);
  assert.deepEqual(history, [{ ai: EMPTY_AI_PLACEHOLDER, student: '好的' }]);
  assert.equal(aiQuestion, '');
});

test('buildStudentAnswerInput: 连续多条对方发言按换行拼接', () => {
  const { history } = buildStudentAnswerInput([
    { role: 'bot', label: '客户', content: '第一句' },
    { role: 'coach', label: '教练点评', content: '注意语气' },
    { role: 'user', label: '你(学生)', content: '收到' },
  ]);
  assert.deepEqual(history, [{ ai: '客户: 第一句\n[教练点评] 注意语气', student: '收到' }]);
});

test('formatProLogEntry: user→userText，bot/coach→aiText（带标签）', () => {
  assert.deepEqual(formatProLogEntry({ role: 'user', label: '你(学生)', content: '你好' }), { userText: '你好' });
  assert.deepEqual(formatProLogEntry({ role: 'bot', label: '客户', content: '在吗' }), { aiText: '客户: 在吗' });
  assert.deepEqual(formatProLogEntry({ role: 'coach', label: '教练点评', content: '不错' }), {
    aiText: '[教练点评] 不错',
  });
});
