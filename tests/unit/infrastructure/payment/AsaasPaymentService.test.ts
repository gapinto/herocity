import { AsaasPaymentService } from '../../../../src/infrastructure/payment/AsaasPaymentService';
import { PaymentRequest } from '../../../../src/domain/services/IPaymentService';

// Mock fetch global
global.fetch = jest.fn();

describe('AsaasPaymentService', () => {
  const mockApiKey = 'test-api-key';
  const mockBaseUrl = 'https://api.asaas.com/v3';

  beforeEach(() => {
    process.env.ASAAS_API_KEY = mockApiKey;
    process.env.ASAAS_BASE_URL = mockBaseUrl;
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    delete process.env.ASAAS_API_KEY;
    delete process.env.ASAAS_BASE_URL;
  });

  it('creates customer when customerId is not Asaas id', async () => {
    const service = new AsaasPaymentService();
    const request: PaymentRequest = {
      orderId: 'order-1',
      amount: 1000,
      method: 'pix',
      customerId: 'internal-123',
      customerName: 'Cliente Teste',
      customerPhone: '81989475466',
      customerCpfCnpj: '39053344705',
      description: 'Pedido #order-1',
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'cus_123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pay_123', status: 'PENDING', invoiceUrl: 'https://pay' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payload: 'pixcode' }),
      });

    await service.createPayment(request);

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `${mockBaseUrl}/customers`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'access_token': mockApiKey,
        }),
        body: expect.stringContaining('Cliente Teste'),
      })
    );

    expect(global.fetch).toHaveBeenCalledWith(
      `${mockBaseUrl}/customers`,
      expect.objectContaining({
        body: expect.stringContaining('"cpfCnpj":"39053344705"'),
      })
    );

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `${mockBaseUrl}/payments`,
      expect.objectContaining({
        body: expect.stringContaining('"customer":"cus_123456"'),
      })
    );
  });

  it('surfaces Asaas error description on payment failure', async () => {
    const service = new AsaasPaymentService();
    const request: PaymentRequest = {
      orderId: 'order-2',
      amount: 1000,
      method: 'pix',
      customerId: 'internal-456',
      customerName: 'Cliente Teste',
      customerPhone: '81989475466',
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'cus_123456' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        text: async () =>
          JSON.stringify({
            errors: [{ description: 'Customer inválido ou não informado.' }],
          }),
      });

    await expect(service.createPayment(request)).rejects.toThrow(
      'Failed to create payment: Customer inválido ou não informado.'
    );
  });

  it('sends split only to restaurant wallet', async () => {
    process.env.ASAAS_PLATFORM_WALLET_ID = 'platform-wallet';
    const service = new AsaasPaymentService();
    const request: PaymentRequest = {
      orderId: 'order-3',
      amount: 1000,
      method: 'pix',
      customerId: 'internal-789',
      customerName: 'Cliente Teste',
      customerPhone: '81989475466',
      splitConfig: {
        restaurantWalletId: 'restaurant-wallet',
        restaurantAmount: 900,
        platformFee: 100,
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'cus_123456' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pay_123', status: 'PENDING', invoiceUrl: 'https://pay' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ payload: 'pixcode' }),
      });

    await service.createPayment(request);

    expect(global.fetch).toHaveBeenCalledWith(
      `${mockBaseUrl}/payments`,
      expect.objectContaining({
        body: expect.stringContaining('"walletId":"restaurant-wallet"'),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `${mockBaseUrl}/payments`,
      expect.objectContaining({
        body: expect.stringContaining('"fixedValue":9'),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `${mockBaseUrl}/payments`,
      expect.objectContaining({
        body: expect.not.stringContaining('"walletId":"platform-wallet"'),
      })
    );
  });
});
