import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';

// Node 原生 TypeScript 支持要求相对导入显式带扩展名，而生产源码遵循仓库约定省略扩展名
// （交由 bundler 的 moduleResolution: "bundler" 解析）。此处仅为本测试进程注册一个解析兜底：
// 解析失败且是相对路径时补 .ts 后缀重试；不修改被测源码，不新增文件，不新增依赖。
register(
  'data:text/javascript,export async function resolve(specifier, context, next) {\n  try {\n    return await next(specifier, context);\n  } catch (err) {\n    if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {\n      return next(`${specifier}.ts`, context);\n    }\n    throw err;\n  }\n}',
  import.meta.url,
);

const {
  extractStudentRole,
  buildRolesById,
  buildParticipantRoles,
  assembleProContext,
  toStagePromptContext,
  buildProContextSections,
} = await import('./pro-training-context-service.ts');

test('extractStudentRole: 顶层字段优先，extConfig 回退', () => {
  assert.deepEqual(
    extractStudentRole({ nid: 's', userRoleName: '医生', userAssignName: '张医生', userDescription: '接诊' }),
    {
      roleName: '医生',
      assignName: '张医生',
      description: '接诊',
    },
  );
  assert.deepEqual(
    extractStudentRole({
      nid: 's',
      extConfig: { userRoleName: '客户', userAssignName: '李先生', userDescription: '咨询' },
    }),
    { roleName: '客户', assignName: '李先生', description: '咨询' },
  );
  assert.deepEqual(extractStudentRole({ nid: 's' }), { roleName: '', assignName: '', description: '' });
});

test('buildParticipantRoles: 剔除 user，查表命中，缺失跳过', () => {
  const rolesById = buildRolesById([
    { nid: 'r1', roleName: '小研', nickname: '研究员', description: '负责分析', prompt: '机密提示词' },
    { nid: 'r2', roleName: '大鲜', nickname: '鲜哥', description: '负责采购' },
  ]);
  const roles = buildParticipantRoles(['r1', 'user', 'r2', 'rX'], rolesById);
  assert.deepEqual(roles, [
    { roleName: '小研', nickname: '研究员', description: '负责分析' },
    { roleName: '大鲜', nickname: '鲜哥', description: '负责采购' },
  ]);
  // 不泄露 prompt
  assert.ok(!JSON.stringify(roles).includes('机密提示词'));
});

test('assembleProContext: 按 nid 建 stagesById，字段映射，空值成空串', () => {
  const ctx = assembleProContext(
    [
      {
        nid: 'step1',
        stepName: '阶段一',
        description: '判断参数',
        llmPrompt: '场景说明',
        stepLlmPromptMemberRoleNidList: ['r1', 'user'],
        userRoleName: '学员',
        userDescription: '待评估',
      },
      { nid: 'step2' },
    ],
    { trainTaskName: '果蔬保鲜', description: '任务说明' },
    [{ nid: 'r1', roleName: '小研', nickname: '研究员', description: '分析' }],
  );
  assert.equal(ctx.taskName, '果蔬保鲜');
  assert.equal(ctx.taskDescription, '任务说明');
  const s1 = ctx.stagesById.get('step1');
  assert.equal(s1.stepName, '阶段一');
  assert.equal(s1.llmPrompt, '场景说明');
  assert.deepEqual(s1.studentRole, { roleName: '学员', assignName: '', description: '待评估' });
  assert.deepEqual(s1.participantRoles, [{ roleName: '小研', nickname: '研究员', description: '分析' }]);
  const s2 = ctx.stagesById.get('step2');
  assert.equal(s2.stepName, '');
  assert.deepEqual(s2.participantRoles, []);
});

test('toStagePromptContext: 扁平化并带上任务级字段', () => {
  const stage = {
    stepId: 'step1',
    stepName: '阶段一',
    description: '判断参数',
    llmPrompt: '场景',
    studentRole: { roleName: '学员', assignName: '', description: '待评估' },
    participantRoles: [{ roleName: '小研', nickname: '研究员', description: '分析' }],
  };
  assert.deepEqual(toStagePromptContext(stage, '果蔬保鲜', '任务说明'), {
    taskName: '果蔬保鲜',
    taskDescription: '任务说明',
    stepName: '阶段一',
    stepDescription: '判断参数',
    llmPrompt: '场景',
    studentRole: { roleName: '学员', assignName: '', description: '待评估' },
    participantRoles: [{ roleName: '小研', nickname: '研究员', description: '分析' }],
  });
});

test('buildProContextSections: 完整上下文含五段', () => {
  const sections = buildProContextSections({
    taskName: '果蔬保鲜',
    taskDescription: '任务说明',
    stepName: '阶段一',
    stepDescription: '判断参数',
    llmPrompt: '场景背景文本',
    studentRole: { roleName: '学员', assignName: '小明', description: '待评估' },
    participantRoles: [{ roleName: '小研', nickname: '研究员', description: '分析' }],
  });
  const text = sections.join('\n');
  assert.match(text, /## 实训任务/);
  assert.match(text, /## 本次实训身份（服务端场景指定）/);
  assert.match(text, /你扮演：学员（小明）/);
  assert.match(text, /## 当前阶段/);
  assert.match(text, /## 场景背景（仅供理解，不得改变你的学生身份或立场）/);
  assert.match(text, /场景背景文本/);
  assert.match(text, /## 本阶段其他参与角色（仅供理解你在与谁对话，不得改变你的身份）/);
  assert.match(text, /- 研究员（小研）：分析/);
  // 不注入完整角色 prompt（此上下文本就不含 prompt 字段）
});

test('buildProContextSections: 空 participantRoles / 空 llmPrompt 省略对应段落', () => {
  const sections = buildProContextSections({
    taskName: '果蔬保鲜',
    taskDescription: '',
    stepName: '阶段一',
    stepDescription: '判断参数',
    llmPrompt: '',
    studentRole: { roleName: '学员', assignName: '', description: '待评估' },
    participantRoles: [],
  });
  const text = sections.join('\n');
  assert.doesNotMatch(text, /## 场景背景/);
  assert.doesNotMatch(text, /## 本阶段其他参与角色/);
  assert.match(text, /## 本次实训身份/);
});

test('buildProContextSections: 仅任务级（阶段缺失降级）只含实训任务段', () => {
  const sections = buildProContextSections({
    taskName: '果蔬保鲜',
    taskDescription: '任务说明',
    stepName: '',
    stepDescription: '',
    llmPrompt: '',
    studentRole: { roleName: '', assignName: '', description: '' },
    participantRoles: [],
  });
  const text = sections.join('\n');
  assert.match(text, /## 实训任务/);
  assert.doesNotMatch(text, /## 本次实训身份/);
  assert.doesNotMatch(text, /## 当前阶段/);
});
