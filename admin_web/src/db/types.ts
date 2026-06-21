import { apikey, user } from './auth.schema';
import { userFiles, payment, userLlmConfig } from './app.schema';

export type User = typeof user.$inferSelect;
export type ApiKey = typeof apikey.$inferSelect;
export type UserFiles = typeof userFiles.$inferSelect;
export type Payment = typeof payment.$inferSelect;
export type UserLlmConfig = typeof userLlmConfig.$inferSelect;
