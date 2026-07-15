import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const source = readFileSync(new URL('./SidePanel.tsx', import.meta.url), 'utf8');

// 空闲态已统一到 IdleTrainingPanel（refactor: unify idle training panels）：
// 文本模式 isIdle 分支渲染该组件，组件内部先模拟配置栏后开始按钮。
const idleBranch = source.match(/\{isIdle \? \(([\s\S]*?)\) : isChatting/);
const idlePanel = source.match(/const IdleTrainingPanel = \(\{[\s\S]*?\n\);/);

test('文本模式空闲态使用统一的 IdleTrainingPanel', () => {
  assert.ok(idleBranch, '应能定位文本模式空闲态分支');
  assert.match(idleBranch[1], /<IdleTrainingPanel/);
});

test('IdleTrainingPanel 同时提供模拟配置栏和开始按钮，且配置栏在前', () => {
  assert.ok(idlePanel, '应能定位 IdleTrainingPanel 组件');
  assert.match(idlePanel[0], /<SimulationConfigBar/);
  assert.match(idlePanel[0], /<StartButton/);
  assert.ok(idlePanel[0].indexOf('<SimulationConfigBar') < idlePanel[0].indexOf('<StartButton'));
});
