import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const source = readFileSync(new URL('./llm-service.ts', import.meta.url), 'utf8');

const overrideBlock = source.match(/interface RuntimeProfileOverride \{[\s\S]*?\n\}/);
const builder = source.match(/const buildStudentRoleSystemPrompt = \([\s\S]*?\n\};/);
const generator = source.match(/const generateStudentAnswer = async \([\s\S]*?\n\};/);

test('RuntimeProfileOverride: profile 可选并新增 proContext', () => {
  assert.ok(overrideBlock, '应能定位 RuntimeProfileOverride');
  assert.match(overrideBlock[0], /profile\?: StudentProfile/, 'profile 应改为可选');
  assert.match(overrideBlock[0], /proContext\?: ProStagePromptContext/, '应新增可选 proContext');
});

test('buildStudentRoleSystemPrompt: 接收可选 proContext 并调用 buildProContextSections', () => {
  assert.ok(builder, '应能定位 buildStudentRoleSystemPrompt');
  assert.match(builder[0], /proContext\?: ProStagePromptContext/, '应新增可选 proContext 参数');
  assert.match(builder[0], /if \(proContext\)/, '应按存在与否守卫');
  assert.match(builder[0], /buildProContextSections\(proContext\)/, '应调用 buildProContextSections 追加段落');
});

test('generateStudentAnswer: 把 runtimeOverride?.proContext 透传给 buildStudentRoleSystemPrompt', () => {
  assert.ok(generator, '应能定位 generateStudentAnswer');
  assert.match(generator[0], /runtimeOverride\?\.proContext/, '应读取 runtimeOverride?.proContext');
});

test('从 pro-training-context-service 导入 buildProContextSections 与类型', () => {
  assert.match(source, /import \{ buildProContextSections \} from '\.\/pro-training-context-service'/);
  assert.match(source, /import type \{ ProStagePromptContext \} from '\.\/pro-training-context-service'/);
});
