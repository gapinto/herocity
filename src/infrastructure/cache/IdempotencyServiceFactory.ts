import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { RedisIdempotencyService } from './RedisIdempotencyService';
import { InMemoryIdempotencyService } from './InMemoryIdempotencyService';
import { logger } from '../../shared/utils/logger';

export class IdempotencyServiceFactory {
  static create(): IIdempotencyService {
    const storage = (process.env.ORDER_STATE_STORAGE || 'memory') as 'redis' | 'memory';

    // Se tentar usar Redis mas não houver REDIS_URL configurado, usa memory
    if (storage === 'redis' && !process.env.REDIS_URL) {
      logger.warn('ORDER_STATE_STORAGE=redis mas REDIS_URL não está definido. Usando memory.');
      return new InMemoryIdempotencyService();
    }

    if (storage === 'redis') {
      logger.info('Using RedisIdempotencyService');
      return new RedisIdempotencyService();
    }

    logger.info('Using InMemoryIdempotencyService');
    return new InMemoryIdempotencyService();
  }
}
