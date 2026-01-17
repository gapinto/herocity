import { OrchestrationService } from '../../../src/application/services/OrchestrationService';
import { UserContextService } from '../../../src/application/services/UserContextService';
import { IntentService } from '../../../src/application/services/IntentService';
import { EvolutionApiService } from '../../../src/infrastructure/messaging/EvolutionApiService';
import { RestaurantOnboardingHandler } from '../../../src/application/handlers/RestaurantOnboardingHandler';
import { RestaurantManagementHandler } from '../../../src/application/handlers/RestaurantManagementHandler';
import { CustomerOrdersHandler } from '../../../src/application/handlers/CustomerOrdersHandler';
import { IActiveConversationService } from '../../../src/domain/services/IActiveConversationService';
import { InMemoryIdempotencyService } from '../../../src/infrastructure/cache/InMemoryIdempotencyService';
import { UserContext } from '../../../src/domain/enums/UserContext';
import { Intent } from '../../../src/domain/enums/Intent';
import { Restaurant } from '../../../src/domain/entities/Restaurant';
import { Phone } from '../../../src/domain/value-objects/Phone';

describe('OrchestrationService - Onboarding', () => {
  let orchestrationService: OrchestrationService;
  let mockUserContextService: jest.Mocked<UserContextService>;
  let mockIntentService: jest.Mocked<IntentService>;
  let mockEvolutionApi: jest.Mocked<EvolutionApiService>;
  let mockRestaurantOnboardingHandler: jest.Mocked<RestaurantOnboardingHandler>;
  let mockRestaurantManagementHandler: jest.Mocked<RestaurantManagementHandler>;
  let mockCustomerOrdersHandler: jest.Mocked<CustomerOrdersHandler>;
  let mockActiveConversationService: jest.Mocked<IActiveConversationService>;
  const baseAddress = {
    address: 'Rua Teste, 123',
    postalCode: '50000000',
    addressNumber: '123',
    complement: 'Sala 1',
    province: 'Centro',
    city: 'Recife',
    state: 'PE',
  };

  beforeEach(() => {
    mockUserContextService = {
      identify: jest.fn(),
    } as any;

    mockIntentService = {
      identify: jest.fn(),
    } as any;

    mockEvolutionApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockRestaurantOnboardingHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
      hasActiveConversation: jest.fn().mockResolvedValue(false),
    } as any;

    mockRestaurantManagementHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockCustomerOrdersHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockActiveConversationService = {
      hasActiveConversation: jest.fn().mockResolvedValue(false),
      markAsActive: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
    } as any;

    orchestrationService = new OrchestrationService(
      mockUserContextService,
      mockIntentService,
      mockEvolutionApi,
      mockRestaurantOnboardingHandler,
      mockRestaurantManagementHandler,
      mockCustomerOrdersHandler,
      mockActiveConversationService,
      new InMemoryIdempotencyService()
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cenário: Restaurante já cadastrado tenta iniciar onboarding', () => {
    it('deve ignorar onboarding se from já está cadastrado como restaurante', async () => {
      // Arrange
      const from = '81973129000';
      const restaurant = Restaurant.create({
        id: 'rest-123',
        name: 'Restaurante Teste',
        phone: Phone.create(from),
        ...baseAddress,
        isActive: true,
      });

      // Usuário já é RESTAURANT_USER (já cadastrado)
      mockUserContextService.identify.mockResolvedValue({
        type: UserContext.RESTAURANT,
        restaurantId: restaurant.getId(),
        customerId: undefined,
      });

      // DeepSeek identifica como RESTAURANT_ONBOARDING (erro do AI)
      mockIntentService.identify.mockResolvedValue({
        intent: Intent.RESTAURANT_ONBOARDING,
        confidence: 0.9,
      });

      mockRestaurantOnboardingHandler.hasActiveConversation.mockResolvedValue(false);

      const webhook = {
        data: {
          key: {
            remoteJid: `${from}@s.whatsapp.net`,
            id: 'msg123',
            fromMe: false,
          },
          message: {
            conversation: 'hero cadastrar restaurante',
          },
        },
      };

      // Act
      await orchestrationService.handleWebhook(webhook);

      // Assert
      // Não deve chamar onboarding handler mesmo que intenção seja RESTAURANT_ONBOARDING
      expect(mockRestaurantOnboardingHandler.handle).not.toHaveBeenCalled();
      
      // Deve informar que já está cadastrado
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: from,
          text: expect.stringContaining('já está cadastrado'),
        })
      );
    });

    it('deve permitir onboarding se from é NEW_USER', async () => {
      // Arrange
      const from = '81973129001';

      // Usuário é NEW_USER (não cadastrado)
      mockUserContextService.identify.mockResolvedValue({
        type: UserContext.NEW_USER,
        restaurantId: undefined,
        customerId: undefined,
      });

      // DeepSeek identifica como RESTAURANT_ONBOARDING
      mockIntentService.identify.mockResolvedValue({
        intent: Intent.RESTAURANT_ONBOARDING,
        confidence: 0.9,
      });

      mockRestaurantOnboardingHandler.hasActiveConversation.mockResolvedValue(false);

      const webhook = {
        data: {
          key: {
            remoteJid: `${from}@s.whatsapp.net`,
            id: 'msg124',
            fromMe: false,
          },
          message: {
            conversation: 'hero 1',
          },
        },
      };

      // Act
      await orchestrationService.handleWebhook(webhook);

      // Assert
      // Deve permitir onboarding para NEW_USER
      expect(mockRestaurantOnboardingHandler.handle).toHaveBeenCalled();
    });

    it('deve ignorar onboarding mesmo se DeepSeek identifica como RESTAURANT_ONBOARDING para RESTAURANT_USER', async () => {
      // Arrange
      const from = '81973129002';
      const restaurant = Restaurant.create({
        id: 'rest-456',
        name: 'Outro Restaurante',
        phone: Phone.create(from),
        ...baseAddress,
        isActive: true,
      });

      // Usuário já é RESTAURANT_USER
      mockUserContextService.identify.mockResolvedValue({
        type: UserContext.RESTAURANT,
        restaurantId: restaurant.getId(),
        customerId: undefined,
      });

      // DeepSeek identifica como RESTAURANT_ONBOARDING (mesmo que já seja restaurante)
      mockIntentService.identify.mockResolvedValue({
        intent: Intent.RESTAURANT_ONBOARDING,
        confidence: 0.95,
      });

      mockRestaurantOnboardingHandler.hasActiveConversation.mockResolvedValue(false);

      const webhook = {
        data: {
          key: {
            remoteJid: `${from}@s.whatsapp.net`,
            id: 'msg125',
            fromMe: false,
          },
          message: {
            conversation: 'hero quero cadastrar meu restaurante',
          },
        },
      };

      // Act
      await orchestrationService.handleWebhook(webhook);

      // Assert
      // Não deve chamar onboarding handler
      expect(mockRestaurantOnboardingHandler.handle).not.toHaveBeenCalled();
      
      // Deve informar que já está cadastrado e oferecer opções de gerenciamento
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: from,
          text: expect.stringContaining('já está cadastrado'),
        })
      );
    });
  });
});
