import { m } from '@/locale/paraglide/messages';
import React, { type ReactElement } from 'react';
import type { EmailTemplate } from './types';
import ContactMessage from './templates/contact-message';
import ForgotPassword from './templates/forgot-password';
import SubscribeNewsletter from './templates/subscribe-newsletter';
import VerifyEmail from './templates/verify-email';

const EmailTemplates = {
  forgotPassword: ForgotPassword,
  verifyEmail: VerifyEmail,
  subscribeNewsletter: SubscribeNewsletter,
  contactMessage: ContactMessage,
} as const;

const en = { locale: 'en' as const };
const EmailSubjects: Record<EmailTemplate, string> = {
  forgotPassword: m.mail_forgot_password_subject(undefined, en),
  verifyEmail: m.mail_verify_email_subject(undefined, en),
  subscribeNewsletter: m.mail_subscribe_newsletter_subject(undefined, en),
  contactMessage: m.mail_contact_message_subject(undefined, en),
};

export async function renderEmailHtml(email: ReactElement): Promise<string> {
  const reactDomServer = (await import('react-dom/server')) as {
    renderToReadableStream?: (element: ReactElement) => Promise<ReadableStream>;
    renderToStaticMarkup?: (element: ReactElement) => string;
    renderToString?: (element: ReactElement) => string;
  };
  try {
    if (reactDomServer.renderToReadableStream) {
      const stream = await reactDomServer.renderToReadableStream(email);
      return await new Response(stream).text();
    }
    if (reactDomServer.renderToStaticMarkup) {
      return reactDomServer.renderToStaticMarkup(email);
    }
    if (reactDomServer.renderToString) {
      return reactDomServer.renderToString(email);
    }
  } catch (error) {
    console.error('[mail] Email rendering failed:', error);
    throw error;
  }
  throw new Error('No suitable React DOM server renderer available');
}

const NAMED_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&copy;': '\u00A9',
  '&reg;': '\u00AE',
  '&trade;': '\u2122',
  '&ndash;': '\u2013',
  '&mdash;': '\u2014',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
  '&bull;': '\u2022',
  '&hellip;': '\u2026',
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&[a-zA-Z]+;/g, (entity) => NAMED_ENTITIES[entity] ?? entity);
}

export function toPlainText(html: string): string {
  const stripped = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decodeHtmlEntities(stripped);
}

export async function getTemplate({
  template,
  context,
}: {
  template: EmailTemplate;
  context: Record<string, unknown>;
}) {
  const Component = EmailTemplates[template];
  const email = React.createElement(
    Component as React.ComponentType<Record<string, unknown>>,
    context
  );
  const html = await renderEmailHtml(email);
  const text = toPlainText(html);
  const subject = EmailSubjects[template];
  return { html, text, subject };
}
