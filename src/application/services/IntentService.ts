import { DeepSeekService, IntentResult } from '../../infrastructure/ai/DeepSeekService';
import { IMenuItemRepository } from '../../domain/repositories/IMenuItemRepository';
import { IRestaurantRepository } from '../../domain/repositories/IRestaurantRepository';
import { UserContext } from '../../domain/enums/UserContext';
import { Intent } from '../../domain/enums/Intent';
import { logger } from '../../shared/utils/logger';

export class IntentService {
  constructor(
    private readonly deepSeekService: DeepSeekService,
    private readonly menuItemRepository: IMenuItemRepository,
    private readonly restaurantRepository: IRestaurantRepository
  ) {}

  async identify(
    text: string,
    userContext: UserContext,
    restaurantId?: string
  ): Promise<IntentResult> {
    try {
      let menuItems: Array<{ name: string; price: string }> | undefined;
      let menuRules: any = null;

      // Se tiver restaurantId, busca cardápio e regras
      if (restaurantId) {
        try {
          // Busca cardápio
          const items = await this.menuItemRepository.findAvailableByRestaurantId(restaurantId);
          menuItems = items.map((item) => ({
            name: item.getName(),
            price: item.getPrice().getFormatted(),
          }));

          // Busca regras do restaurante
          const restaurant = await this.restaurantRepository.findById(restaurantId);
          if (restaurant && restaurant.getMenuRules()) {
            menuRules = restaurant.getMenuRules();
          }
        } catch (error: any) {
          logger.warn('Error fetching menu items or rules for intent identification', {
            error: error.message,
            restaurantId,
          });
          // Continua sem cardápio/regras se der erro
        }
      }

      return await this.deepSeekService.identifyIntent(text, userContext, menuItems, menuRules);
    } catch (error: any) {
      logger.error('Error identifying intent', {
        error: error.message,
        text,
        userContext,
      });

      // Fallback para ajuda
      return {
        intent: Intent.SOLICITAR_AJUDA,
        confidence: 0.0,
      };
    }
  }
}

