import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import test from 'node:test';

test('manifest 静态注入 MAIN 与 ISOLATED 两个 bridge entry', async () => {
  const source = await readFile(new URL('../manifest.ts', import.meta.url), 'utf8');
  assert.match(source, /content\/pro-train-v2-main\.iife\.js/);
  assert.match(source, /content\/pro-train-v2-relay\.iife\.js/);
  assert.match(source, /world:\s*'MAIN'/);
  assert.match(source, /world:\s*'ISOLATED'/);
  assert.match(source, /run_at:\s*'document_start'/);
  assert.match(source, /matches:\s*\['https:\/\/hike-teaching-center\.polymas\.com\/\*'\]/);
  assert.doesNotMatch(source, /all_frames:\s*true/);
  assert.doesNotMatch(source, /'scripting'/);
  assert.doesNotMatch(source, /declarativeNetRequest|webRequest|web_accessible_resources/);
});
