import { IOrderStateService } from '../../domain/services/IOrderStateService';
import { InMemoryOrderStateService } from './InMemoryOrderStateService';
import { RedisOrderStateService } from './RedisOrderStateService';
import { logger } from '../../shared/utils/logger';

export type OrderStateStorage = 'redis' | 'memory';

export class OrderStateServiceFactory {
  static create(storage?: OrderStateStorage): IOrderStateService {
    const selectedStorage = storage || (process.env.ORDER_STATE_STORAGE as OrderStateStorage) || 'memory';

    switch (selectedStorage) {
      case 'redis':
        logger.info('Using RedisOrderStateService');
        return new RedisOrderStateService();

      case 'memory':
        logger.info('Using InMemoryOrderStateService');
        return new InMemoryOrderStateService();

      default:
        logger.warn(`Unknown order state storage: ${selectedStorage}. Falling back to memory.`);
        return new InMemoryOrderStateService();
    }
  }
}
