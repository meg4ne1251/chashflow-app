/**
 * Logging utility for frontend error tracking and monitoring.
 * In production, this should integrate with services like Sentry, DataDog, or LogRocket.
 */

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  /**
   * Log informational messages (only in development)
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, context || '');
    }
  }

  /**
   * Log warnings that should be monitored
   */
  warn(message: string, error?: unknown, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, error || '', context || '');
    
    // TODO: In production, send to monitoring service
    // this.sendToMonitoring('warn', message, error, context);
  }

  /**
   * Log errors that require immediate attention
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(`[ERROR] ${message}`, error || '', context || '');
    
    // TODO: In production, send to monitoring service
    // this.sendToMonitoring('error', message, error, context);
  }

  /**
   * Send logs to external monitoring service (placeholder for future implementation)
   */
  // private sendToMonitoring(level: LogLevel, message: string, error?: unknown, context?: LogContext): void {
  //   // Example integration with Sentry:
  //   // Sentry.captureException(error, {
  //   //   level,
  //   //   extra: { message, ...context },
  //   // });
  // }
}

export const logger = new Logger();
