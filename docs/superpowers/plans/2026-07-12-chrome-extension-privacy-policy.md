# Hike Teaching Center Extension Privacy Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic `/privacy` content with a bilingual, extension-specific privacy policy, deploy it to the existing Cloudflare Worker, verify the public page, and save the corrected Chrome Web Store draft without submitting it for review.

**Architecture:** Keep the existing TanStack Start `/privacy` route and content-collections loader unchanged. Replace only the Chinese and English Markdown content files, commit those two files separately from the dirty worktree, then deploy the resulting commit from an isolated git worktree so unrelated local Admin Web changes cannot enter the production build.

**Tech Stack:** Markdown content collections, TanStack Start, pnpm 10.30.3, Cloudflare Workers/Wrangler, Chrome Web Store Developer Dashboard.

## Global Constraints

- Preserve the public URL `https://polymasability.agicoderbit.com/privacy`.
- Cover both the Hike Teaching Center Chrome extension and the companion Polymas 训练助手 Admin Web.
- Identify Chrome extension ID `mhhonaofiieikgebniaihgbphfplbhah`.
- Keep Chinese and English disclosures semantically aligned.
- Do not modify extension permissions, runtime code, Admin Web routes, authentication, configuration sync, or history sync.
- Do not edit generated `admin_web/src/routeTree.gen.ts`.
- Do not include unrelated dirty-worktree changes in the policy commit or deployment.
- Save the Chrome Web Store draft only; do not click “提请审核”.

---

### Task 1: Replace the bilingual privacy policy content

**Files:**
- Modify: `admin_web/content/pages/privacy.zh.md`
- Modify: `admin_web/content/pages/privacy.md`

**Interfaces:**
- Consumes: the existing `getPageBySlug('privacy')` content-collections loader and locale selection.
- Produces: the same `privacy` slug for both locales, with extension-specific Markdown content and unchanged route behavior.

- [ ] **Step 1: Replace the Chinese policy with the complete extension-specific disclosure**

Set `admin_web/content/pages/privacy.zh.md` to:

```markdown
---
title: Hike Teaching Center 扩展隐私政策
description: Hike Teaching Center Chrome 扩展与 Polymas 训练助手 Admin Web 的数据处理说明
date: 2026-07-12
---

## 1. 适用范围

本隐私政策适用于 **Hike Teaching Center** Chrome 扩展及其配套的 **Polymas 训练助手 Admin Web**（以下合称“本服务”）。Chrome 扩展 ID 为 `mhhonaofiieikgebniaihgbphfplbhah`。

本服务用于在 Polymas / Hike Teaching Center 教学平台中识别训练任务、运行文字或语音训练、生成模拟学生回答，以及在用户登录后同步用户选择同步的配置和训练历史。

最后更新日期：2026 年 7 月 12 日。如有隐私问题或数据请求，请联系 `support@agicoderbit.com`。

## 2. 我们处理的数据

根据用户启用的功能，本服务可能处理以下数据：

- **个人身份信息**：注册或登录 Admin Web 时使用的邮箱地址，以及认证服务返回的用户 ID 和基本账号信息。
- **身份验证信息**：`hike-teaching-center.polymas.com` 域名下名为 `ai-poly` 的 Cookie，以及 Admin Web 登录返回的 bearer token。扩展使用这些凭证访问对应用户已获授权的 Polymas 或 Admin Web 接口，不会读取其他网站的 Cookie。
- **训练页面和网站内容**：当前活动标签页 URL 中的 `trainTaskId`、训练任务、训练步骤、教学文本和与当前训练相关的页面内容。
- **个人通讯和训练记录**：用户输入、AI 生成的学生回答、训练对话、模拟对话、知识库内容和训练历史。
- **模型配置**：LLM API 地址、模型名称、API Key、系统提示词、学生角色、模拟内容和知识库内容。登录 Admin Web 后，产品只会跨设备同步当前产品定义的账号级配置字段；TTS 设置等本地字段不会因此自动同步。
- **语音训练数据**：语音模式生成、播放或发送训练音频所需的文本、音频和相关训练上下文。

我们不会收集完整浏览历史，不会监控用户在网页上的点击、鼠标位置、滚动或键盘操作，也不会将本服务用于处理健康信息、财务信息、精确位置或信用评估数据。

## 3. 数据用途

我们仅将上述数据用于：

- 识别用户当前打开的 Polymas 训练任务；
- 访问 Polymas 训练接口并运行文字或语音训练流程；
- 根据用户配置调用 LLM 或 TTS 服务，生成模拟回答或语音；
- 在浏览器中保存配置、会话状态和训练历史；
- 在用户登录 Admin Web 后提供账号认证、配置同步和训练历史同步；
- 提供安全防护、故障排查、客户支持和法律合规。

## 4. 数据存储和共享

### 浏览器本地存储

扩展配置、当前训练状态、对话缓存和训练历史可以保存在 Chrome 本地存储中。用户可以通过扩展界面删除可删除的历史，或通过清除扩展数据、卸载扩展删除本地数据。

### Admin Web

用户登录 Admin Web 后，邮箱、账号标识、账号级 LLM 配置和训练历史可以通过 `polymasability.agicoderbit.com` 同步。Admin Web 运行在 Cloudflare Workers 上，并可使用 Cloudflare D1 等基础设施保存提供服务所需的数据。

### Polymas、LLM 和 TTS 服务

- 扩展会将完成训练所需的身份验证信息、任务 ID、训练内容、回答或音频发送至 Polymas 相关接口。
- 用户启用 AI 自动回答时，系统提示词、学生角色、训练上下文、知识库内容和对话会发送至用户配置或选择的 LLM 服务。
- 用户启用 TTS 时，待合成文本和调用所需的配置会发送至用户配置或选择的 TTS 服务。

这些外部服务只会收到实现用户主动启用功能所需的数据，其后续处理也受相应服务提供商隐私政策约束。除上述必要服务提供方外，我们不会出售、出租或为广告目的共享用户数据。

## 5. 数据保留和用户控制

- 本地数据会保留在用户的 Chrome 配置中，直到用户在产品中删除、清除扩展数据或卸载扩展。
- 服务端账号、配置和历史会在提供服务、保护服务安全或履行法律义务所需的期间保留。
- 用户可以登出 Admin Web，停止新的账号级同步。
- 用户可以通过 `support@agicoderbit.com` 请求访问、更正或删除服务端账号及关联数据。完成删除后，备份副本会按照正常备份周期清理。

## 6. 数据安全

我们采用合理的技术和组织措施保护数据，包括通过 HTTPS 传输、限制服务端接口访问并使用对应的身份验证凭证。任何互联网传输或存储方式都无法保证绝对安全，用户应妥善保管其账号和 API 凭证。

## 7. Chrome Web Store Limited Use 声明

本服务对用户数据的使用遵循 Chrome Web Store 用户数据政策及 Limited Use 要求：

- 不出售用户数据；
- 不将用户数据用于广告、用户画像、信用评估或与产品单一用途无关的目的；
- 不会出于已获批准用途之外的目的向第三方传输用户数据；
- 仅在提供或改进用户明确启用的产品功能、安全防护、故障排查和法律合规所必需的范围内处理数据。

## 8. 未成年人

本服务面向获得相应教学平台访问权限的教师、课程运营、测试和开发人员，不以未成年人为直接目标用户。请勿在训练内容中输入实现训练目的所不需要的未成年人个人信息。

## 9. 政策更新

如果产品功能或数据处理方式发生变化，我们会更新本页面并修改顶部日期。重大变化会通过产品界面或其他合理方式通知用户。

## 10. 联系我们

如需咨询本政策，或请求访问、更正、导出或删除数据，请发送邮件至 `support@agicoderbit.com`。
```

- [ ] **Step 2: Replace the English policy with a semantically equivalent disclosure**

Set `admin_web/content/pages/privacy.md` to:

```markdown
---
title: Hike Teaching Center Extension Privacy Policy
description: Data practices for the Hike Teaching Center Chrome extension and Polymas Training Assistant Admin Web
date: 2026-07-12
---

## 1. Scope

This Privacy Policy applies to the **Hike Teaching Center** Chrome extension and its companion **Polymas Training Assistant Admin Web** (together, the “Service”). The Chrome extension ID is `mhhonaofiieikgebniaihgbphfplbhah`.

The Service identifies training tasks on the Polymas / Hike Teaching Center teaching platform, runs text or voice training, generates simulated student responses, and, when a user signs in, synchronizes the configuration and training history that the product is designed to sync.

Last updated: July 12, 2026. For privacy questions or data requests, contact `support@agicoderbit.com`.

## 2. Data We Process

Depending on the features a user enables, the Service may process:

- **Personally identifiable information**: the email address used to register or sign in to Admin Web, together with the user ID and basic account information returned by the authentication service.
- **Authentication information**: the Cookie named `ai-poly` from `hike-teaching-center.polymas.com` and the bearer token returned by Admin Web sign-in. The extension uses these credentials only to access the corresponding Polymas or Admin Web APIs that the user is authorized to use and does not read Cookies from unrelated websites.
- **Training-page and website content**: the `trainTaskId` in the active tab URL, training tasks, training steps, teaching text, and content related to the current training session.
- **Personal communications and training records**: user input, AI-generated student responses, training conversations, dialogue simulations, knowledge-base content, and training history.
- **Model configuration**: LLM API URLs, model names, API Keys, system prompts, student roles, simulation content, and knowledge-base content. After Admin Web sign-in, the product synchronizes only the account-level configuration fields defined by the product; local fields such as TTS settings are not automatically synchronized for that reason.
- **Voice-training data**: text, audio, and related training context needed to generate, play, or send audio in voice mode.

We do not collect a user's complete browsing history, monitor clicks, pointer position, scrolling, or keystrokes on web pages, or use the Service to process health information, financial information, precise location, or creditworthiness data.

## 3. How We Use Data

We use the data described above only to:

- identify the Polymas training task currently opened by the user;
- access Polymas training APIs and run text or voice training;
- call an LLM or TTS service selected or configured by the user to generate simulated answers or speech;
- store configuration, session state, and training history in the browser;
- provide account authentication, configuration synchronization, and training-history synchronization after Admin Web sign-in;
- provide security, troubleshooting, customer support, and legal compliance.

## 4. Storage and Sharing

### Browser Local Storage

Extension configuration, current training state, conversation buffers, and training history may be stored in Chrome local storage. Users can delete supported history entries in the product or remove local data by clearing extension data or uninstalling the extension.

### Admin Web

After Admin Web sign-in, the user's email address, account identifier, account-level LLM configuration, and training history may be synchronized through `polymasability.agicoderbit.com`. Admin Web runs on Cloudflare Workers and may use infrastructure such as Cloudflare D1 to store data needed to provide the Service.

### Polymas, LLM, and TTS Services

- The extension sends the authentication information, task ID, training content, responses, or audio required to complete a training session to the relevant Polymas APIs.
- When AI-generated responses are enabled, the system prompt, student role, training context, knowledge-base content, and conversation are sent to the LLM service selected or configured by the user.
- When TTS is enabled, the text to synthesize and the configuration needed for the request are sent to the TTS service selected or configured by the user.

These external services receive only the data needed to perform the feature the user enabled. Their subsequent processing is also governed by their own privacy policies. We do not sell, rent, or share user data for advertising, and we do not share it with third parties other than the service providers needed for the functions described above.

## 5. Retention and User Controls

- Local data remains in the user's Chrome profile until the user deletes it in the product, clears extension data, or uninstalls the extension.
- Server-side account, configuration, and history data is retained for as long as needed to provide the Service, protect its security, or meet legal obligations.
- Users can sign out of Admin Web to stop new account-level synchronization.
- Users can contact `support@agicoderbit.com` to request access to, correction of, or deletion of their server-side account and associated data. After deletion, backup copies are removed through the normal backup lifecycle.

## 6. Data Security

We use reasonable technical and organizational safeguards, including HTTPS transmission, access controls on server APIs, and the corresponding authentication credentials. No method of internet transmission or storage is completely secure, and users should protect their account and API credentials.

## 7. Chrome Web Store Limited Use Disclosure

The Service's use of user data complies with the Chrome Web Store User Data Policy and Limited Use requirements:

- We do not sell user data.
- We do not use user data for advertising, profiling, creditworthiness, or purposes unrelated to the Service's single purpose.
- We do not transfer user data to third parties for purposes outside approved use cases.
- We process data only as needed to provide or improve user-facing features that the user enables, maintain security, troubleshoot the Service, and comply with law.

## 8. Children

The Service is intended for teachers, course operators, testers, and developers who are authorized to access the relevant teaching platform. It is not directed to children. Users should not enter personal information about minors that is unnecessary for the training purpose.

## 9. Changes to This Policy

If product features or data practices change, we will update this page and revise the date above. We will provide notice of material changes through the product or another reasonable channel.

## 10. Contact Us

For questions about this Policy or to request access, correction, export, or deletion of data, email `support@agicoderbit.com`.
```

- [ ] **Step 3: Verify the Markdown content is complete and aligned**

Run:

```bash
rg -n "mhhonaofiieikgebniaihgbphfplbhah|ai-poly|support@agicoderbit.com|Limited Use|用户数据|Cloudflare|LLM|TTS" \
  admin_web/content/pages/privacy.zh.md \
  admin_web/content/pages/privacy.md
git diff --check -- admin_web/content/pages/privacy.zh.md admin_web/content/pages/privacy.md
```

Expected: both files contain the extension ID, authentication data, contact address, third-party service disclosures, retention controls, and Limited Use statement; `git diff --check` exits 0 with no output.

### Task 2: Validate and commit only the policy files

**Files:**
- Verify: `admin_web/content/pages/privacy.zh.md`
- Verify: `admin_web/content/pages/privacy.md`

**Interfaces:**
- Consumes: the Markdown files produced by Task 1 and the existing Admin Web build pipeline.
- Produces: commit `docs: publish extension privacy policy`, containing exactly the two policy files.

- [ ] **Step 1: Run the Admin Web read-only checks**

Run from `admin_web/`:

```bash
pnpm check
```

Expected: exit code 0. If unrelated pre-existing files fail, record the exact failures and continue only after confirming the two policy files are not the cause.

- [ ] **Step 2: Run the production build**

Run from `admin_web/`:

```bash
pnpm build
```

Expected: exit code 0 and a generated Cloudflare Worker bundle.

- [ ] **Step 3: Stage only the two policy files and inspect the staged set**

Run from repository root:

```bash
git add admin_web/content/pages/privacy.zh.md admin_web/content/pages/privacy.md
git diff --cached --check
git diff --cached --name-only
```

Expected staged names:

```text
admin_web/content/pages/privacy.md
admin_web/content/pages/privacy.zh.md
```

- [ ] **Step 4: Commit the policy content**

Run:

```bash
git commit -m "docs: publish extension privacy policy"
```

Expected: a commit containing exactly the two policy files.

### Task 3: Deploy the committed policy from an isolated worktree

**Files:**
- Read: `admin_web/wrangler.jsonc`
- Deploy: committed `admin_web/` tree from Task 2

**Interfaces:**
- Consumes: the policy commit from Task 2 and existing Worker configuration for `polymas-ability`.
- Produces: an updated Worker serving the policy at `https://polymasability.agicoderbit.com/privacy` without unrelated dirty-worktree changes.

- [ ] **Step 1: Create an isolated deployment worktree**

Use the `superpowers:using-git-worktrees` skill, then create a detached worktree at the policy commit:

```bash
git worktree add --detach /tmp/polymas-privacy-deploy HEAD
```

Expected: `/tmp/polymas-privacy-deploy` is created at the commit containing the policy files; the primary worktree remains dirty only with the user's pre-existing changes.

- [ ] **Step 2: Install the Admin Web dependencies in the isolated worktree**

Run from `/tmp/polymas-privacy-deploy/admin_web`:

```bash
pnpm install --frozen-lockfile
```

Expected: exit code 0 with no lockfile modifications.

- [ ] **Step 3: Verify Cloudflare authentication**

Run from `/tmp/polymas-privacy-deploy/admin_web`:

```bash
pnpm exec wrangler whoami
```

Expected: the authenticated Cloudflare account and account ID are displayed.

- [ ] **Step 4: Re-run checks in the exact deployment tree**

Run:

```bash
pnpm check
pnpm build
```

Expected: both commands exit 0 in the isolated worktree.

- [ ] **Step 5: Deploy the Worker**

Run:

```bash
pnpm deploy
```

Expected: Wrangler reports a successful deployment for Worker `polymas-ability` and the custom domain remains `polymasability.agicoderbit.com`.

- [ ] **Step 6: Verify the public policy page**

Run:

```bash
curl -fsSL https://polymasability.agicoderbit.com/privacy > /tmp/polymas-privacy.html
rg -n "Hike Teaching Center|mhhonaofiieikgebniaihgbphfplbhah|ai-poly|support@agicoderbit.com|Limited Use|Cloudflare|LLM|TTS" /tmp/polymas-privacy.html
```

Expected: `curl` exits 0 and every required disclosure appears in the public HTML.

- [ ] **Step 7: Remove the isolated worktree after verification**

Run from repository root:

```bash
git worktree remove /tmp/polymas-privacy-deploy
```

Expected: the temporary worktree is removed and the primary worktree is unchanged apart from the committed policy files.

### Task 4: Align and save the Chrome Web Store draft

**Files:**
- External UI: Chrome Web Store Developer Dashboard privacy page for extension `mhhonaofiieikgebniaihgbphfplbhah`

**Interfaces:**
- Consumes: the verified public `/privacy` page and the extension's actual data flow.
- Produces: a saved Chrome Web Store draft with accurate disclosures; no review submission.

- [ ] **Step 1: Confirm the disclosed data categories**

In the Bit Chrome profile, keep these categories selected:

```text
个人身份信息
身份验证信息
个人通讯
网站内容
```

Keep health, financial/payment, location, web history, and user activity unselected. Keep all three Limited Use confirmations selected.

- [ ] **Step 2: Confirm the activeTab explanation**

The field must contain exactly:

```text
仅在用户打开扩展侧边栏时临时访问当前活动标签页，用于确认是否位于 Polymas 训练页面并从页面 URL 中读取 trainTaskId；不会读取或保存其他标签页内容及浏览历史。
```

- [ ] **Step 3: Confirm the privacy-policy URL**

The field must contain exactly:

```text
https://polymasability.agicoderbit.com/privacy
```

- [ ] **Step 4: Ask for action-time confirmation and save the draft**

Immediately before clicking “保存草稿”, tell the user that the action will persist the updated privacy disclosures to the Chrome Web Store developer account and ask for confirmation.

After confirmation, click “保存草稿”, verify the success message or disabled save state, and do not click “提请审核”.
