import { RestaurantOnboardingHandler } from '../../../../src/application/handlers/RestaurantOnboardingHandler';
import { EvolutionApiService } from '../../../../src/infrastructure/messaging/EvolutionApiService';
import { PrismaRestaurantRepository } from '../../../../src/infrastructure/database/PrismaRestaurantRepository';
import { AsaasPaymentAccountService } from '../../../../src/infrastructure/payment/AsaasPaymentAccountService';
import { PrismaClient } from '@prisma/client';
import { Phone } from '../../../../src/domain/value-objects/Phone';

// Mock do Prisma
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      restaurant: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    })),
  };
});

// Mock do fetch global
global.fetch = jest.fn();

describe('RestaurantOnboardingHandler Integration', () => {
  let handler: RestaurantOnboardingHandler;
  let evolutionApi: EvolutionApiService;
  let restaurantRepository: PrismaRestaurantRepository;
  let paymentAccountService: AsaasPaymentAccountService;
  let prisma: jest.Mocked<PrismaClient>;
  let sendMessageSpy: jest.SpyInstance;

  const mockFrom = '5511999999999';
  const mockPushName = 'João Silva';

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    restaurantRepository = new PrismaRestaurantRepository(prisma);
    evolutionApi = new EvolutionApiService();
    paymentAccountService = new AsaasPaymentAccountService();

    sendMessageSpy = jest.spyOn(evolutionApi, 'sendMessage').mockResolvedValue(undefined);

    handler = new RestaurantOnboardingHandler(
      evolutionApi,
      restaurantRepository,
      paymentAccountService
    );

    // Mock padrão: restaurante não existe
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(null);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Complete onboarding flow', () => {
    it('should complete full onboarding flow with payment account creation', async () => {
      // Mock: restaurante não existe
      (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock: criação de restaurante
      const mockRestaurant = {
        id: 'rest_123',
        name: 'Restaurante Teste',
        phone: '81999999999',
        address: 'Rua das Flores, 123 - Centro',
        legalName: 'João Silva',
        cpfCnpj: '12345678900',
        email: 'contato@restaurante.com.br',
        bankAccount: {
          bankCode: '001',
          agency: '1234',
          account: '567890',
          accountDigit: '1',
          accountType: 'CHECKING',
          accountHolderName: 'João Silva',
        },
        isActive: true,
        menuRules: null,
        paymentAccountId: null,
        documentUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.restaurant.upsert as jest.Mock)
        .mockResolvedValueOnce(mockRestaurant) // Primeira criação
        .mockResolvedValueOnce({
          ...mockRestaurant,
          paymentAccountId: 'acct_123456789',
        }); // Segunda atualização com paymentAccountId

      // Mock: criação de subconta no Asaas
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'cus_123456789',
            name: 'João Silva',
            email: 'contato@restaurante.com.br',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'bank_123456789',
          }),
        });

      process.env.ASAAS_API_KEY = 'test-api-key';

      // 1. Inicia onboarding
      await handler.handle({
        from: mockFrom,
        text: 'quero me cadastrar',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockFrom,
          text: expect.stringContaining('Olá'),
          text: expect.stringContaining('Nome do restaurante'),
        })
      );

      // 2. Nome
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: 'Restaurante Teste',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Nome registrado'),
          text: expect.stringContaining('Endereço'),
        })
      );

      // 3. Endereço
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: 'Rua das Flores, 123 - Centro',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Endereço registrado'),
          text: expect.stringContaining('Telefone'),
        })
      );

      // 4. Telefone
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: '81999999999',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Telefone registrado'),
          text: expect.stringContaining('Razão Social'),
        })
      );

      // 5. Razão Social
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: 'João Silva',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Razão social registrada'),
          text: expect.stringContaining('CPF ou CNPJ'),
        })
      );

      // 6. CPF
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: '12345678900',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('CPF registrado'),
          text: expect.stringContaining('E-mail'),
        })
      );

      // 7. Email
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: 'contato@restaurante.com.br',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('E-mail registrado'),
          text: expect.stringContaining('Dados Bancários'),
          text: expect.stringContaining('Código do Banco'),
        })
      );

      // 8. Dados Bancários - Código do Banco
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: '001',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Código do banco'),
          text: expect.stringContaining('Agência'),
        })
      );

      // 9. Agência
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: '1234',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Agência'),
          text: expect.stringContaining('Número da Conta'),
        })
      );

      // 10. Conta
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: '567890',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Conta'),
          text: expect.stringContaining('Dígito Verificador'),
        })
      );

      // 11. Dígito
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: '1',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Dígito verificador'),
          text: expect.stringContaining('Tipo de Conta'),
        })
      );

      // 12. Tipo de Conta (1 = Corrente)
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: '1',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Tipo de conta'),
          text: expect.stringContaining('Nome do Titular'),
        })
      );

      // 13. Nome do Titular
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: 'João Silva',
        pushName: mockPushName,
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Dados bancários registrados'),
          text: expect.stringContaining('Documento do Responsável'),
        })
      );

      // 14. Pula documento (opcional)
      sendMessageSpy.mockClear();
      await handler.handle({
        from: mockFrom,
        text: 'pular',
        pushName: mockPushName,
      } as any);

      // Deve criar restaurante e subconta
      expect(prisma.restaurant.upsert).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/customers'),
        expect.any(Object)
      );

      // Deve mostrar mensagem de sucesso
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Restaurante cadastrado com sucesso'),
          text: expect.stringContaining('acct_123456789'),
        })
      );
    });

    it('should handle duplicate phone gracefully', async () => {
      const existingRestaurant = {
        id: 'rest_existing',
        name: 'Existing Restaurant',
        phone: '81999999999',
        address: 'Rua Existente, 456',
        isActive: true,
        legalName: null,
        cpfCnpj: null,
        email: null,
        bankAccount: null,
        documentUrl: null,
        paymentAccountId: null,
        menuRules: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: restaurante já existe
      (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(existingRestaurant);

      // Simula fluxo até telefone
      await handler.handle({ from: mockFrom, text: 'quero me cadastrar' } as any);
      await handler.handle({ from: mockFrom, text: 'Restaurante Teste' } as any);
      await handler.handle({ from: mockFrom, text: 'Rua das Flores, 123' } as any);
      sendMessageSpy.mockClear();

      // Tenta cadastrar telefone duplicado
      await handler.handle({
        from: mockFrom,
        text: '81999999999',
      } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Já existe um restaurante'),
        })
      );

      expect(prisma.restaurant.upsert).not.toHaveBeenCalled();
    });

    it('should handle payment account creation error gracefully', async () => {
      (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(null);

      const mockRestaurant = {
        id: 'rest_123',
        name: 'Restaurante Teste',
        phone: '81999999999',
        address: 'Rua das Flores, 123',
        isActive: true,
        legalName: 'João Silva',
        cpfCnpj: '12345678900',
        email: 'contato@restaurante.com.br',
        bankAccount: {
          bankCode: '001',
          agency: '1234',
          account: '567890',
          accountDigit: '1',
          accountType: 'CHECKING',
          accountHolderName: 'João Silva',
        },
        paymentAccountId: null,
        documentUrl: null,
        menuRules: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.restaurant.upsert as jest.Mock).mockResolvedValue(mockRestaurant);

      // Mock: erro na criação de subconta
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({
          errors: [{ description: 'API key invalid' }],
        }),
      });

      process.env.ASAAS_API_KEY = 'invalid-key';

      // Simula fluxo completo até documento
      await handler.handle({ from: mockFrom, text: 'quero me cadastrar' } as any);
      await handler.handle({ from: mockFrom, text: 'Restaurante Teste' } as any);
      await handler.handle({ from: mockFrom, text: 'Rua das Flores, 123 - Centro' } as any);
      await handler.handle({ from: mockFrom, text: '81999999999' } as any);
      await handler.handle({ from: mockFrom, text: 'João Silva' } as any);
      await handler.handle({ from: mockFrom, text: '12345678900' } as any);
      await handler.handle({ from: mockFrom, text: 'contato@restaurante.com.br' } as any);
      await handler.handle({ from: mockFrom, text: '001' } as any);
      await handler.handle({ from: mockFrom, text: '1234' } as any);
      await handler.handle({ from: mockFrom, text: '567890' } as any);
      await handler.handle({ from: mockFrom, text: '1' } as any);
      await handler.handle({ from: mockFrom, text: '1' } as any);
      await handler.handle({ from: mockFrom, text: 'João Silva' } as any);
      sendMessageSpy.mockClear();

      // Pula documento e tenta completar
      await handler.handle({
        from: mockFrom,
        text: 'pular',
      } as any);

      // Deve criar restaurante mesmo com erro na subconta
      expect(prisma.restaurant.upsert).toHaveBeenCalled();
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Restaurante cadastrado'),
          text: expect.stringContaining('houve um problema ao criar a conta de pagamento'),
        })
      );
    });
  });

  describe('Validation errors', () => {
    it('should validate each field correctly', async () => {
      await handler.handle({ from: mockFrom, text: 'quero me cadastrar' } as any);

      // Nome muito curto
      sendMessageSpy.mockClear();
      await handler.handle({ from: mockFrom, text: 'AB' } as any);
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Nome muito curto'),
        })
      );

      // Endereço muito curto
      await handler.handle({ from: mockFrom, text: 'Restaurante Teste' } as any);
      sendMessageSpy.mockClear();
      await handler.handle({ from: mockFrom, text: 'Rua ABC' } as any);
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Endereço muito curto'),
        })
      );

      // CPF/CNPJ inválido
      await handler.handle({ from: mockFrom, text: 'Rua das Flores, 123 - Centro' } as any);
      await handler.handle({ from: mockFrom, text: '81999999999' } as any);
      await handler.handle({ from: mockFrom, text: 'João Silva' } as any);
      sendMessageSpy.mockClear();
      await handler.handle({ from: mockFrom, text: '123456' } as any); // CPF/CNPJ inválido
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('CPF/CNPJ inválido'),
        })
      );

      // Email inválido
      await handler.handle({ from: mockFrom, text: '12345678900' } as any);
      sendMessageSpy.mockClear();
      await handler.handle({ from: mockFrom, text: 'invalid-email' } as any);
      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('E-mail inválido'),
        })
      );
    });
  });

  describe('Cancel flow', () => {
    it('should cancel onboarding at any point', async () => {
      await handler.handle({ from: mockFrom, text: 'quero me cadastrar' } as any);
      await handler.handle({ from: mockFrom, text: 'Restaurante Teste' } as any);
      sendMessageSpy.mockClear();

      await handler.handle({ from: mockFrom, text: 'cancelar' } as any);

      expect(sendMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Cadastro cancelado'),
        })
      );
    });
  });
});
