export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  userId?: string;
  restaurantId?: string;
  customerId?: string;
  orderId?: string;
  intent?: string;
  [key: string]: unknown;
}

export class StructuredLogger {
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    // Em produção, enviar para serviço de logs (Datadog, CloudWatch, etc)
    // Em desenvolvimento, console
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrar com serviço de logs externo
      console.log(JSON.stringify(logEntry));
    } else {
      const emoji = this.getEmojiForLevel(level);
      console.log(`${emoji} [${level}] ${message}`, context || '');
    }
  }

  private getEmojiForLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.INFO:
        return 'ℹ️';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      default:
        return '📝';
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }
}

export const structuredLogger = new StructuredLogger();

