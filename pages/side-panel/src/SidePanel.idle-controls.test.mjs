import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const source = readFileSync(new URL('./SidePanel.tsx', import.meta.url), 'utf8');
const idleBranch = source.match(/\{isIdle \? \(([\s\S]*?)\) : isChatting/);

test('文本模式空闲态同时提供模拟配置栏和开始按钮', () => {
  assert.ok(idleBranch, '应能定位文本模式空闲态分支');
  assert.match(idleBranch[1], /<SimulationConfigBar/);
  assert.match(idleBranch[1], /<StartButton/);
  assert.ok(idleBranch[1].indexOf('<SimulationConfigBar') < idleBranch[1].indexOf('<StartButton'));
});
