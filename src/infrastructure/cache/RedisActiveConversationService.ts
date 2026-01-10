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
      lazyConnect: true, // Não conecta imediatamente, apenas quando necessário
      enableOfflineQueue: false, // Não enfileira comandos quando offline
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      // Log apenas se estiver realmente tentando usar Redis (não apenas importado)
      // Não loga se a conexão foi configurada mas ainda não está sendo usada
      if (this.redis.status !== 'end' && this.redis.status !== 'ready') {
        logger.debug('Redis connection error (ActiveConversationService)', { 
          error: error.message,
          status: this.redis.status 
        });
      }
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
      // Tenta conectar se ainda não estiver conectado
      if (this.redis.status === 'wait') {
        await this.redis.connect().catch(() => {
          // Se falhar ao conectar, retorna false silenciosamente
          return false;
        });
      }
      const exists = await this.redis.exists(this.getKey(phone));
      return exists === 1;
    } catch (error: any) {
      // Se houver erro (Redis não disponível), retorna false silenciosamente
      // Não loga erro para evitar spam quando Redis não está configurado
      return false;
    }
  }

  async markAsActive(phone: string): Promise<void> {
    try {
      // Tenta conectar se ainda não estiver conectado
      if (this.redis.status === 'wait') {
        await this.redis.connect().catch(() => {
          // Se falhar ao conectar, ignora silenciosamente (usa fallback in-memory)
          return;
        });
      }
      // Usa SETEX para definir com TTL automático
      await this.redis.setex(this.getKey(phone), this.ttl, Date.now().toString());
    } catch (error: any) {
      // Se houver erro (Redis não disponível), ignora silenciosamente
      // Não loga erro para evitar spam quando Redis não está configurado
      // O sistema funcionará com fallback (sem persistência entre instâncias)
    }
  }

  async clear(phone: string): Promise<void> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect().catch(() => {});
      }
      await this.redis.del(this.getKey(phone));
    } catch (error: any) {
      // Ignora erro silenciosamente se Redis não estiver disponível
    }
  }

  async cleanup(): Promise<void> {
    // No Redis, o TTL é gerenciado automaticamente
    // Mas podemos executar uma limpeza manual se necessário
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect().catch(() => {});
      }
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
      // Ignora erro silenciosamente se Redis não estiver disponível
    }
  }
}