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
import { IActiveConversationService } from '../../../src/domain/services/IActiveConversationService';

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
  let mockActiveConversationService: jest.Mocked<IActiveConversationService>;

  beforeEach(() => {
    // Mock services - Reset mocks antes de cada teste
    // IMPORTANTE: Criar os mocks ANTES de limpar, para que as referências sejam preservadas
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
      hasActiveConversation: jest.fn().mockResolvedValue(false), // Default: sem conversa ativa (async agora)
    } as any;

    mockRestaurantManagementHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockCustomerOrdersHandler = {
      handle: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock explícito com retorno false garantido
    // IMPORTANTE: Criar o mock e configurar ANTES de criar o serviço
    const hasActiveConversationMock = jest.fn().mockResolvedValue(false);
    mockActiveConversationService = {
      hasActiveConversation: hasActiveConversationMock,
      markAsActive: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn().mockResolvedValue(undefined),
    } as any;

    orchestrationService = new OrchestrationService(
      mockUserContext,
      mockIntentService,
      mockEvolutionApi,
      mockRestaurantOnboardingHandler,
      mockRestaurantManagementHandler,
      mockCustomerOrdersHandler,
      mockActiveConversationService,
      new InMemoryIdempotencyService()
    );

    // Limpa APENAS as chamadas (não a configuração) após criar o serviço
    jest.clearAllMocks();
    
    // Reconfigura explicitamente após limpar para garantir valor correto
    // Usa mockImplementation para garantir retorno false explícito
    hasActiveConversationMock.mockImplementation(async () => {
      return false;
    });
    (mockRestaurantOnboardingHandler.hasActiveConversation as jest.Mock).mockResolvedValue(false);
  });

  describe('Filtro de mensagens com "hero"', () => {
    it('deve ignorar mensagens que não contenham "hero" quando não há conversa ativa', async () => {
      // Configura explicitamente: sem conversa ativa
      const hasActiveConvMock = mockActiveConversationService.hasActiveConversation as jest.Mock;
      hasActiveConvMock.mockReset();
      hasActiveConvMock.mockImplementation(async () => false);
      
      // Garante que userContext está limpo
      (mockUserContext.identify as jest.Mock).mockClear();

      const webhook = {
        data: {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'msg123',
            fromMe: false,
          },
          message: {
            conversation: 'mensagem qualquer',
          },
        },
      };

      await orchestrationService.handleWebhook(webhook);

      // Verifica que hasActiveConversation foi chamado com o telefone correto
      expect(hasActiveConvMock).toHaveBeenCalled();
      const calls = hasActiveConvMock.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      // Verifica que foi chamado com o telefone extraído (sem @s.whatsapp.net)
      expect(calls[0][0]).toBe('5511999999999');
      
      // CRUCIAL: Não deve chamar userContext.identify (mensagem foi filtrada ANTES desta chamada)
      // Se foi chamado, significa que o filtro não retornou quando deveria
      expect(mockUserContext.identify).not.toHaveBeenCalled();
      expect(mockEvolutionApi.sendMessage).not.toHaveBeenCalled();
      expect(mockActiveConversationService.markAsActive).not.toHaveBeenCalled();
    });

    it('deve processar mensagens sem "hero" quando já há conversa ativa', async () => {
      // Primeiro: inicia conversa com "hero"
      mockActiveConversationService.hasActiveConversation.mockResolvedValueOnce(false); // Primeira mensagem não tem conversa ainda
      mockActiveConversationService.hasActiveConversation.mockResolvedValueOnce(true); // Segunda mensagem já tem conversa ativa
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

      // Deve marcar conversa como ativa após receber "hero"
      expect(mockActiveConversationService.markAsActive).toHaveBeenCalledWith('5511999999999');

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

      // Deve processar mesmo sem "hero" porque há conversa ativa
      expect(mockActiveConversationService.hasActiveConversation).toHaveBeenCalledTimes(2);
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
