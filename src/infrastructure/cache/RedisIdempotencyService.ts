import Redis from 'ioredis';
import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { logger } from '../../shared/utils/logger';

export class RedisIdempotencyService implements IIdempotencyService {
  private redis: Redis;
  private readonly keyPrefix = 'idempotency:';
  private readonly defaultTtl = 86400; // 24 horas

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD;

    this.redis = new Redis(redisUrl, {
      password: redisPassword || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      logger.error('Redis idempotency connection error', { error: error.message });
    });
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async isProcessed(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(this.getKey(key));
      return exists === 1;
    } catch (error: any) {
      logger.error('Error checking idempotency', { error: error.message, key });
      // Em caso de erro, retorna false para permitir processamento (fail open)
      return false;
    }
  }

  async getResult<T>(key: string): Promise<T | null> {
    try {
      const resultKey = `${this.getKey(key)}:result`;
      const data = await this.redis.get(resultKey);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error: any) {
      logger.error('Error getting idempotency result', { error: error.message, key });
      return null;
    }
  }

  async markAsProcessed(key: string, ttl: number = this.defaultTtl, result?: any): Promise<void> {
    try {
      const mainKey = this.getKey(key);
      await this.redis.setex(mainKey, ttl, '1');
      
      // Se houver resultado, armazena também (para cache)
      if (result !== undefined) {
        const resultKey = `${mainKey}:result`;
        await this.redis.setex(resultKey, ttl, JSON.stringify(result));
      }
    } catch (error: any) {
      logger.error('Error marking as processed', { error: error.message, key });
      // Não lança erro para não bloquear o fluxo principal
    }
  }

  async executeOnce<T>(
    key: string,
    operation: () => Promise<T>,
    ttl: number = this.defaultTtl
  ): Promise<T | null> {
    // Verifica se já foi processado
    if (await this.isProcessed(key)) {
      logger.info('Operation already processed (idempotent)', { key });
      return null;
    }

    try {
      // Executa operação
      const result = await operation();

      // Marca como processado
      await this.markAsProcessed(key, ttl);

      return result;
    } catch (error: any) {
      logger.error('Error executing idempotent operation', { error: error.message, key });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
