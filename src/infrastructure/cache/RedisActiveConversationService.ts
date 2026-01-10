import Redis from 'ioredis';
import { IActiveConversationService } from '../../domain/services/IActiveConversationService';
import { logger } from '../../shared/utils/logger';

export class RedisActiveConversationService implements IActiveConversationService {
  private redis: Redis;
  private readonly keyPrefix = 'active:conversation:';
  private readonly ttl = 30 * 60; // 30 minutos em segundos

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD;
    const customTtl = process.env.ACTIVE_CONVERSATION_TTL;
    if (customTtl) {
      this.ttl = parseInt(customTtl, 10);
    }

    this.redis = new Redis(redisUrl, {
      password: redisPassword || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error (ActiveConversationService)', { error: error.message });
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully (ActiveConversationService)');
    });
  }

  private getKey(phone: string): string {
    return `${this.keyPrefix}${phone}`;
  }

  async hasActiveConversation(phone: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(this.getKey(phone));
      return exists === 1;
    } catch (error: any) {
      logger.error('Error checking active conversation in Redis', { error: error.message, phone });
      // Em caso de erro, retorna false para não bloquear o fluxo
      return false;
    }
  }

  async markAsActive(phone: string): Promise<void> {
    try {
      // Usa SETEX para definir com TTL automático
      await this.redis.setex(this.getKey(phone), this.ttl, Date.now().toString());
    } catch (error: any) {
      logger.error('Error marking conversation as active in Redis', { error: error.message, phone });
      throw error;
    }
  }

  async clear(phone: string): Promise<void> {
    try {
      await this.redis.del(this.getKey(phone));
    } catch (error: any) {
      logger.error('Error clearing active conversation in Redis', { error: error.message, phone });
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    // No Redis, o TTL é gerenciado automaticamente
    // Mas podemos executar uma limpeza manual se necessário
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        // Verifica TTL de cada chave e remove se expirada
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -2) {
            // Chave já expirada (não existe)
            continue;
          }
          if (ttl === -1) {
            // Chave sem TTL (não deveria acontecer, mas remove por segurança)
            await this.redis.del(key);
          }
        }
      }
    } catch (error: any) {
      logger.error('Error cleaning up active conversations in Redis', { error: error.message });
      // Não lança erro, pois cleanup é opcional
    }
  }
}