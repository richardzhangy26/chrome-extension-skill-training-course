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
