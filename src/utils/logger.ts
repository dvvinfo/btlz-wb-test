import log4js from "log4js";
import env from "#config/env/env.js";

/**
 * Configure log4js with structured JSON logging
 */
log4js.configure({
    appenders: {
        console: {
            type: "console",
            layout: {
                type: "pattern",
                pattern: "%[[%d{ISO8601}] [%p] [%c]%] %m",
            },
        },
        json: {
            type: "stdout",
            layout: {
                type: "json",
                separator: ",",
            },
        },
    },
    categories: {
        default: {
            appenders: ["console"],
            level: env.LOG_LEVEL ?? "info",
            enableCallStack: true,
        },
    },
});

/**
 * Logger interface for structured logging
 */
export interface LogContext {
    [key: string]: any;
}

/**
 * Create a logger instance for a specific service
 * @param {string} service - Service name for logging context
 * @returns Logger instance
 */
export function createLogger(service: string) {
    const logger = log4js.getLogger(service);

    return {
        /**
         * Log info level message
         * @param {string} message - Log message
         * @param {LogContext} [context] - Additional context
         */
        info(message: string, context?: LogContext) {
            if (context) {
                logger.info(`${message} ${JSON.stringify(context)}`);
            } else {
                logger.info(message);
            }
        },

        /**
         * Log warning level message
         * @param {string} message - Log message
         * @param {LogContext} [context] - Additional context
         */
        warn(message: string, context?: LogContext) {
            if (context) {
                logger.warn(`${message} ${JSON.stringify(context)}`);
            } else {
                logger.warn(message);
            }
        },

        /**
         * Log error level message
         * @param {string} message - Log message
         * @param {Error | LogContext} [errorOrContext] - Error object or context
         * @param {LogContext} [context] - Additional context if first param is Error
         */
        error(message: string, errorOrContext?: Error | LogContext, context?: LogContext) {
            if (errorOrContext instanceof Error) {
                const errorContext = {
                    error: errorOrContext.message,
                    stack: errorOrContext.stack,
                    ...context,
                };
                logger.error(`${message} ${JSON.stringify(errorContext)}`);
            } else if (errorOrContext) {
                logger.error(`${message} ${JSON.stringify(errorOrContext)}`);
            } else {
                logger.error(message);
            }
        },

        /**
         * Log debug level message
         * @param {string} message - Log message
         * @param {LogContext} [context] - Additional context
         */
        debug(message: string, context?: LogContext) {
            if (context) {
                logger.debug(`${message} ${JSON.stringify(context)}`);
            } else {
                logger.debug(message);
            }
        },
    };
}

/**
 * Default logger instance
 */
export const logger = createLogger("app");

export default logger;
