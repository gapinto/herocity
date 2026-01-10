import { IActiveConversationService } from '../../domain/services/IActiveConversationService';
import { InMemoryActiveConversationService } from './InMemoryActiveConversationService';
import { RedisActiveConversationService } from './RedisActiveConversationService';
import { logger } from '../../shared/utils/logger';

export type ActiveConversationStorage = 'redis' | 'memory';

export class ActiveConversationServiceFactory {
  static create(storage?: ActiveConversationStorage): IActiveConversationService {
    const selectedStorage = storage || (process.env.CONVERSATION_STORAGE as ActiveConversationStorage) || 'memory';

    switch (selectedStorage) {
      case 'redis':
        logger.info('Using RedisActiveConversationService');
        return new RedisActiveConversationService();

      case 'memory':
        logger.info('Using InMemoryActiveConversationService');
        return new InMemoryActiveConversationService();

      default:
        logger.warn(`Unknown conversation storage: ${selectedStorage}. Falling back to memory.`);
        return new InMemoryActiveConversationService();
    }
  }
}