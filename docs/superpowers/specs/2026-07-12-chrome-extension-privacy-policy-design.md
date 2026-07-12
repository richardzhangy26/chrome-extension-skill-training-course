# Hike Teaching Center 扩展隐私政策设计

## 背景

Chrome Web Store 以“隐私权政策链接并未指向有效的隐私权政策”（Ref ID: Purple Nickel）拒绝了扩展 `mhhonaofiieikgebniaihgbphfplbhah`。现有 `https://polymasability.agicoderbit.com/privacy` 虽然可访问，但内容是通用网站政策，没有明确说明扩展处理的数据、用途、存储位置、第三方接收方和用户控制方式。

## 目标

- 保留现有 `/privacy` URL，避免新增路由和修改现有站内引用。
- 将该页面改写为同时覆盖 Hike Teaching Center Chrome 扩展和 Polymas 训练助手 Admin Web 的专用隐私政策。
- 让页面披露内容与扩展实际数据流、Chrome Web Store 数据使用表单保持一致。
- 提供中英文版本，并通过现有语言路由机制展示。

## 非目标

- 不修改扩展权限或运行时代码。
- 不调整 Admin Web 认证、配置同步或历史同步逻辑。
- 不修改 Chrome Web Store 商品详情、图片或发布范围。
- 本次部署后只保存商店草稿，不提交审核。

## 方案选择

采用直接改写现有 `admin_web/content/pages/privacy.zh.md` 和 `admin_web/content/pages/privacy.md` 的方案。现有 `/privacy` 路由、SEO 和站内链接保持不变。

未采用新建 `/chrome-extension/privacy` 路由的方案，因为会增加路由、SEO、站点地图和双份政策维护成本。未采用只追加一段扩展说明的方案，因为信息仍可能不够具体，无法充分回应本次拒绝原因。

## 政策内容设计

### 身份与适用范围

页面首部明确列出：

- 产品名称：Hike Teaching Center / Polymas 训练助手。
- 产品形态：Chrome 扩展与配套 Admin Web。
- Chrome 扩展 ID：`mhhonaofiieikgebniaihgbphfplbhah`。
- 生效或最后更新日期。
- 联系邮箱：`support@agicoderbit.com`。

### 数据类型与用途

政策按实际用途披露以下数据：

1. **个人身份信息**：用户注册或登录 Admin Web 时使用的邮箱地址，以及服务返回的用户身份信息。用途是账号认证、跨设备配置和历史同步。
2. **身份验证信息**：Polymas 域名下名为 `ai-poly` 的 Cookie，以及 Admin Web 登录返回的 bearer token。用途仅限访问对应训练接口和已登录用户的 Admin Web 数据。
3. **训练页面与网站内容**：当前活动标签页 URL 中的 `trainTaskId`、Polymas 训练任务、训练流程和相关文本内容。用途是识别当前训练任务并运行训练流程。
4. **个人通讯与训练记录**：用户输入、AI 生成的学生回答、训练对话、模拟内容、知识库内容和历史记录。用途是执行训练、展示历史，以及在用户登录后按功能设计进行同步。
5. **模型与语音配置**：LLM/TTS API 地址、模型名称、API Key、系统提示词、学生角色和相关设置。用途是调用用户选择或配置的模型及语音服务。
6. **音频数据**：语音训练中用于播放或发送的音频内容。用途仅限语音训练和 TTS 流程。

政策明确不收集完整浏览历史，不监控点击、滚动或键盘活动，不处理健康、金融、精确位置或信用评估数据。

### 数据流与存储位置

政策区分三个数据边界：

- **浏览器本地存储**：扩展配置、会话状态、对话缓存和历史记录可存储在 Chrome 本地存储中。
- **Admin Web**：登录后，账号身份、七项同步 LLM 配置和训练历史可通过 `polymasability.agicoderbit.com` 同步并存储在 Cloudflare Workers、D1 或相关基础设施中。
- **外部服务**：训练数据发送至 Polymas API；提示词、训练上下文、文本或音频仅在用户启用相应功能时发送至用户配置或选择的 LLM/TTS 提供商。不同提供商的数据处理受其自身隐私政策约束。

### 用户控制与保留

政策说明用户可以：

- 登出 Admin Web，停止新的账号同步。
- 清除 Chrome 扩展的本地存储或卸载扩展，删除本地数据。
- 在产品界面中删除可删除的训练历史。
- 通过 `support@agicoderbit.com` 请求访问、更正或删除服务端账号和关联数据。

服务端数据只在提供服务、履行安全和法律义务所需的期间保留；删除请求完成后，备份中的副本会按照正常备份周期清理。

### Limited Use 与商业用途

政策明确声明：

- 不出售用户数据。
- 不将用户数据用于广告、画像、信用评估或与扩展单一用途无关的目的。
- 仅为提供和改进扩展明确功能、安全防护、故障排查和法律合规而处理数据。
- 向第三方传输仅限实现用户启用的 Polymas、Admin Web、LLM 或 TTS 功能所必需的范围。

## Chrome Web Store 表单对齐

数据使用表单保持以下四项选中：

- 个人身份信息。
- 身份验证信息。
- 个人通讯。
- 网站内容。

健康信息、财务和付款信息、位置、网络记录和用户活动保持未选中。三个 Limited Use 确认项保持选中。

`activeTab` 理由使用与当前实现一致的说明：仅在用户打开扩展侧边栏时临时访问当前活动标签页，用于确认是否位于 Polymas 训练页面并读取 URL 中的 `trainTaskId`，不读取或保存其他标签页内容及浏览历史。

## 实现范围

仅修改：

- `admin_web/content/pages/privacy.zh.md`
- `admin_web/content/pages/privacy.md`

不新增路由，不编辑生成的 `admin_web/src/routeTree.gen.ts`，不修改其他现有工作区改动。

## 验证与部署

1. 在 `admin_web/` 运行 `pnpm check`。
2. 在 `admin_web/` 运行 `pnpm build`。
3. 运行 `pnpm exec wrangler whoami` 确认当前 Cloudflare 身份。
4. 运行 `pnpm deploy` 部署现有 Worker。
5. 请求 `https://polymasability.agicoderbit.com/privacy`，确认 HTTP 成功并包含产品名称、扩展 ID、数据类型、第三方服务、删除方式和联系邮箱。
6. 回到 Chrome Web Store，核对数据类型和权限说明，保留隐私政策 URL 为 `https://polymasability.agicoderbit.com/privacy`。
7. 经用户在操作时确认后点击“保存草稿”，不点击“提请审核”。

## 风险与缓解

- **工作区已有未提交改动**：仅编辑两份现有 Markdown 文件，并在验证、部署和提交时严格限定文件范围。
- **政策与实现不一致**：所有披露以当前 manifest、background、storage、Admin Web 配置/历史 API、LLM 和 TTS 数据流为依据。
- **部署携带其他未提交 Admin Web 改动**：部署构建会包含当前 `admin_web/` 工作区的全部未提交代码。执行部署前必须向用户明确说明这一点并取得确认，或先在隔离工作区部署仅含隐私政策的版本。
- **审核仍拒绝**：保留拒绝邮件和部署后的页面证据；若再次因同一原因拒绝，再考虑使用独立 `/chrome-extension/privacy` 路由并申诉。
