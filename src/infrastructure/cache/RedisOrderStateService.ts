import Redis from 'ioredis';
import { IOrderStateService } from '../../domain/services/IOrderStateService';
import { OrderCreationState, OrderItemData, AmbiguityData, OrderCreationData } from '../../application/services/OrderStateService';
import { logger } from '../../shared/utils/logger';

export class RedisOrderStateService implements IOrderStateService {
  private redis: Redis;
  private readonly keyPrefix = 'order:state:';
  private readonly ttl: number;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redisPassword = process.env.REDIS_PASSWORD;
    this.ttl = parseInt(process.env.ORDER_STATE_TTL || '3600', 10);

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
        logger.debug('Redis connection error', { 
          error: error.message,
          status: this.redis.status 
        });
      }
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  private getKey(phone: string): string {
    return `${this.keyPrefix}${phone}`;
  }

  private async getData(phone: string): Promise<OrderCreationData | null> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect().catch(() => {});
      }
      const data = await this.redis.get(this.getKey(phone));
      if (!data) return null;
      return JSON.parse(data) as OrderCreationData;
    } catch (error: any) {
      // Se houver erro (Redis não disponível), retorna null silenciosamente
      return null;
    }
  }

  private async setData(phone: string, data: OrderCreationData): Promise<void> {
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

  async getOrderData(phone: string): Promise<OrderCreationData | undefined> {
    const data = await this.getData(phone);
    return data || undefined;
  }

  async startOrderCreation(phone: string): Promise<void> {
    await this.setData(phone, {
      state: OrderCreationState.SELECTING_RESTAURANT,
      items: [],
    });
  }

  async setRestaurant(phone: string, restaurantId: string): Promise<void> {
    const data = await this.getData(phone);
    if (data) {
      data.restaurantId = restaurantId;
      data.state = OrderCreationState.VIEWING_MENU;
      await this.setData(phone, data);
    }
  }

  async updateState(phone: string, state: OrderCreationState): Promise<void> {
    const data = await this.getData(phone);
    if (data) {
      data.state = state;
      await this.setData(phone, data);
    }
  }

  async addItem(phone: string, item: OrderItemData): Promise<void> {
    const data = await this.getData(phone);
    if (data) {
      data.items.push(item);
      data.state = OrderCreationState.ADDING_ITEMS;
      await this.setData(phone, data);
    }
  }

  async removeItem(phone: string, index: number): Promise<void> {
    const data = await this.getData(phone);
    if (data && index >= 0 && index < data.items.length) {
      data.items.splice(index, 1);
      await this.setData(phone, data);
    }
  }

  async calculateTotal(phone: string): Promise<number> {
    const data = await this.getData(phone);
    if (!data) return 0;

    return data.items.reduce((sum, item) => sum + item.totalPrice, 0);
  }

  async setPendingAmbiguity(phone: string, ambiguity: AmbiguityData): Promise<void> {
    const data = await this.getData(phone);
    if (data) {
      data.pendingAmbiguity = ambiguity;
      data.state = OrderCreationState.RESOLVING_AMBIGUITY;
      await this.setData(phone, data);
    }
  }

  async getPendingAmbiguity(phone: string): Promise<AmbiguityData | undefined> {
    const data = await this.getData(phone);
    return data?.pendingAmbiguity;
  }

  async clearPendingAmbiguity(phone: string): Promise<void> {
    const data = await this.getData(phone);
    if (data) {
      data.pendingAmbiguity = undefined;
      await this.setData(phone, data);
    }
  }

  async setCurrentOrderId(phone: string, orderId: string): Promise<void> {
    const data = await this.getData(phone);
    if (data) {
      data.currentOrderId = orderId;
      await this.setData(phone, data);
    }
  }

  async getCurrentOrderId(phone: string): Promise<string | undefined> {
    const data = await this.getData(phone);
    return data?.currentOrderId;
  }

  async clearOrderData(phone: string): Promise<void> {
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect().catch(() => {});
      }
      await this.redis.del(this.getKey(phone));
    } catch (error: any) {
      // Ignora erro silenciosamente se Redis não estiver disponível
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.redis.status !== 'end' && this.redis.status !== 'close') {
        await this.redis.quit();
      }
    } catch (error: any) {
      // Ignora erro ao desconectar
    }
  }
}
