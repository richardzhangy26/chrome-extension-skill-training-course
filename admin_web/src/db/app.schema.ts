/**
 * Application database schema (non-auth tables).
 * Add your app tables here; keep Better Auth tables in auth.schema.ts.
 */

import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';
import type { PaymentScene, PaymentStatus, PaymentType, PlanInterval } from '@/payment/types';

/**
 * Payment: subscription and one-time
 */
export const payment = sqliteTable(
  'payment',
  {
    id: text('id').primaryKey(),
    priceId: text('price_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').notNull(),
    subscriptionId: text('subscription_id'),
    sessionId: text('session_id'),
    invoiceId: text('invoice_id').unique(),
    type: text('type').notNull().$type<PaymentType>(), // 'subscription' | 'one_time'
    scene: text('scene').$type<PaymentScene>(), // 'subscription' | 'lifetime'
    interval: text('interval').$type<PlanInterval>(), // 'month' | 'year'
    status: text('status').notNull().$type<PaymentStatus>(),
    paid: integer('paid', { mode: 'boolean' }).notNull().default(false),
    periodStart: integer('period_start', { mode: 'timestamp_ms' }),
    periodEnd: integer('period_end', { mode: 'timestamp_ms' }),
    cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }),
    trialStart: integer('trial_start', { mode: 'timestamp_ms' }),
    trialEnd: integer('trial_end', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => [
    index('payment_user_id_idx').on(table.userId),
    index('payment_customer_id_idx').on(table.customerId),
    index('payment_subscription_id_idx').on(table.subscriptionId),
    index('payment_session_id_idx').on(table.sessionId),
    index('payment_invoice_id_idx').on(table.invoiceId),
    index('payment_paid_idx').on(table.paid),
    index('payment_user_paid_idx').on(table.userId, table.paid),
  ],
);

export const paymentRelations = relations(payment, ({ one }) => ({
  user: one(user, { fields: [payment.userId], references: [user.id] }),
}));

/**
 * User files
 * metadata for files uploaded to R2 (path userfiles/{userId}/xxx);
 * filename = stored name on R2 (e.g. uuid.ext);
 * originalName = user's file name.
 */
export const userFiles = sqliteTable(
  'user_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    originalName: text('original_name').notNull(),
    contentType: text('content_type').notNull(),
    size: integer('size').notNull(),
    r2Key: text('r2_key').notNull(),
    isPublic: integer('is_public', { mode: 'boolean' }),
    description: text('description'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => [index('user_files_user_id_idx').on(table.userId), index('user_files_r2_key_idx').on(table.r2Key)],
);

export const userFilesRelations = relations(userFiles, ({ one }) => ({
  user: one(user, {
    fields: [userFiles.userId],
    references: [user.id],
  }),
}));

/**
 * 扩展 LLM 配置：每个用户一份，整份配置以 JSON 字符串存入 config 列。
 */
export const userLlmConfig = sqliteTable(
  'user_llm_config',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    config: text('config').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => [index('user_llm_config_user_id_idx').on(table.userId)],
);

export const userLlmConfigRelations = relations(userLlmConfig, ({ one }) => ({
  user: one(user, {
    fields: [userLlmConfig.userId],
    references: [user.id],
  }),
}));

/**
 * 扩展训练历史：每个用户的每条 session 一行；session 列存整份 AgentLogSession 的 JSON。
 * deletedAt 非空即 tombstone（软删，防跨设备删除复活）；tombstone 行 session 置空省空间。
 */
export const userAgentLog = sqliteTable(
  'user_agent_log',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    session: text('session'),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  table => [
    uniqueIndex('user_agent_log_user_session_idx').on(table.userId, table.sessionId),
    index('user_agent_log_user_id_idx').on(table.userId),
  ],
);

export const userAgentLogRelations = relations(userAgentLog, ({ one }) => ({
  user: one(user, {
    fields: [userAgentLog.userId],
    references: [user.id],
  }),
}));
