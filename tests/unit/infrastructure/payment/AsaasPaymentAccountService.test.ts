import { AsaasPaymentAccountService } from '../../../../src/infrastructure/payment/AsaasPaymentAccountService';
import { CreatePaymentAccountInput } from '../../../../src/domain/services/IPaymentAccountService';

// Mock fetch global
global.fetch = jest.fn();

describe('AsaasPaymentAccountService', () => {
  let service: AsaasPaymentAccountService;
  const mockApiKey = 'test-api-key';
  const mockBaseUrl = 'https://api.asaas.com/v3';

  beforeEach(() => {
    process.env.ASAAS_API_KEY = mockApiKey;
    process.env.ASAAS_BASE_URL = mockBaseUrl;
    service = new AsaasPaymentAccountService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ASAAS_API_KEY;
    delete process.env.ASAAS_BASE_URL;
  });

  describe('createSubAccount', () => {
    const mockInput: CreatePaymentAccountInput = {
      legalName: 'Restaurante Teste LTDA',
      cpfCnpj: '12345678000190',
      email: 'contato@restaurante.com.br',
      phone: '81999999999',
      name: 'Restaurante Teste',
      bankAccount: {
        bankCode: '001',
        agency: '1234',
        account: '567890',
        accountDigit: '1',
        accountType: 'CHECKING',
        accountHolderName: 'Restaurante Teste LTDA',
      },
      documentUrl: 'https://example.com/document.pdf',
      address: 'Rua Teste, 123',
      postalCode: '50000000',
      addressNumber: '123',
      complement: 'Sala 1',
      province: 'Centro',
      city: 'Recife',
      state: 'PE',
    };

    it('should create sub-account successfully for CNPJ', async () => {
      const mockAccountResponse = {
        id: 'acc_123456789',
        walletId: 'wallet_123456789',
        name: mockInput.legalName,
        email: mockInput.email,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountResponse,
      });

      const result = await service.createSubAccount(mockInput);

      expect(result.accountId).toBe('acc_123456789');
      expect(result.walletId).toBe('wallet_123456789');
      expect(result.status).toBe('pending');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/accounts`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'access_token': mockApiKey,
          }),
          body: expect.stringContaining('JURIDICA'),
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/accounts`,
        expect.objectContaining({
          body: expect.stringContaining(mockInput.postalCode),
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/accounts`,
        expect.objectContaining({
          body: expect.stringContaining(mockInput.city),
        })
      );
    });

    it('should create sub-account successfully for CPF', async () => {
      const cpfInput = { ...mockInput, cpfCnpj: '12345678900' };
      const mockAccountResponse = {
        id: 'acc_987654321',
        walletId: 'wallet_987654321',
        name: cpfInput.legalName,
        email: cpfInput.email,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountResponse,
      });

      const result = await service.createSubAccount(cpfInput);

      expect(result.accountId).toBe('acc_987654321');
      expect(result.walletId).toBe('wallet_987654321');
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/accounts`,
        expect.objectContaining({
          body: expect.stringContaining('FISICA'),
        })
      );
    });

    it('should handle error when creating customer', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            errors: [{ description: 'CPF/CNPJ already registered' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        });

      await expect(service.createSubAccount(mockInput)).rejects.toThrow(
        'Failed to create sub-account'
      );
    });

    it('should reuse existing account when CPF/CNPJ is already registered', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            errors: [{ description: 'O CPF 12345678000190 já está em uso.' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'acc_existing_123',
                walletId: 'wallet_existing_123',
                postalCode: mockInput.postalCode,
                address: mockInput.address,
              },
            ],
          }),
        });

      const result = await service.createSubAccount(mockInput);

      expect(result.accountId).toBe('acc_existing_123');
      expect(result.walletId).toBe('wallet_existing_123');
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        `${mockBaseUrl}/accounts?cpfCnpj=12345678000190&limit=1`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'access_token': mockApiKey,
          }),
        })
      );
    });

    it('should handle account creation response without bank account update', async () => {
      const mockAccountResponse = {
        id: 'acc_123456789',
        walletId: 'wallet_123456789',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountResponse,
      });

      const result = await service.createSubAccount(mockInput);
      expect(result.accountId).toBe('acc_123456789');
      expect(result.walletId).toBe('wallet_123456789');
    });

    it('should send numeric city when city is numeric string', async () => {
      const numericCityInput = { ...mockInput, city: '8389' };
      const mockAccountResponse = {
        id: 'acc_123456789',
        walletId: 'wallet_123456789',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccountResponse,
      });

      await service.createSubAccount(numericCityInput);

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/accounts`,
        expect.objectContaining({
          body: expect.stringContaining('"city":8389'),
        })
      );
    });
  });

  describe('getAccountStatus', () => {
    it('should return approved status', async () => {
      const mockResponse = {
        id: 'acc_123456789',
        status: 'ACTIVE',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getAccountStatus('acc_123456789');

      expect(result).toBe('approved');
    });

    it('should return rejected status when account has errors', async () => {
      const mockResponse = {
        id: 'acc_123456789',
        errors: [{ description: 'Account blocked' }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await service.getAccountStatus('acc_123456789');

      expect(result).toBe('rejected');
    });

    it('should return rejected status when account not found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
      });

      const result = await service.getAccountStatus('invalid_id');

      expect(result).toBe('rejected');
    });
  });

  describe('updateBankAccount', () => {
    const mockBankAccount = {
      bankCode: '001',
      agency: '1234',
      account: '567890',
      accountDigit: '1',
      accountType: 'CHECKING' as const,
      accountHolderName: 'Restaurante Teste LTDA',
    };

    it('should update bank account successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'bank_123456789' }),
      });

      const result = await service.updateBankAccount(
        'acc_123456789',
        mockBankAccount,
        '12345678000190',
        true
      );

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/accounts/acc_123456789/bankAccounts`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('JURIDICA'),
        })
      );
    });

    it('should return false when update fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ errors: [{ description: 'Invalid data' }] }),
      });

      const result = await service.updateBankAccount(
        'acc_123456789',
        mockBankAccount
      );

      expect(result).toBe(false);
    });
  });
});
