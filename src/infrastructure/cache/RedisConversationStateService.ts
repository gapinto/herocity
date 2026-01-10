import Redis from 'ioredis';
import { IConversationStateService } from '../../domain/services/IConversationStateService';
import { OnboardingState, OnboardingData } from '../../application/services/ConversationStateService';
import { logger } from '../../shared/utils/logger';

export class RedisConversationStateService implements IConversationStateService {
  private redis: Redis;
  private readonly keyPrefix = 'onboarding:state:';
  private readonly ttl = 24 * 60 * 60; // 24 horas em segundos (onboarding pode levar tempo)

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD;
    const customTtl = process.env.ONBOARDING_STATE_TTL;
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
      if (this.redis.status !== 'end' && this.redis.status !== 'ready') {
        logger.debug('Redis connection error (ConversationStateService)', { 
          error: error.message,
          status: this.redis.status 
        });
      }
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully (ConversationStateService)');
    });
  }

  private getKey(phone: string): string {
    return `${this.keyPrefix}${phone}`;
  }

  private async getData(phone: string): Promise<OnboardingData | null> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect().catch(() => {});
      }
      const data = await this.redis.get(this.getKey(phone));
      if (!data) return null;
      return JSON.parse(data) as OnboardingData;
    } catch (error: any) {
      // Se houver erro (Redis não disponível), retorna null silenciosamente
      return null;
    }
  }

  private async setData(phone: string, data: OnboardingData): Promise<void> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect().catch(() => {});
      }
      await this.redis.setex(this.getKey(phone), this.ttl, JSON.stringify(data));
    } catch (error: any) {
      // Se houver erro (Redis não disponível), ignora silenciosamente
      // O sistema funcionará sem persistência entre instâncias
    }
  }

  async getConversation(phone: string): Promise<OnboardingData | undefined> {
    const data = await this.getData(phone);
    return data || undefined;
  }

  async setConversation(phone: string, data: OnboardingData): Promise<void> {
    await this.setData(phone, data);
  }

  async clearConversation(phone: string): Promise<void> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect().catch(() => {});
      }
      await this.redis.del(this.getKey(phone));
    } catch (error: any) {
      // Ignora erro silenciosamente se Redis não estiver disponível
    }
  }

  async startOnboarding(phone: string): Promise<void> {
    await this.setData(phone, {
      state: OnboardingState.WAITING_NAME,
    });
  }

  async updateState(phone: string, state: OnboardingState): Promise<void> {
    const data = await this.getData(phone);
    if (data) {
      data.state = state;
      await this.setData(phone, data);
    }
  }

  async updateData(phone: string, updateData: Partial<OnboardingData>): Promise<void> {
    const data = await this.getData(phone);
    if (data) {
      Object.assign(data, updateData);
      await this.setData(phone, data);
    }
  }
}