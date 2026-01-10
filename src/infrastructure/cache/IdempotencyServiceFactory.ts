import { IIdempotencyService } from '../../domain/services/IIdempotencyService';
import { RedisIdempotencyService } from './RedisIdempotencyService';
import { InMemoryIdempotencyService } from './InMemoryIdempotencyService';
import { logger } from '../../shared/utils/logger';

export class IdempotencyServiceFactory {
  static create(): IIdempotencyService {
    const storage = (process.env.ORDER_STATE_STORAGE || 'memory') as 'redis' | 'memory';

    if (storage === 'redis') {
      logger.info('Using RedisIdempotencyService');
      return new RedisIdempotencyService();
    }

    logger.info('Using InMemoryIdempotencyService');
    return new InMemoryIdempotencyService();
  }
}
