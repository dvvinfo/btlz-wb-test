import { createLogger } from "./logger.js";

const logger = createLogger("retry");

/**
 * Retry configuration options
 */
export interface RetryConfig {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 5 * 60 * 1000, // 5 minutes
    maxDelay: 30 * 60 * 1000, // 30 minutes
    backoffMultiplier: 2,
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for next retry attempt with exponential backoff
 * @param {number} attempt - Current attempt number (0-based)
 * @param {RetryConfig} config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
    return Math.min(delay, config.maxDelay);
}

/**
 * Retry a function with exponential backoff
 * @template T
 * @param {() => Promise<T>} fn - Async function to retry
 * @param {Partial<RetryConfig>} [options] - Retry configuration options
 * @param {string} [operationName] - Name of operation for logging
 * @returns Promise with function result
 * @throws Last error if all retry attempts fail
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options?: Partial<RetryConfig>,
    operationName?: string,
): Promise<T> {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...options };
    const operation = operationName || "operation";

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        try {
            logger.debug(`Attempting ${operation}`, { attempt: attempt + 1, maxAttempts: config.maxAttempts });
            const result = await fn();
            if (attempt > 0) {
                logger.info(`${operation} succeeded after ${attempt + 1} attempts`);
            }
            return result;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const isLastAttempt = attempt === config.maxAttempts - 1;

            if (isLastAttempt) {
                logger.error(`${operation} failed after ${config.maxAttempts} attempts`, lastError);
                throw lastError;
            }

            const delay = calculateDelay(attempt, config);
            logger.warn(`${operation} failed, retrying in ${delay}ms`, {
                attempt: attempt + 1,
                maxAttempts: config.maxAttempts,
                error: lastError.message,
                nextRetryIn: delay,
            });

            await sleep(delay);
        }
    }

    throw lastError || new Error(`${operation} failed after ${config.maxAttempts} attempts`);
}

/**
 * Check if error should be retried
 * @param {Error} error - Error to check
 * @returns True if error should be retried
 */
export function shouldRetry(error: any): boolean {
    // Don't retry authentication errors
    if (error.response?.status === 401 || error.response?.status === 403) {
        return false;
    }

    // Retry network errors
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
        return true;
    }

    // Retry server errors (5xx)
    if (error.response?.status >= 500) {
        return true;
    }

    // Retry rate limit errors (429)
    if (error.response?.status === 429) {
        return true;
    }

    // Retry timeout errors
    if (error.name === "TimeoutError" || error.code === "ETIMEDOUT") {
        return true;
    }

    return false;
}

/**
 * Retry with conditional logic based on error type
 * @template T
 * @param {() => Promise<T>} fn - Async function to retry
 * @param {Partial<RetryConfig>} [options] - Retry configuration options
 * @param {string} [operationName] - Name of operation for logging
 * @returns Promise with function result
 */
export async function retryWithCondition<T>(
    fn: () => Promise<T>,
    options?: Partial<RetryConfig>,
    operationName?: string,
): Promise<T> {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...options };
    const operation = operationName || "operation";

    return retry(
        async () => {
            try {
                return await fn();
            } catch (error) {
                if (!shouldRetry(error)) {
                    logger.error(`${operation} failed with non-retryable error`, error as Error);
                    throw error;
                }
                throw error;
            }
        },
        config,
        operation,
    );
}
