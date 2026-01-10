import { OrchestrationService } from '../../../src/application/services/OrchestrationService';
import { EvolutionApiService } from '../../../src/infrastructure/messaging/EvolutionApiService';
import { UserContextService } from '../../../src/application/services/UserContextService';
import { IntentService } from '../../../src/application/services/IntentService';
import { RestaurantOnboardingHandler } from '../../../src/application/handlers/RestaurantOnboardingHandler';
import { RestaurantManagementHandler } from '../../../src/application/handlers/RestaurantManagementHandler';
import { CustomerOrdersHandler } from '../../../src/application/handlers/CustomerOrdersHandler';
import { Intent } from '../../../src/domain/enums/Intent';
import { UserContext } from '../../../src/domain/enums/UserContext';
import { InMemoryIdempotencyService } from '../../../src/infrastructure/cache/InMemoryIdempotencyService';

// Mocks
jest.mock('../../../src/infrastructure/messaging/EvolutionApiService');
jest.mock('../../../src/infrastructure/ai/DeepSeekService');
jest.mock('../../../src/application/services/UserContextService');
jest.mock('../../../src/application/services/IntentService');

describe('OrchestrationService - Filtro de mensagens', () => {
  let orchestrationService: OrchestrationService;
  let mockEvolutionApi: jest.Mocked<EvolutionApiService>;
  let mockUserContext: jest.Mocked<UserContextService>;
  let mockIntentService: jest.Mocked<IntentService>;
  let mockRestaurantOnboardingHandler: jest.Mocked<RestaurantOnboardingHandler>;
  let mockRestaurantManagementHandler: jest.Mocked<RestaurantManagementHandler>;
  let mockCustomerOrdersHandler: jest.Mocked<CustomerOrdersHandler>;

  beforeEach(() => {
    // Mock services - Reset mocks antes de cada teste
    mockEvolutionApi = {
      sendMessage: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    mockUserContext = {
      identify: jest.fn().mockResolvedValue({ type: UserContext.NEW_USER }), // Default mock
    } as any;

    mockIntentService = {
      identify: jest.fn().mockResolvedValue({
        intent: Intent.SOLICITAR_AJUDA,
        confidence: 0.5,
      }), // Default mock
    } as any;

    mockRestaurantOnboardingHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockRestaurantManagementHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockCustomerOrdersHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    } as any;

    orchestrationService = new OrchestrationService(
      mockUserContext,
      mockIntentService,
      mockEvolutionApi,
      mockRestaurantOnboardingHandler,
      mockRestaurantManagementHandler,
      mockCustomerOrdersHandler,
      new InMemoryIdempotencyService()
    );

    // Limpa todos os mocks antes de cada teste
    jest.clearAllMocks();
  });

  describe('Filtro de mensagens com "hero"', () => {
    it('deve ignorar mensagens que não contenham "hero" quando não há conversa ativa', async () => {
      const webhook = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg123',
            fromMe: false,
          },
          message: {
            conversation: 'mensagem qualquer sem hero',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook);

      // Não deve chamar nenhum serviço
      expect(mockUserContext.identify).not.toHaveBeenCalled();
      expect(mockEvolutionApi.sendMessage).not.toHaveBeenCalled();
    });

    it('deve processar mensagens sem "hero" quando já há conversa ativa', async () => {
      // Primeiro: inicia conversa com "hero"
      mockUserContext.identify.mockResolvedValueOnce({
        type: UserContext.NEW_USER,
      });
      mockIntentService.identify.mockResolvedValueOnce({
        intent: Intent.SOLICITAR_AJUDA,
        confidence: 0.5,
      });

      const webhook1 = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg130',
            fromMe: false,
          },
          message: {
            conversation: 'hero',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook1);

      // Agora: mensagem sem "hero" deve ser processada
      mockUserContext.identify.mockResolvedValueOnce({
        type: UserContext.NEW_USER,
      });
      mockIntentService.identify.mockResolvedValueOnce({
        intent: Intent.RESTAURANT_ONBOARDING,
        confidence: 0.9,
      });

      const webhook2 = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg131',
            fromMe: false,
          },
          message: {
            conversation: '1',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook2);

      // Deve processar mesmo sem "hero"
      expect(mockUserContext.identify).toHaveBeenCalledTimes(2);
      expect(mockIntentService.identify).toHaveBeenCalledTimes(2);
    });

    it('deve processar mensagens que contenham "hero" (case insensitive)', async () => {
      mockUserContext.identify.mockResolvedValue({
        type: UserContext.NEW_USER,
      });

      mockIntentService.identify.mockResolvedValue({
        intent: Intent.SOLICITAR_AJUDA,
        confidence: 0.5,
      });

      const webhook = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg124',
            fromMe: false,
          },
          message: {
            conversation: 'Olá, quero usar o HeroCity',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook);

      // Deve processar
      expect(mockUserContext.identify).toHaveBeenCalled();
      expect(mockIntentService.identify).toHaveBeenCalled();
    });

    it('deve processar mensagens com "HERO" maiúsculo', async () => {
      mockUserContext.identify.mockResolvedValue({
        type: UserContext.NEW_USER,
      });

      mockIntentService.identify.mockResolvedValue({
        intent: Intent.SOLICITAR_AJUDA,
        confidence: 0.5,
      });

      const webhook = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg125',
            fromMe: false,
          },
          message: {
            conversation: 'HERO',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook);

      expect(mockUserContext.identify).toHaveBeenCalled();
      expect(mockIntentService.identify).toHaveBeenCalled();
    });
  });

  describe('Processamento de opção 1 após boas-vindas', () => {
    it('deve identificar opção "1" como restaurant_onboarding quando usuário é NEW_USER', async () => {
      // Primeira mensagem: recebe boas-vindas
      mockUserContext.identify.mockResolvedValueOnce({
        type: UserContext.NEW_USER,
      });

      mockIntentService.identify.mockResolvedValueOnce({
        intent: Intent.SOLICITAR_AJUDA,
        confidence: 0.5,
      });

      const webhook1 = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg126',
            fromMe: false,
          },
          message: {
            conversation: 'hero',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook1);

      // Deve enviar mensagem de boas-vindas
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Bem-vindo ao HeroCity'),
        })
      );

      // Segunda mensagem: usuário digita "hero 1"
      // IMPORTANTE: Usuário ainda é NEW_USER (não foi criado ainda)
      // Mas agora deve identificar a intenção e processar
      mockUserContext.identify.mockResolvedValueOnce({
        type: UserContext.NEW_USER,
      });

      mockIntentService.identify.mockResolvedValueOnce({
        intent: Intent.RESTAURANT_ONBOARDING,
        confidence: 0.9,
      });

      const webhook2 = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg127',
            fromMe: false,
          },
          message: {
            conversation: 'hero 1',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook2);

      // Deve identificar intenção com texto limpo (sem "hero")
      expect(mockIntentService.identify).toHaveBeenCalledWith(
        '1', // Texto após remover "hero"
        UserContext.NEW_USER,
        undefined
      );

      // Deve chamar o handler de onboarding
      expect(mockRestaurantOnboardingHandler.handle).toHaveBeenCalled();
    });

    it('deve ignorar mensagem "1" sem "hero"', async () => {
      const webhook = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg128',
            fromMe: false,
          },
          message: {
            conversation: '1',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook);

      // Não deve processar
      expect(mockUserContext.identify).not.toHaveBeenCalled();
    });

    it('deve processar "1" quando mensagem contém "hero"', async () => {
      mockUserContext.identify.mockResolvedValue({
        type: UserContext.NEW_USER,
      });

      mockIntentService.identify.mockResolvedValue({
        intent: Intent.RESTAURANT_ONBOARDING,
        confidence: 0.95,
      });

      const webhook = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg129',
            fromMe: false,
          },
          message: {
            conversation: 'hero 1',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook);

      // Deve processar e identificar intenção com texto limpo (sem "hero")
      expect(mockIntentService.identify).toHaveBeenCalledWith(
        '1', // Texto após remover "hero"
        UserContext.NEW_USER,
        undefined
      );

      // Deve chamar o handler de onboarding
      expect(mockRestaurantOnboardingHandler.handle).toHaveBeenCalled();
    });
  });
});
