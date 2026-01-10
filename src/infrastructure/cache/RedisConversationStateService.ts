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
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error (ConversationStateService)', { error: error.message });
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
      const data = await this.redis.get(this.getKey(phone));
      if (!data) return null;
      return JSON.parse(data) as OnboardingData;
    } catch (error: any) {
      logger.error('Error getting conversation data from Redis', { error: error.message, phone });
      throw error;
    }
  }

  private async setData(phone: string, data: OnboardingData): Promise<void> {
    try {
      await this.redis.setex(this.getKey(phone), this.ttl, JSON.stringify(data));
    } catch (error: any) {
      logger.error('Error setting conversation data in Redis', { error: error.message, phone });
      throw error;
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
      await this.redis.del(this.getKey(phone));
    } catch (error: any) {
      logger.error('Error clearing conversation in Redis', { error: error.message, phone });
      throw error;
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