/**
 * Polling interval for payment completion (ms)
 */
export const PAYMENT_POLL_INTERVAL = 2000;

/**
 * Max polling time for payment completion (ms)
 */
export const PAYMENT_MAX_POLL_TIME = 60000;

/**
 * Max retry attempts for finding payment record (webhook race)
 */
export const PAYMENT_RECORD_RETRY_ATTEMPTS = 30;

/**
 * Retry delay between attempts (ms)
 */
export const PAYMENT_RECORD_RETRY_DELAY = 2000;
