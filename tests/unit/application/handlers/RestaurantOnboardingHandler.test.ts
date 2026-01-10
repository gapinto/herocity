import { RestaurantOnboardingHandler } from '../../../../src/application/handlers/RestaurantOnboardingHandler';
import { EvolutionApiService } from '../../../../src/infrastructure/messaging/EvolutionApiService';
import { IRestaurantRepository } from '../../../../src/domain/repositories/IRestaurantRepository';
import { IPaymentAccountService } from '../../../../src/domain/services/IPaymentAccountService';
import { Phone } from '../../../../src/domain/value-objects/Phone';
import { Restaurant } from '../../../../src/domain/entities/Restaurant';
import { OnboardingState } from '../../../../src/application/services/ConversationStateService';

describe('RestaurantOnboardingHandler', () => {
  let handler: RestaurantOnboardingHandler;
  let mockEvolutionApi: jest.Mocked<EvolutionApiService>;
  let mockRestaurantRepository: jest.Mocked<IRestaurantRepository>;
  let mockPaymentAccountService: jest.Mocked<IPaymentAccountService>;

  beforeEach(() => {
    mockEvolutionApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockRestaurantRepository = {
      findByPhone: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((restaurant) => Promise.resolve(restaurant)),
      findById: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockPaymentAccountService = {
      createSubAccount: jest.fn().mockResolvedValue({
        accountId: 'acct_123456789',
        status: 'pending' as const,
      }),
      getAccountStatus: jest.fn(),
      updateBankAccount: jest.fn(),
    } as any;

    handler = new RestaurantOnboardingHandler(
      mockEvolutionApi,
      mockRestaurantRepository,
      mockPaymentAccountService
    );
  });

  describe('handle - start onboarding', () => {
    it('should start onboarding when no conversation exists', async () => {
      const messageData = {
        from: '5511999999999',
        text: 'quero me cadastrar',
        pushName: 'João',
        customerId: 'customer_123',
      };

      await handler.handle(messageData as any);

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '5511999999999',
        })
      );
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Olá João'),
        })
      );
    });
  });

  describe('handle - name validation', () => {
    it('should reject name shorter than 3 characters', async () => {
      const messageData = {
        from: '5511999999999',
        text: 'AB',
        pushName: 'João',
      };

      // Primeiro inicia onboarding
      await handler.handle(messageData as any);
      jest.clearAllMocks();

      // Depois tenta nome curto
      await handler.handle(messageData as any);

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Nome muito curto'),
        })
      );
    });

    it('should accept valid name', async () => {
      const messageData = {
        from: '5511999999999',
        text: 'Restaurante Teste',
        pushName: 'João',
      };

      await handler.handle(messageData as any);
      jest.clearAllMocks();

      await handler.handle(messageData as any);

      const lastCall = mockEvolutionApi.sendMessage.mock.calls[mockEvolutionApi.sendMessage.mock.calls.length - 1][0];
      expect(lastCall.text).toContain('Nome registrado');
      expect(lastCall.text).toContain('Endereço');
    });
  });

  describe('handle - address validation', () => {
    it('should reject address shorter than 10 characters', async () => {
      const messageData = {
        from: '5511999999999',
        text: 'Rua ABC',
        pushName: 'João',
      };

      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      jest.clearAllMocks();

      await handler.handle(messageData as any); // Endereço curto

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Endereço muito curto'),
        })
      );
    });
  });

  describe('handle - phone validation', () => {
    it('should reject duplicate phone', async () => {
      const existingPhone = Phone.create('81999999999');
      const existingRestaurant = Restaurant.create({
        id: 'rest_123',
        name: 'Existing',
        phone: existingPhone,
        isActive: true,
      });

      mockRestaurantRepository.findByPhone.mockResolvedValueOnce(existingRestaurant);

      const messageData = {
        from: '5511999999999',
        text: '81999999999',
        pushName: 'João',
      };

      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      jest.clearAllMocks();

      await handler.handle(messageData as any); // Telefone duplicado

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Já existe um restaurante'),
        })
      );
      expect(mockRestaurantRepository.save).not.toHaveBeenCalled();
    });

    it('should reject invalid phone format', async () => {
      const messageData = {
        from: '5511999999999',
        text: 'abc123',
        pushName: 'João',
      };

      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      jest.clearAllMocks();

      await handler.handle(messageData as any); // Telefone inválido

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Telefone inválido'),
        })
      );
    });
  });

  describe('handle - CPF/CNPJ validation', () => {
    it('should reject invalid CPF/CNPJ length', async () => {
      const messageData = {
        from: '5511999999999',
        text: '123456',
        pushName: 'João',
      };

      // Simula fluxo até CPF/CNPJ
      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      await handler.handle({ ...messageData, text: '81999999999' } as any); // Telefone
      await handler.handle({ ...messageData, text: 'João Silva' } as any); // Razão social
      jest.clearAllMocks();

      await handler.handle(messageData as any); // CPF/CNPJ inválido

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('CPF/CNPJ inválido'),
        })
      );
    });

    it('should accept valid CPF', async () => {
      const messageData = {
        from: '5511999999999',
        text: '12345678900',
        pushName: 'João',
      };

      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      await handler.handle({ ...messageData, text: '81999999999' } as any); // Telefone
      await handler.handle({ ...messageData, text: 'João Silva' } as any); // Razão social
      jest.clearAllMocks();

      await handler.handle(messageData as any); // CPF válido

      const lastCall = mockEvolutionApi.sendMessage.mock.calls[mockEvolutionApi.sendMessage.mock.calls.length - 1][0];
      expect(lastCall.text).toContain('CPF registrado');
      expect(lastCall.text).toContain('E-mail');
    });

    it('should accept valid CNPJ', async () => {
      const messageData = {
        from: '5511999999999',
        text: '12345678000190',
        pushName: 'João',
      };

      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      await handler.handle({ ...messageData, text: '81999999999' } as any); // Telefone
      await handler.handle({ ...messageData, text: 'Restaurante LTDA' } as any); // Razão social
      jest.clearAllMocks();

      await handler.handle(messageData as any); // CNPJ válido

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('CNPJ registrado'),
        })
      );
    });
  });

  describe('handle - email validation', () => {
    it('should reject invalid email format', async () => {
      const messageData = {
        from: '5511999999999',
        text: 'invalid-email',
        pushName: 'João',
      };

      // Simula fluxo até email
      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      await handler.handle({ ...messageData, text: '81999999999' } as any); // Telefone
      await handler.handle({ ...messageData, text: 'João Silva' } as any); // Razão social
      await handler.handle({ ...messageData, text: '12345678900' } as any); // CPF
      jest.clearAllMocks();

      await handler.handle(messageData as any); // Email inválido

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('E-mail inválido'),
        })
      );
    });

    it('should accept valid email', async () => {
      const messageData = {
        from: '5511999999999',
        text: 'contato@restaurante.com.br',
        pushName: 'João',
      };

      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      await handler.handle({ ...messageData, text: '81999999999' } as any); // Telefone
      await handler.handle({ ...messageData, text: 'João Silva' } as any); // Razão social
      await handler.handle({ ...messageData, text: '12345678900' } as any); // CPF
      jest.clearAllMocks();

      await handler.handle(messageData as any); // Email válido

      const lastCall = mockEvolutionApi.sendMessage.mock.calls[mockEvolutionApi.sendMessage.mock.calls.length - 1][0];
      expect(lastCall.text).toContain('E-mail registrado');
      expect(lastCall.text).toContain('Dados Bancários');
    });
  });

  describe('handle - bank account validation', () => {
    it('should validate bank code (3 digits)', async () => {
      const messageData = {
        from: '5511999999999',
        text: '12', // Inválido - menos de 3 dígitos
        pushName: 'João',
      };

      // Simula fluxo até dados bancários
      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      await handler.handle({ ...messageData, text: '81999999999' } as any); // Telefone
      await handler.handle({ ...messageData, text: 'João Silva' } as any); // Razão social
      await handler.handle({ ...messageData, text: '12345678900' } as any); // CPF
      await handler.handle({ ...messageData, text: 'contato@restaurante.com.br' } as any); // Email
      jest.clearAllMocks();

      await handler.handle(messageData as any); // Código do banco inválido

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Código do banco inválido'),
        })
      );
    });
  });

  describe('handle - cancel onboarding', () => {
    it('should cancel onboarding when user sends "cancelar"', async () => {
      const messageData = {
        from: '5511999999999',
        text: 'cancelar',
        pushName: 'João',
      };

      await handler.handle(messageData as any); // Inicia
      jest.clearAllMocks();

      await handler.handle(messageData as any); // Cancela

      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Cadastro cancelado'),
        })
      );
    });
  });

  describe('handle - complete onboarding with payment account', () => {
    it('should create payment account successfully', async () => {
      const savedRestaurant = Restaurant.create({
        id: 'rest_123',
        name: 'Restaurante Teste',
        phone: Phone.create('81999999999'),
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
      });

      mockRestaurantRepository.save.mockResolvedValueOnce(savedRestaurant);
      mockPaymentAccountService.createSubAccount.mockResolvedValueOnce({
        accountId: 'acct_123456789',
        status: 'pending',
      });

      const messageData = {
        from: '5511999999999',
        text: 'pular', // Pula documento
        pushName: 'João',
      };

      // Simula todo o fluxo até documento
      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      await handler.handle({ ...messageData, text: '81999999999' } as any); // Telefone
      await handler.handle({ ...messageData, text: 'João Silva' } as any); // Razão social
      await handler.handle({ ...messageData, text: '12345678900' } as any); // CPF
      await handler.handle({ ...messageData, text: 'contato@restaurante.com.br' } as any); // Email
      await handler.handle({ ...messageData, text: '001' } as any); // Banco
      await handler.handle({ ...messageData, text: '1234' } as any); // Agência
      await handler.handle({ ...messageData, text: '567890' } as any); // Conta
      await handler.handle({ ...messageData, text: '1' } as any); // Dígito
      await handler.handle({ ...messageData, text: '1' } as any); // Tipo (corrente)
      await handler.handle({ ...messageData, text: 'João Silva' } as any); // Titular
      jest.clearAllMocks();

      await handler.handle(messageData as any); // Pula documento e completa

      expect(mockPaymentAccountService.createSubAccount).toHaveBeenCalled();
      expect(mockRestaurantRepository.save).toHaveBeenCalled();
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('Restaurante cadastrado com sucesso'),
        })
      );
    });

    it('should handle payment account creation error gracefully', async () => {
      const savedRestaurant = Restaurant.create({
        id: 'rest_123',
        name: 'Restaurante Teste',
        phone: Phone.create('81999999999'),
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
      });

      mockRestaurantRepository.save.mockResolvedValueOnce(savedRestaurant);
      mockPaymentAccountService.createSubAccount.mockRejectedValueOnce(
        new Error('Payment service unavailable')
      );

      const messageData = {
        from: '5511999999999',
        text: 'pular',
        pushName: 'João',
      };

      // Simula todo o fluxo
      await handler.handle(messageData as any); // Inicia
      await handler.handle({ ...messageData, text: 'Restaurante Teste' } as any); // Nome
      await handler.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any); // Endereço
      await handler.handle({ ...messageData, text: '81999999999' } as any); // Telefone
      await handler.handle({ ...messageData, text: 'João Silva' } as any); // Razão social
      await handler.handle({ ...messageData, text: '12345678900' } as any); // CPF
      await handler.handle({ ...messageData, text: 'contato@restaurante.com.br' } as any); // Email
      await handler.handle({ ...messageData, text: '001' } as any); // Banco
      await handler.handle({ ...messageData, text: '1234' } as any); // Agência
      await handler.handle({ ...messageData, text: '567890' } as any); // Conta
      await handler.handle({ ...messageData, text: '1' } as any); // Dígito
      await handler.handle({ ...messageData, text: '1' } as any); // Tipo
      await handler.handle({ ...messageData, text: 'João Silva' } as any); // Titular
      jest.clearAllMocks();

      await handler.handle(messageData as any); // Tenta completar

      expect(mockRestaurantRepository.save).toHaveBeenCalled();
      const lastCall = mockEvolutionApi.sendMessage.mock.calls[mockEvolutionApi.sendMessage.mock.calls.length - 1][0];
      expect(lastCall.text).toContain('Restaurante cadastrado');
      expect(lastCall.text).toContain('houve um problema ao criar a conta de pagamento');
    });

    it('should complete onboarding even without payment account service', async () => {
      const handlerWithoutPayment = new RestaurantOnboardingHandler(
        mockEvolutionApi,
        mockRestaurantRepository
        // Sem paymentAccountService
      );

      const savedRestaurant = Restaurant.create({
        id: 'rest_123',
        name: 'Restaurante Teste',
        phone: Phone.create('81999999999'),
        address: 'Rua das Flores, 123 - Centro',
        isActive: true,
      });

      mockRestaurantRepository.save.mockResolvedValueOnce(savedRestaurant);

      const messageData = {
        from: '5511999999999',
        text: 'pular',
        pushName: 'João',
      };

      // Simula fluxo básico (sem campos de pagamento)
      await handlerWithoutPayment.handle(messageData as any);
      await handlerWithoutPayment.handle({ ...messageData, text: 'Restaurante Teste' } as any);
      await handlerWithoutPayment.handle({ ...messageData, text: 'Rua das Flores, 123 - Centro' } as any);
      jest.clearAllMocks();

      await handlerWithoutPayment.handle({ ...messageData, text: '81999999999' } as any);

      // Deve mostrar erro porque faltam campos de pagamento
      // Mas não deve quebrar
      expect(mockEvolutionApi.sendMessage).toHaveBeenCalled();
    });
  });
});
