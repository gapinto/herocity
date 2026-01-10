import { IConversationStateService } from '../../domain/services/IConversationStateService';
import { InMemoryConversationStateService } from './InMemoryConversationStateService';
import { RedisConversationStateService } from './RedisConversationStateService';
import { logger } from '../../shared/utils/logger';

export type ConversationStateStorage = 'redis' | 'memory';

export class ConversationStateServiceFactory {
  static create(storage?: ConversationStateStorage): IConversationStateService {
    const selectedStorage = storage || (process.env.ONBOARDING_STORAGE as ConversationStateStorage) || 'memory';

    // Se tentar usar Redis mas não houver REDIS_URL configurado, usa memory
    if (selectedStorage === 'redis' && !process.env.REDIS_URL) {
      logger.warn('ONBOARDING_STORAGE=redis mas REDIS_URL não está definido. Usando memory.');
      return new InMemoryConversationStateService();
    }

    switch (selectedStorage) {
      case 'redis':
        logger.info('Using RedisConversationStateService');
        return new RedisConversationStateService();

      case 'memory':
        logger.info('Using InMemoryConversationStateService');
        return new InMemoryConversationStateService();

      default:
        logger.warn(`Unknown onboarding storage: ${selectedStorage}. Falling back to memory.`);
        return new InMemoryConversationStateService();
    }
  }
}